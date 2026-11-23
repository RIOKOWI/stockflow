package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"sync"
	"testing"
)



func createOrderProduct(t *testing.T, e *testEnv, sku, name string, price, stock int) int {
	t.Helper()

	rr := e.post(t, "/api/products", map[string]any{"sku": sku, "name": name, "price": price})
	assertStatus(t, rr, http.StatusCreated)
	id := int(decodeJSON(t, rr)["data"].(map[string]any)["id"].(float64))

	if stock > 0 {
		rrStock := e.post(t, fmt.Sprintf("/api/products/%d/stock", id), map[string]any{"type": "in", "qty": stock})
		assertStatus(t, rrStock, http.StatusOK)
	}

	t.Cleanup(func() {
		ctx := context.Background()
		e.pool.Exec(ctx, `DELETE FROM sales_order_items WHERE sku = $1`, sku)
		e.pool.Exec(ctx, `DELETE FROM sales_orders WHERE customer LIKE 'TEST%'`)
		e.pool.Exec(ctx, `DELETE FROM stock_movements WHERE product_id IN (SELECT id FROM products WHERE sku = $1)`, sku)
		e.pool.Exec(ctx, `DELETE FROM products WHERE sku = $1`, sku)
	})
	return id
}

func skuStock(t *testing.T, e *testEnv, sku string) int {
	t.Helper()
	var stock int
	if err := e.pool.QueryRow(context.Background(), `SELECT stock FROM products WHERE sku = $1`, sku).Scan(&stock); err != nil {
		t.Fatalf("read stock: %v", err)
	}
	return stock
}

func outMovementCount(t *testing.T, e *testEnv, sku string) int {
	t.Helper()
	var count int
	if err := e.pool.QueryRow(context.Background(), `
		SELECT count(*) FROM stock_movements m
		JOIN products p ON p.id = m.product_id
		WHERE p.sku = $1 AND m.type = 'out'`, sku).Scan(&count); err != nil {
		t.Fatalf("count movements: %v", err)
	}
	return count
}

func testOrderCount(t *testing.T, e *testEnv) int {
	t.Helper()
	var count int
	if err := e.pool.QueryRow(context.Background(),
		`SELECT count(*) FROM sales_orders WHERE customer LIKE 'TEST%'`).Scan(&count); err != nil {
		t.Fatalf("count orders: %v", err)
	}
	return count
}

func TestCreateOrder_Success(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createOrderProduct(t, e, "TEST-ORD-A", "Order Widget A", 150000, 10)
	createOrderProduct(t, e, "TEST-ORD-B", "Order Widget B", 250000, 5)

	rr := e.post(t, "/api/orders", map[string]any{
		"customer": "TEST Customer",
		"items": []map[string]any{
			{"sku": "TEST-ORD-A", "qty": 2},
			{"sku": "TEST-ORD-B", "qty": 1},
		},
	})
	assertStatus(t, rr, http.StatusCreated)
	body := decodeJSON(t, rr)
	data := body["data"].(map[string]any)

	if data["customer"] != "TEST Customer" {
		t.Errorf("unexpected customer: %v", data["customer"])
	}
	if data["status"] != "CREATED" {
		t.Errorf("unexpected status: %v", data["status"])
	}
	
	if data["total"].(float64) != 550000 {
		t.Errorf("expected total=550000, got %v", data["total"])
	}

	items := data["items"].([]any)
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
	first := items[0].(map[string]any)
	if first["sku"] != "TEST-ORD-A" || first["unit_price"].(float64) != 150000 {
		t.Errorf("unexpected first item: %v", first)
	}
	if first["subtotal"].(float64) != 300000 {
		t.Errorf("expected subtotal=300000, got %v", first["subtotal"])
	}
	if first["name"] != "Order Widget A" {
		t.Errorf("unexpected item name: %v", first["name"])
	}
	second := items[1].(map[string]any)
	if second["sku"] != "TEST-ORD-B" || second["subtotal"].(float64) != 250000 {
		t.Errorf("unexpected second item: %v", second)
	}

	if stock := skuStock(t, e, "TEST-ORD-A"); stock != 8 {
		t.Errorf("expected stock=8, got %d", stock)
	}
	if stock := skuStock(t, e, "TEST-ORD-B"); stock != 4 {
		t.Errorf("expected stock=4, got %d", stock)
	}
	if count := outMovementCount(t, e, "TEST-ORD-A"); count != 1 {
		t.Errorf("expected 1 out movement, got %d", count)
	}
}

func TestCreateOrder_KeepsHistoricalPrice(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	productID := createOrderProduct(t, e, "TEST-ORD-PRICE", "Price Widget", 150000, 10)

	rr := e.post(t, "/api/orders", map[string]any{
		"customer": "TEST Price Customer",
		"items":    []map[string]any{{"sku": "TEST-ORD-PRICE", "qty": 2}},
	})
	assertStatus(t, rr, http.StatusCreated)
	orderID := int(decodeJSON(t, rr)["data"].(map[string]any)["id"].(float64))

	rrUp := e.put(t, fmt.Sprintf("/api/products/%d", productID), map[string]any{
		"sku":   "TEST-ORD-PRICE",
		"name":  "Price Widget",
		"price": 990000,
	})
	assertStatus(t, rrUp, http.StatusOK)

	rrGet := e.get(t, fmt.Sprintf("/api/orders/%d", orderID))
	assertStatus(t, rrGet, http.StatusOK)
	item := decodeJSON(t, rrGet)["data"].(map[string]any)["items"].([]any)[0].(map[string]any)
	if item["unit_price"].(float64) != 150000 {
		t.Errorf("expected historical unit_price=150000, got %v", item["unit_price"])
	}
}

func TestCreateOrder_Validation(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createOrderProduct(t, e, "TEST-ORD-VAL", "Validation Widget", 100000, 10)

	cases := []struct {
		name string
		body map[string]any
	}{
		{"empty customer", map[string]any{"customer": "", "items": []map[string]any{{"sku": "TEST-ORD-VAL", "qty": 1}}}},
		{"empty items", map[string]any{"customer": "TEST Customer", "items": []map[string]any{}}},
		{"unknown sku", map[string]any{"customer": "TEST Customer", "items": []map[string]any{{"sku": "TEST-ORD-NOPE", "qty": 1}}}},
		{"duplicate sku", map[string]any{"customer": "TEST Customer", "items": []map[string]any{
			{"sku": "TEST-ORD-VAL", "qty": 1},
			{"sku": "TEST-ORD-VAL", "qty": 2},
		}}},
		{"zero qty", map[string]any{"customer": "TEST Customer", "items": []map[string]any{{"sku": "TEST-ORD-VAL", "qty": 0}}}},
		{"negative qty", map[string]any{"customer": "TEST Customer", "items": []map[string]any{{"sku": "TEST-ORD-VAL", "qty": -2}}}},
		{"empty sku", map[string]any{"customer": "TEST Customer", "items": []map[string]any{{"sku": "", "qty": 1}}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rr := e.post(t, "/api/orders", tc.body)
			assertStatus(t, rr, http.StatusBadRequest)
		})
	}

	rr := e.postRaw(t, "/api/orders", "{not json")
	assertStatus(t, rr, http.StatusBadRequest)

	if count := testOrderCount(t, e); count != 0 {
		t.Errorf("expected no orders created, got %d", count)
	}
	if stock := skuStock(t, e, "TEST-ORD-VAL"); stock != 10 {
		t.Errorf("expected stock unchanged at 10, got %d", stock)
	}
}

func TestCreateOrder_InsufficientStock(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createOrderProduct(t, e, "TEST-ORD-LOW", "Low Stock Widget", 100000, 3)

	rr := e.post(t, "/api/orders", map[string]any{
		"customer": "TEST Customer",
		"items":    []map[string]any{{"sku": "TEST-ORD-LOW", "qty": 5}},
	})
	assertStatus(t, rr, http.StatusConflict)
	body := decodeJSON(t, rr)
	errObj := body["error"].(map[string]any)
	if errObj["code"] != "INSUFFICIENT_STOCK" {
		t.Errorf("expected INSUFFICIENT_STOCK, got %v", errObj["code"])
	}
	if errObj["sku"] != "TEST-ORD-LOW" {
		t.Errorf("expected sku=TEST-ORD-LOW, got %v", errObj["sku"])
	}
	if errObj["available"].(float64) != 3 {
		t.Errorf("expected available=3, got %v", errObj["available"])
	}

	if count := testOrderCount(t, e); count != 0 {
		t.Errorf("expected no order created, got %d", count)
	}
	if stock := skuStock(t, e, "TEST-ORD-LOW"); stock != 3 {
		t.Errorf("expected stock unchanged at 3, got %d", stock)
	}
	if count := outMovementCount(t, e, "TEST-ORD-LOW"); count != 0 {
		t.Errorf("expected no out movement, got %d", count)
	}
}

func TestGetOrder_Success(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createOrderProduct(t, e, "TEST-ORD-GET", "Get Widget", 120000, 10)

	rr := e.post(t, "/api/orders", map[string]any{
		"customer": "TEST Get Customer",
		"items":    []map[string]any{{"sku": "TEST-ORD-GET", "qty": 3}},
	})
	assertStatus(t, rr, http.StatusCreated)
	orderID := int(decodeJSON(t, rr)["data"].(map[string]any)["id"].(float64))

	rrGet := e.get(t, fmt.Sprintf("/api/orders/%d", orderID))
	assertStatus(t, rrGet, http.StatusOK)
	data := decodeJSON(t, rrGet)["data"].(map[string]any)
	if data["total"].(float64) != 360000 {
		t.Errorf("expected total=360000, got %v", data["total"])
	}
	if data["status"] != "CREATED" {
		t.Errorf("unexpected status: %v", data["status"])
	}
	items := data["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	item := items[0].(map[string]any)
	if item["sku"] != "TEST-ORD-GET" || item["qty"].(float64) != 3 {
		t.Errorf("unexpected item: %v", item)
	}
	if item["unit_price"].(float64) != 120000 || item["subtotal"].(float64) != 360000 {
		t.Errorf("unexpected item prices: %v", item)
	}
}

func TestGetOrder_NotFound(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)

	rr := e.get(t, "/api/orders/999999999")
	assertStatus(t, rr, http.StatusNotFound)
	errObj := decodeJSON(t, rr)["error"].(map[string]any)
	if errObj["code"] != "ORDER_NOT_FOUND" {
		t.Errorf("expected ORDER_NOT_FOUND, got %v", errObj["code"])
	}
}

func TestCancelOrder_Success(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createOrderProduct(t, e, "TEST-ORD-CANCEL", "Cancel Widget", 120000, 10)

	rr := e.post(t, "/api/orders", map[string]any{
		"customer": "TEST Cancel Customer",
		"items":    []map[string]any{{"sku": "TEST-ORD-CANCEL", "qty": 4}},
	})
	assertStatus(t, rr, http.StatusCreated)
	orderID := int(decodeJSON(t, rr)["data"].(map[string]any)["id"].(float64))

	rrCancel := e.post(t, fmt.Sprintf("/api/orders/%d/cancel", orderID), map[string]any{})
	assertStatus(t, rrCancel, http.StatusOK)
	data := decodeJSON(t, rrCancel)["data"].(map[string]any)
	if data["status"] != "CANCELLED" {
		t.Errorf("expected status=CANCELLED, got %v", data["status"])
	}
	if data["cancelled_at"] == nil {
		t.Error("expected cancelled_at to be set")
	}
	
	item := data["items"].([]any)[0].(map[string]any)
	if item["unit_price"].(float64) != 120000 {
		t.Errorf("expected unit_price=120000, got %v", item["unit_price"])
	}

	if stock := skuStock(t, e, "TEST-ORD-CANCEL"); stock != 10 {
		t.Errorf("expected stock restored to 10, got %d", stock)
	}

	rrAgain := e.post(t, fmt.Sprintf("/api/orders/%d/cancel", orderID), map[string]any{})
	assertStatus(t, rrAgain, http.StatusConflict)
	errObj := decodeJSON(t, rrAgain)["error"].(map[string]any)
	if errObj["code"] != "ORDER_ALREADY_CANCELLED" {
		t.Errorf("expected ORDER_ALREADY_CANCELLED, got %v", errObj["code"])
	}
	if stock := skuStock(t, e, "TEST-ORD-CANCEL"); stock != 10 {
		t.Errorf("expected stock restored only once, got %d", stock)
	}
}

func TestCancelOrder_NotFound(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)

	rr := e.post(t, "/api/orders/999999999/cancel", map[string]any{})
	assertStatus(t, rr, http.StatusNotFound)
	errObj := decodeJSON(t, rr)["error"].(map[string]any)
	if errObj["code"] != "ORDER_NOT_FOUND" {
		t.Errorf("expected ORDER_NOT_FOUND, got %v", errObj["code"])
	}
}

func TestCreateOrder_RollsBackWhenItemInsertFails(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createOrderProduct(t, e, "TEST-ORD-ITEMFAIL", "Item Fail Widget", 120000, 10)

	ctx := context.Background()
	if _, err := e.pool.Exec(ctx, `
		CREATE OR REPLACE FUNCTION test_block_order_item() RETURNS trigger AS $$
		BEGIN
			RAISE EXCEPTION 'order item insert blocked by test';
		END;
		$$ LANGUAGE plpgsql`); err != nil {
		t.Fatalf("create trigger function: %v", err)
	}
	if _, err := e.pool.Exec(ctx, `
		CREATE TRIGGER test_block_order_item_trigger
		BEFORE INSERT ON sales_order_items
		FOR EACH ROW EXECUTE FUNCTION test_block_order_item()`); err != nil {
		t.Fatalf("create trigger: %v", err)
	}
	t.Cleanup(func() {
		e.pool.Exec(context.Background(), `DROP TRIGGER IF EXISTS test_block_order_item_trigger ON sales_order_items`)
		e.pool.Exec(context.Background(), `DROP FUNCTION IF EXISTS test_block_order_item()`)
	})

	rr := e.post(t, "/api/orders", map[string]any{
		"customer": "TEST Customer",
		"items":    []map[string]any{{"sku": "TEST-ORD-ITEMFAIL", "qty": 2}},
	})
	assertStatus(t, rr, http.StatusInternalServerError)

	if count := testOrderCount(t, e); count != 0 {
		t.Errorf("expected no order created, got %d", count)
	}
	if stock := skuStock(t, e, "TEST-ORD-ITEMFAIL"); stock != 10 {
		t.Errorf("expected stock rolled back to 10, got %d", stock)
	}
	if count := outMovementCount(t, e, "TEST-ORD-ITEMFAIL"); count != 0 {
		t.Errorf("expected no out movement, got %d", count)
	}
}

func TestCreateOrder_RollsBackWhenStockDecrementFails(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createOrderProduct(t, e, "TEST-ORD-STOCKFAIL", "Stock Fail Widget", 120000, 10)

	ctx := context.Background()
	if _, err := e.pool.Exec(ctx, `
		CREATE OR REPLACE FUNCTION test_block_product_update() RETURNS trigger AS $$
		BEGIN
			RAISE EXCEPTION 'product update blocked by test';
		END;
		$$ LANGUAGE plpgsql`); err != nil {
		t.Fatalf("create trigger function: %v", err)
	}
	if _, err := e.pool.Exec(ctx, `
		CREATE TRIGGER test_block_product_update_trigger
		BEFORE UPDATE ON products
		FOR EACH ROW EXECUTE FUNCTION test_block_product_update()`); err != nil {
		t.Fatalf("create trigger: %v", err)
	}
	t.Cleanup(func() {
		e.pool.Exec(context.Background(), `DROP TRIGGER IF EXISTS test_block_product_update_trigger ON products`)
		e.pool.Exec(context.Background(), `DROP FUNCTION IF EXISTS test_block_product_update()`)
	})

	rr := e.post(t, "/api/orders", map[string]any{
		"customer": "TEST Customer",
		"items":    []map[string]any{{"sku": "TEST-ORD-STOCKFAIL", "qty": 2}},
	})
	assertStatus(t, rr, http.StatusInternalServerError)

	if count := testOrderCount(t, e); count != 0 {
		t.Errorf("expected no order created, got %d", count)
	}
	if stock := skuStock(t, e, "TEST-ORD-STOCKFAIL"); stock != 10 {
		t.Errorf("expected stock unchanged at 10, got %d", stock)
	}
}

func TestCreateOrder_ConcurrentSameSku(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createOrderProduct(t, e, "TEST-ORD-CONC", "Concurrent Widget", 120000, 10)

	codes := make([]int, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			rr := e.post(t, "/api/orders", map[string]any{
				"customer": "TEST Concurrent Customer",
				"items":    []map[string]any{{"sku": "TEST-ORD-CONC", "qty": 7}},
			})
			codes[i] = rr.Code
		}(i)
	}
	wg.Wait()

	ok, conflict := 0, 0
	for _, code := range codes {
		switch code {
		case http.StatusCreated:
			ok++
		case http.StatusConflict:
			conflict++
		default:
			t.Errorf("unexpected status %d", code)
		}
	}
	if ok != 1 || conflict != 1 {
		t.Errorf("expected 1 created and 1 conflict, got %d and %d", ok, conflict)
	}
	if stock := skuStock(t, e, "TEST-ORD-CONC"); stock != 3 {
		t.Errorf("expected final stock=3, got %d", stock)
	}
	if count := testOrderCount(t, e); count != 1 {
		t.Errorf("expected exactly 1 order committed, got %d", count)
	}
}

func TestCancelOrder_Concurrent(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createOrderProduct(t, e, "TEST-ORD-CONCCANCEL", "Concurrent Cancel Widget", 120000, 10)

	rr := e.post(t, "/api/orders", map[string]any{
		"customer": "TEST Concurrent Cancel Customer",
		"items":    []map[string]any{{"sku": "TEST-ORD-CONCCANCEL", "qty": 5}},
	})
	assertStatus(t, rr, http.StatusCreated)
	orderID := int(decodeJSON(t, rr)["data"].(map[string]any)["id"].(float64))

	codes := make([]int, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			codes[i] = e.post(t, fmt.Sprintf("/api/orders/%d/cancel", orderID), map[string]any{}).Code
		}(i)
	}
	wg.Wait()

	ok, conflict := 0, 0
	for _, code := range codes {
		switch code {
		case http.StatusOK:
			ok++
		case http.StatusConflict:
			conflict++
		default:
			t.Errorf("unexpected status %d", code)
		}
	}
	if ok != 1 || conflict != 1 {
		t.Errorf("expected 1 cancelled and 1 conflict, got %d and %d", ok, conflict)
	}
	if stock := skuStock(t, e, "TEST-ORD-CONCCANCEL"); stock != 10 {
		t.Errorf("expected stock restored exactly once to 10, got %d", stock)
	}
}
