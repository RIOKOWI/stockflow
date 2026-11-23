package model

import "time"

const (
	MovementIn  = "in"
	MovementOut = "out"
)

type StockMovement struct {
	ID        int       `json:"id"`
	ProductID int       `json:"product_id"`
	Type      string    `json:"type"`
	Qty       int       `json:"qty"`
	Note      *string   `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}
