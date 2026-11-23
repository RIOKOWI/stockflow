package model

import "time"

const (
	OrderStatusCreated   = "CREATED"
	OrderStatusCancelled = "CANCELLED"
)

type SalesOrder struct {
	ID          int              `json:"id"`
	Customer    string           `json:"customer"`
	Status      string           `json:"status"`
	Total       int              `json:"total"`
	CreatedAt   time.Time        `json:"created_at"`
	CancelledAt *time.Time       `json:"cancelled_at"`
	Items       []SalesOrderItem `json:"items,omitempty"`
}

type SalesOrderItem struct {
	ID        int    `json:"id"`
	OrderID   int    `json:"order_id"`
	SKU       string `json:"sku"`
	Name      string `json:"name"`
	Qty       int    `json:"qty"`
	UnitPrice int    `json:"unit_price"`
	Subtotal  int    `json:"subtotal"`
}

type CreateOrderRequest struct {
	Customer string           `json:"customer"`
	Items    []OrderItemInput `json:"items"`
}

type OrderItemInput struct {
	SKU string `json:"sku"`
	Qty int    `json:"qty"`
}
