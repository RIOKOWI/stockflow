
CREATE TABLE sales_orders (
    id SERIAL PRIMARY KEY,
    customer TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'CANCELLED')),
    total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_created_at ON sales_orders(created_at DESC);


DROP TABLE sales_orders;
