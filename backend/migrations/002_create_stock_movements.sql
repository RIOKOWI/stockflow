-- +goose Up
CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    qty INTEGER NOT NULL CHECK (qty > 0),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at DESC);

-- +goose Down
DROP TABLE stock_movements;
