package model

import "time"

type Product struct {
	ID             int        `json:"id"`
	SKU            string     `json:"sku"`
	Name           string     `json:"name"`
	Price          int        `json:"price"`
	Stock          int        `json:"stock"`
	IsActive       bool       `json:"is_active"`
	CreatedAt      time.Time  `json:"created_at"`
	LastMovementAt *time.Time `json:"last_movement_at"`
}

type CreateProductRequest struct {
	SKU   string `json:"sku"`
	Name  string `json:"name"`
	Price int    `json:"price"`
}

type UpdateProductRequest struct {
	SKU   string `json:"sku"`
	Name  string `json:"name"`
	Price int    `json:"price"`
	Stock *int   `json:"stock"`
}

type ProductFilter struct {
	Search    string
	MinPrice  *int
	MaxPrice  *int
	IsActive  *bool
	MaxStock  *int
	SortBy    string
	SortOrder string
	Page      int
	Limit     int
}

type ProductList struct {
	Products []Product
	Page     int
	Limit    int
	Total    int
}
