-- +goose Up
WITH seeded AS (
    INSERT INTO products (sku, name, price, stock, is_active)
    VALUES
        ('SKU-001', 'iCrystal',           1500000, 50, TRUE),
        ('SKU-002', 'iGalaxy',            1850000, 30, TRUE),
        ('SKU-003', 'iMasonry',            1650000, 15, TRUE),
        ('SKU-004', 'iZen',                1750000, 40, TRUE),
        ('SKU-005', 'Notte Stelle',        2200000, 25, TRUE),
        ('SKU-006', 'iWood',               1950000, 12, TRUE),
        ('SKU-007', 'Milky Latte',          1600000, 18, TRUE),
        ('SKU-008', 'Mocha Cioccolatta',   1800000, 20, TRUE),
        ('SKU-009', 'Sedimen Tario',       1700000, 22, TRUE),
        ('SKU-010', 'Vulcan Ash',          1550000,  8, TRUE),
        ('SKU-011', 'Pompeii Grigio',      1900000, 10, TRUE),
        ('SKU-012', 'Portoro Nero',        2500000, 60, TRUE),
        ('SKU-013', 'Sugar Zucchero',        2700000, 60, FALSE)
    ON CONFLICT (sku) DO NOTHING
    RETURNING id, stock
)
INSERT INTO stock_movements (product_id, type, qty, note)
SELECT id, 'in', stock, 'Initial stock (seed)' FROM seeded;


WITH ord AS (
    INSERT INTO sales_orders (customer, status, total)
    SELECT 'PT Sinar Mas Elektronik', 'CREATED', 5200000
    WHERE NOT EXISTS (
        SELECT 1 FROM sales_orders
        WHERE customer = 'PT Sinar Mas Elektronik' AND total = 5200000
    )
    RETURNING id
),
items AS (
    INSERT INTO sales_order_items (order_id, sku, qty, unit_price)
    SELECT ord.id, it.sku, it.qty, it.price
    FROM ord
    JOIN (VALUES
        ('SKU-001', 2, 1500000),
        ('SKU-005', 1, 2200000)
    ) AS it(sku, qty, price) ON TRUE
    JOIN products p ON p.sku = it.sku
    RETURNING order_id, sku, qty
),
moved AS (
    UPDATE products p
    SET stock = p.stock - it.qty
    FROM items it
    WHERE p.sku = it.sku
    RETURNING p.id, it.qty, it.order_id
)
INSERT INTO stock_movements (product_id, type, qty, note)
SELECT id, 'out', qty, 'Seed sales order #' || order_id FROM moved;


WITH ord AS (
    INSERT INTO sales_orders (customer, status, total)
    SELECT 'CV Metro Tech', 'CREATED', 7100000
    WHERE NOT EXISTS (
        SELECT 1 FROM sales_orders
        WHERE customer = 'CV Metro Tech' AND total = 7100000
    )
    RETURNING id
),
items AS (
    INSERT INTO sales_order_items (order_id, sku, qty, unit_price)
    SELECT ord.id, it.sku, it.qty, it.price
    FROM ord
    JOIN (VALUES
        ('SKU-002', 1, 1850000),
        ('SKU-004', 3, 1750000)
    ) AS it(sku, qty, price) ON TRUE
    JOIN products p ON p.sku = it.sku
    RETURNING order_id, sku, qty
),
moved AS (
    UPDATE products p
    SET stock = p.stock - it.qty
    FROM items it
    WHERE p.sku = it.sku
    RETURNING p.id, it.qty, it.order_id
)
INSERT INTO stock_movements (product_id, type, qty, note)
SELECT id, 'out', qty, 'Seed sales order #' || order_id FROM moved;

-- +goose Down
DELETE FROM stock_movements WHERE note LIKE 'Seed sales order #%';
DELETE FROM stock_movements WHERE note = 'Initial stock (seed)';
DELETE FROM sales_order_items
WHERE order_id IN (
    SELECT id FROM sales_orders
    WHERE customer IN ('PT Sinar Mas Elektronik', 'CV Metro Tech')
);
DELETE FROM sales_orders
WHERE customer IN ('PT Sinar Mas Elektronik', 'CV Metro Tech');
DELETE FROM products WHERE sku IN (
    'SKU-001', 'SKU-002', 'SKU-003', 'SKU-004',
    'SKU-005', 'SKU-006', 'SKU-007', 'SKU-008',
    'SKU-009', 'SKU-010', 'SKU-011', 'SKU-012'
);
