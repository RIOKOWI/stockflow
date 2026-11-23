package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/RIOKOWI/stockflow/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound     = errors.New("product not found")
	ErrDuplicateSKU = errors.New("sku already exists")
	ErrHasHistory   = errors.New("product has history")
)

// InsufficientStockError reports how much stock was actually available.
type InsufficientStockError struct {
	Available int
}

func (e *InsufficientStockError) Error() string {
	return fmt.Sprintf("insufficient stock: %d available", e.Available)
}

type ProductRepository struct {
	pool *pgxpool.Pool
}

func NewProductRepository(pool *pgxpool.Pool) *ProductRepository {
	return &ProductRepository{pool: pool}
}

const productColumns = `
	p.id, p.sku, p.name, p.price, p.stock, p.is_active, p.created_at,
	(SELECT MAX(m.created_at) FROM stock_movements m WHERE m.product_id = p.id)`

func scanProduct(row pgx.Row) (*model.Product, error) {
	var p model.Product
	err := row.Scan(&p.ID, &p.SKU, &p.Name, &p.Price, &p.Stock, &p.IsActive, &p.CreatedAt, &p.LastMovementAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *ProductRepository) Create(ctx context.Context, p *model.Product) (*model.Product, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO products (sku, name, price, stock)
		VALUES ($1, $2, $3, $4)
		RETURNING id, sku, name, price, stock, is_active, created_at, NULL::TIMESTAMPTZ`,
		p.SKU, p.Name, p.Price, p.Stock)

	created, err := scanProduct(row)
	if err != nil {
		return nil, mapPGError(err)
	}
	return created, nil
}

func (r *ProductRepository) GetByID(ctx context.Context, id int) (*model.Product, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+productColumns+` FROM products p WHERE p.id = $1`, id)

	product, err := scanProduct(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return product, nil
}

func (r *ProductRepository) List(ctx context.Context, f model.ProductFilter) ([]model.Product, int, error) {
	conditions := []string{"TRUE"}
	args := []any{}

	if f.Search != "" {
		args = append(args, "%"+escapeLike(f.Search)+"%")
		conditions = append(conditions, fmt.Sprintf("(p.sku ILIKE $%d ESCAPE '\\' OR p.name ILIKE $%d ESCAPE '\\')", len(args), len(args)))
	}
	if f.MinPrice != nil {
		args = append(args, *f.MinPrice)
		conditions = append(conditions, fmt.Sprintf("p.price >= $%d", len(args)))
	}
	if f.MaxPrice != nil {
		args = append(args, *f.MaxPrice)
		conditions = append(conditions, fmt.Sprintf("p.price <= $%d", len(args)))
	}
	where := strings.Join(conditions, " AND ")

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT count(*) FROM products p WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, f.Limit, (f.Page-1)*f.Limit)
	rows, err := r.pool.Query(ctx, `
		SELECT `+productColumns+`
		FROM products p
		WHERE `+where+fmt.Sprintf(`
		ORDER BY p.%s %s
		LIMIT $%d OFFSET $%d`, f.SortBy, f.SortOrder, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	products := []model.Product{}
	for rows.Next() {
		var p model.Product
		if err := rows.Scan(&p.ID, &p.SKU, &p.Name, &p.Price, &p.Stock, &p.IsActive, &p.CreatedAt, &p.LastMovementAt); err != nil {
			return nil, 0, err
		}
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return products, total, nil
}

func (r *ProductRepository) Update(ctx context.Context, id int, sku, name string, price int, stock *int) (*model.Product, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var oldStock int
	err = tx.QueryRow(ctx, `SELECT stock FROM products WHERE id = $1 FOR UPDATE`, id).Scan(&oldStock)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	newStock := oldStock
	if stock != nil {
		newStock = *stock
	}

	if _, err := tx.Exec(ctx, `
		UPDATE products SET sku = $2, name = $3, price = $4, stock = $5 WHERE id = $1`,
		id, sku, name, price, newStock); err != nil {
		return nil, mapPGError(err)
	}

	if newStock != oldStock {
		movementType, qty := "in", newStock-oldStock
		if qty < 0 {
			movementType, qty = "out", -qty
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO stock_movements (product_id, type, qty, note)
			VALUES ($1, $2, $3, 'Stock adjusted via product update')`, id, movementType, qty); err != nil {
			return nil, err
		}
	}

	product, err := scanProduct(tx.QueryRow(ctx, `SELECT `+productColumns+` FROM products p WHERE p.id = $1`, id))
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return product, nil
}

func (r *ProductRepository) Delete(ctx context.Context, id int) error {
	var sku string
	err := r.pool.QueryRow(ctx, `SELECT sku FROM products WHERE id = $1`, id).Scan(&sku)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	var references int
	err = r.pool.QueryRow(ctx, `
		SELECT (SELECT count(*) FROM stock_movements WHERE product_id = $1)
		     + (SELECT count(*) FROM sales_order_items WHERE sku = $2)`, id, sku).Scan(&references)
	if err != nil {
		return err
	}
	if references > 0 {
		return ErrHasHistory
	}

	result, err := r.pool.Exec(ctx, `DELETE FROM products WHERE id = $1`, id)
	if err != nil {
		return mapPGError(err)
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AdjustStock updates product stock and records the matching movement in one transaction.
func (r *ProductRepository) AdjustStock(ctx context.Context, productID int, movementType string, qty int, note *string) (*model.StockAdjustmentResult, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var current int
	err = tx.QueryRow(ctx, `SELECT stock FROM products WHERE id = $1 FOR UPDATE`, productID).Scan(&current)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	newStock := current + qty
	if movementType == model.MovementOut {
		if current < qty {
			return nil, &InsufficientStockError{Available: current}
		}
		newStock = current - qty
	}

	if _, err := tx.Exec(ctx, `UPDATE products SET stock = $2 WHERE id = $1`, productID, newStock); err != nil {
		return nil, mapPGError(err)
	}

	var movement model.StockMovement
	movement.ProductID = productID
	err = tx.QueryRow(ctx, `
		INSERT INTO stock_movements (product_id, type, qty, note)
		VALUES ($1, $2, $3, $4)
		RETURNING id, type, qty, note, created_at`,
		productID, movementType, qty, note).Scan(
		&movement.ID, &movement.Type, &movement.Qty, &movement.Note, &movement.CreatedAt)
	if err != nil {
		return nil, mapPGError(err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &model.StockAdjustmentResult{Stock: newStock, Movement: movement}, nil
}

// ListMovements returns the product movement history, newest first.
func (r *ProductRepository) ListMovements(ctx context.Context, productID int) ([]model.StockMovement, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, product_id, type, qty, note, created_at
		FROM stock_movements
		WHERE product_id = $1
		ORDER BY created_at DESC, id DESC`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	movements := []model.StockMovement{}
	for rows.Next() {
		var m model.StockMovement
		if err := rows.Scan(&m.ID, &m.ProductID, &m.Type, &m.Qty, &m.Note, &m.CreatedAt); err != nil {
			return nil, err
		}
		movements = append(movements, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return movements, nil
}

func mapPGError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return ErrDuplicateSKU
		case "23503":
			return ErrHasHistory
		}
	}
	return err
}

func escapeLike(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return replacer.Replace(value)
}
