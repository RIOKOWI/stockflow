package repository

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/RIOKOWI/stockflow/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrOrderNotFound         = errors.New("order not found")
	ErrOrderAlreadyCancelled = errors.New("order already cancelled")
)


type UnknownSKUError struct {
	SKU string
}

func (e *UnknownSKUError) Error() string {
	return "unknown sku: " + e.SKU
}


type InactiveProductError struct {
	SKU string
}

func (e *InactiveProductError) Error() string {
	return "product is inactive: " + e.SKU
}

type OrderRepository struct {
	pool *pgxpool.Pool
}

func NewOrderRepository(pool *pgxpool.Pool) *OrderRepository {
	return &OrderRepository{pool: pool}
}


type lockedProduct struct {
	sku    string
	name   string
	price  int
	stock  int
	active bool
}



func (r *OrderRepository) Create(ctx context.Context, customer string, items []model.OrderItemInput) (*model.SalesOrder, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	
	ordered := append([]model.OrderItemInput(nil), items...)
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].SKU < ordered[j].SKU })

	products := make(map[string]lockedProduct, len(ordered))
	for _, item := range ordered {
		var p lockedProduct
		err := tx.QueryRow(ctx, `
			SELECT sku, name, price, stock, is_active
			FROM products
			WHERE sku = $1
			FOR UPDATE`, item.SKU).Scan(&p.sku, &p.name, &p.price, &p.stock, &p.active)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, &UnknownSKUError{SKU: item.SKU}
		}
		if err != nil {
			return nil, err
		}
		if !p.active {
			return nil, &InactiveProductError{SKU: item.SKU}
		}
		if p.stock < item.Qty {
			return nil, &InsufficientStockError{SKU: item.SKU, Available: p.stock}
		}
		products[p.sku] = p
	}

	total := 0
	for _, item := range ordered {
		p := products[item.SKU]
		total += p.price * item.Qty
	}

	for _, item := range ordered {
		if _, err := tx.Exec(ctx, `
			UPDATE products SET stock = stock - $2 WHERE sku = $1`, item.SKU, item.Qty); err != nil {
			return nil, mapPGError(err)
		}
	}

	order := &model.SalesOrder{
		Customer: customer,
		Status:   model.OrderStatusCreated,
		Total:    total,
	}
	if err := tx.QueryRow(ctx, `
		INSERT INTO sales_orders (customer, status, total)
		VALUES ($1, $2, $3)
		RETURNING id, created_at`, customer, order.Status, total).Scan(&order.ID, &order.CreatedAt); err != nil {
		return nil, mapPGError(err)
	}

	for _, item := range items {
		p := products[item.SKU]
		orderItem := model.SalesOrderItem{
			OrderID:   order.ID,
			SKU:       item.SKU,
			Name:      p.name,
			Qty:       item.Qty,
			UnitPrice: p.price,
			Subtotal:  p.price * item.Qty,
		}
		if err := tx.QueryRow(ctx, `
			INSERT INTO sales_order_items (order_id, sku, qty, unit_price)
			VALUES ($1, $2, $3, $4)
			RETURNING id`, order.ID, item.SKU, item.Qty, p.price).Scan(&orderItem.ID); err != nil {
			return nil, mapPGError(err)
		}
		order.Items = append(order.Items, orderItem)
	}

	for _, item := range ordered {
		if _, err := tx.Exec(ctx, `
			INSERT INTO stock_movements (product_id, type, qty, note)
			SELECT id, 'out', $2, $3 FROM products WHERE sku = $1`,
			item.SKU, item.Qty, fmt.Sprintf("Order #%d", order.ID)); err != nil {
			return nil, mapPGError(err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return order, nil
}


func (r *OrderRepository) List(ctx context.Context, f model.OrderFilter) ([]model.SalesOrder, int, error) {
	conditions := []string{"TRUE"}
	args := []any{}

	if f.Search != "" {
		args = append(args, "%"+escapeLike(f.Search)+"%")
		conditions = append(conditions, fmt.Sprintf("customer ILIKE $%d ESCAPE '\\'", len(args)))
	}
	where := strings.Join(conditions, " AND ")

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT count(*) FROM sales_orders WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, f.Limit, (f.Page-1)*f.Limit)
	rows, err := r.pool.Query(ctx, `
		SELECT id, customer, status, total, created_at, cancelled_at
		FROM sales_orders
		WHERE `+where+fmt.Sprintf(`
		ORDER BY %s %s, id DESC
		LIMIT $%d OFFSET $%d`, f.SortBy, f.SortOrder, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	orders := []model.SalesOrder{}
	for rows.Next() {
		var o model.SalesOrder
		if err := rows.Scan(&o.ID, &o.Customer, &o.Status, &o.Total, &o.CreatedAt, &o.CancelledAt); err != nil {
			return nil, 0, err
		}
		orders = append(orders, o)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return orders, total, nil
}

func (r *OrderRepository) GetByID(ctx context.Context, id int) (*model.SalesOrder, error) {
	var order model.SalesOrder
	err := r.pool.QueryRow(ctx, `
		SELECT id, customer, status, total, created_at, cancelled_at
		FROM sales_orders
		WHERE id = $1`, id).Scan(&order.ID, &order.Customer, &order.Status, &order.Total, &order.CreatedAt, &order.CancelledAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOrderNotFound
	}
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx, `
		SELECT i.id, i.sku, p.name, i.qty, i.unit_price, i.qty * i.unit_price
		FROM sales_order_items i
		JOIN products p ON p.sku = i.sku
		WHERE i.order_id = $1
		ORDER BY i.id`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	order.Items = []model.SalesOrderItem{}
	for rows.Next() {
		var item model.SalesOrderItem
		if err := rows.Scan(&item.ID, &item.SKU, &item.Name, &item.Qty, &item.UnitPrice, &item.Subtotal); err != nil {
			return nil, err
		}
		item.OrderID = order.ID
		order.Items = append(order.Items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &order, nil
}



func (r *OrderRepository) Cancel(ctx context.Context, id int) (*model.SalesOrder, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var status string
	err = tx.QueryRow(ctx, `SELECT status FROM sales_orders WHERE id = $1 FOR UPDATE`, id).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOrderNotFound
	}
	if err != nil {
		return nil, err
	}
	if status == model.OrderStatusCancelled {
		return nil, ErrOrderAlreadyCancelled
	}

	rows, err := tx.Query(ctx, `
		SELECT sku, qty FROM sales_order_items WHERE order_id = $1 ORDER BY sku`, id)
	if err != nil {
		return nil, err
	}
	type orderLine struct {
		sku string
		qty int
	}
	lines := []orderLine{}
	for rows.Next() {
		var line orderLine
		if err := rows.Scan(&line.sku, &line.qty); err != nil {
			rows.Close()
			return nil, err
		}
		lines = append(lines, line)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for _, line := range lines {
		var productID int
		err := tx.QueryRow(ctx, `SELECT id FROM products WHERE sku = $1 FOR UPDATE`, line.sku).Scan(&productID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, &UnknownSKUError{SKU: line.sku}
		}
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE products SET stock = stock + $2 WHERE sku = $1`, line.sku, line.qty); err != nil {
			return nil, mapPGError(err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO stock_movements (product_id, type, qty, note)
			VALUES ($1, 'in', $2, $3)`, productID, line.qty, fmt.Sprintf("Order #%d cancelled", id)); err != nil {
			return nil, mapPGError(err)
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE sales_orders SET status = $2, cancelled_at = NOW() WHERE id = $1`,
		id, model.OrderStatusCancelled); err != nil {
		return nil, mapPGError(err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}
