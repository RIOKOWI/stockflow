package handler_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"

	"github.com/RIOKOWI/stockflow/internal/config"
	"github.com/RIOKOWI/stockflow/internal/database"
	"github.com/RIOKOWI/stockflow/internal/handler"
	"github.com/RIOKOWI/stockflow/internal/repository"
	"github.com/RIOKOWI/stockflow/internal/service"
	"github.com/RIOKOWI/stockflow/migrations"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

type testEnv struct {
	router http.Handler
	pool   *pgxpool.Pool
}

func setupTestEnv(t *testing.T) *testEnv {
	t.Helper()

	cfg, err := config.Load()
	if err != nil {
		t.Skipf("skipping integration test: config error: %v", err)
	}

	ctx := context.Background()
	pool, err := database.Connect(ctx, cfg)
	if err != nil {
		t.Skipf("skipping integration test: db connection failed: %v", err)
	}
	t.Cleanup(pool.Close)

	db, err := sql.Open("pgx", cfg.DSN())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	goose.SetBaseFS(migrations.FS)
	goose.SetDialect("postgres")
	if err := goose.Up(db, "."); err != nil {
		t.Fatalf("migration failed: %v", err)
	}

	pool.Exec(ctx, `DELETE FROM stock_movements WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'TEST-%')`)
	pool.Exec(ctx, `DELETE FROM products WHERE sku LIKE 'TEST-%'`)

	repo := repository.NewProductRepository(pool)
	svc := service.NewProductService(repo)
	h := handler.NewProductHandler(svc)

	r := chi.NewRouter()
	h.RegisterRoutes(r)

	return &testEnv{router: r, pool: pool}
}

func (e *testEnv) post(t *testing.T, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	e.router.ServeHTTP(rr, req)
	return rr
}

func (e *testEnv) get(t *testing.T, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rr := httptest.NewRecorder()
	e.router.ServeHTTP(rr, req)
	return rr
}

func (e *testEnv) put(t *testing.T, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPut, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	e.router.ServeHTTP(rr, req)
	return rr
}

func (e *testEnv) delete(t *testing.T, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodDelete, path, nil)
	rr := httptest.NewRecorder()
	e.router.ServeHTTP(rr, req)
	return rr
}

func (e *testEnv) postRaw(t *testing.T, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	e.router.ServeHTTP(rr, req)
	return rr
}

func decodeJSON(t *testing.T, rr *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&m); err != nil {
		t.Fatalf("decode response: %v\nbody: %s", err, rr.Body.String())
	}
	return m
}

func assertStatus(t *testing.T, rr *httptest.ResponseRecorder, want int) {
	t.Helper()
	if rr.Code != want {
		t.Errorf("status = %d, want %d\nbody: %s", rr.Code, want, rr.Body.String())
	}
}

func createTestProduct(t *testing.T, e *testEnv, sku, name string, price int) int {
	t.Helper()
	rr := e.post(t, "/api/products", map[string]any{"sku": sku, "name": name, "price": price})
	assertStatus(t, rr, http.StatusCreated)
	body := decodeJSON(t, rr)
	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing data field in response: %v", body)
	}
	id := int(data["id"].(float64))
	t.Cleanup(func() {

		e.delete(t, fmt.Sprintf("/api/products/%d", id))
	})
	return id
}

func TestCreateProduct_Success(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)

	rr := e.post(t, "/api/products", map[string]any{
		"sku":   "TEST-CREATE-001",
		"name":  "Test Widget",
		"price": 99000,
	})
	assertStatus(t, rr, http.StatusCreated)
	body := decodeJSON(t, rr)

	if body["success"] != true {
		t.Errorf("expected success=true, got %v", body)
	}
	data := body["data"].(map[string]any)
	if data["sku"] != "TEST-CREATE-001" {
		t.Errorf("unexpected sku: %v", data["sku"])
	}
	if data["price"].(float64) != 99000 {
		t.Errorf("unexpected price: %v", data["price"])
	}
	// Initial stock must default to 0.
	if data["stock"].(float64) != 0 {
		t.Errorf("expected initial stock=0, got %v", data["stock"])
	}
}

func TestCreateProduct_DuplicateSKU(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createTestProduct(t, e, "TEST-DUP-001", "Original", 10000)

	rr := e.post(t, "/api/products", map[string]any{
		"sku":   "TEST-DUP-001",
		"name":  "Duplicate",
		"price": 20000,
	})
	assertStatus(t, rr, http.StatusConflict)
	body := decodeJSON(t, rr)
	errObj := body["error"].(map[string]any)
	if errObj["code"] != "PRODUCT_ALREADY_EXISTS" {
		t.Errorf("expected PRODUCT_ALREADY_EXISTS, got %v", errObj["code"])
	}
}

func TestCreateProduct_InvalidData(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)

	cases := []struct {
		name string
		body map[string]any
	}{
		{"empty SKU", map[string]any{"sku": "", "name": "Widget", "price": 100}},
		{"empty name", map[string]any{"sku": "TEST-INV-X", "name": "", "price": 100}},
		{"negative price", map[string]any{"sku": "TEST-INV-Y", "name": "Widget", "price": -1}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rr := e.post(t, "/api/products", tc.body)
			assertStatus(t, rr, http.StatusBadRequest)
		})
	}
}

func TestListProducts(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createTestProduct(t, e, "TEST-LIST-001", "Alpha Widget", 50000)
	createTestProduct(t, e, "TEST-LIST-002", "Beta Widget", 150000)

	rr := e.get(t, "/api/products?page=1&limit=50")
	assertStatus(t, rr, http.StatusOK)
	body := decodeJSON(t, rr)

	if body["success"] != true {
		t.Errorf("expected success=true, got %v", body)
	}
	meta := body["meta"].(map[string]any)
	if meta["page"].(float64) != 1 {
		t.Errorf("unexpected page: %v", meta["page"])
	}
}

func TestListProducts_Pagination(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)

	for i := 1; i <= 5; i++ {
		createTestProduct(t, e, fmt.Sprintf("TEST-PAGE-%03d", i), fmt.Sprintf("Paginated %d", i), i*10000)
	}

	rr := e.get(t, "/api/products?page=1&limit=2&search=TEST-PAGE")
	assertStatus(t, rr, http.StatusOK)
	body := decodeJSON(t, rr)
	meta := body["meta"].(map[string]any)

	if meta["limit"].(float64) != 2 {
		t.Errorf("expected limit=2, got %v", meta["limit"])
	}
	data := body["data"].([]any)
	if len(data) > 2 {
		t.Errorf("expected at most 2 products, got %d", len(data))
	}
}

func TestListProducts_Search(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createTestProduct(t, e, "TEST-SRCH-001", "Unique Searchable Widget", 30000)
	createTestProduct(t, e, "TEST-SRCH-002", "Another Product", 20000)

	rr := e.get(t, "/api/products?search=Unique+Searchable&page=1&limit=10")
	assertStatus(t, rr, http.StatusOK)
	body := decodeJSON(t, rr)
	meta := body["meta"].(map[string]any)
	total := int(meta["total"].(float64))
	if total < 1 {
		t.Errorf("expected at least 1 result, got %d", total)
	}
}

func TestListProducts_PriceFilter(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createTestProduct(t, e, "TEST-PRICE-LOW", "Cheap Widget", 5000)
	createTestProduct(t, e, "TEST-PRICE-HIGH", "Expensive Widget", 999000)

	rr := e.get(t, "/api/products?min_price=900000&max_price=1000000&page=1&limit=10")
	assertStatus(t, rr, http.StatusOK)
	body := decodeJSON(t, rr)
	data := body["data"].([]any)
	for _, item := range data {
		p := item.(map[string]any)
		price := p["price"].(float64)
		if price < 900000 || price > 1000000 {
			t.Errorf("product price %v out of filter range", price)
		}
	}
}

func TestListProducts_Sorting(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createTestProduct(t, e, "TEST-SORT-A", "Sortable A", 300000)
	createTestProduct(t, e, "TEST-SORT-B", "Sortable B", 100000)

	rr := e.get(t, "/api/products?sort_by=price&sort_order=asc&page=1&limit=100")
	assertStatus(t, rr, http.StatusOK)
	body := decodeJSON(t, rr)
	data := body["data"].([]any)

	var prev float64
	for _, item := range data {
		p := item.(map[string]any)
		price := p["price"].(float64)
		if price < prev {
			t.Errorf("products not sorted asc by price: %.0f < %.0f", price, prev)
			break
		}
		prev = price
	}
}

func TestGetProduct_Success(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	id := createTestProduct(t, e, "TEST-GET-001", "Get Widget", 75000)

	rr := e.get(t, fmt.Sprintf("/api/products/%d", id))
	assertStatus(t, rr, http.StatusOK)
	body := decodeJSON(t, rr)
	data := body["data"].(map[string]any)
	if data["sku"] != "TEST-GET-001" {
		t.Errorf("unexpected sku: %v", data["sku"])
	}
}

func TestGetProduct_NotFound(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)

	rr := e.get(t, "/api/products/999999999")
	assertStatus(t, rr, http.StatusNotFound)
	body := decodeJSON(t, rr)
	errObj := body["error"].(map[string]any)
	if errObj["code"] != "PRODUCT_NOT_FOUND" {
		t.Errorf("expected PRODUCT_NOT_FOUND, got %v", errObj["code"])
	}
}

func TestGetProduct_InvalidID(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)

	rr := e.get(t, "/api/products/not-a-number")
	assertStatus(t, rr, http.StatusBadRequest)
}

func TestUpdateProduct_Success(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	id := createTestProduct(t, e, "TEST-UPD-001", "Original Name", 100000)

	rr := e.put(t, fmt.Sprintf("/api/products/%d", id), map[string]any{
		"sku":   "TEST-UPD-001",
		"name":  "Updated Name",
		"price": 200000,
	})
	assertStatus(t, rr, http.StatusOK)
	body := decodeJSON(t, rr)
	data := body["data"].(map[string]any)
	if data["name"] != "Updated Name" {
		t.Errorf("expected updated name, got %v", data["name"])
	}
	if data["price"].(float64) != 200000 {
		t.Errorf("expected price=200000, got %v", data["price"])
	}
}

func TestUpdateProduct_DuplicateSKU(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	createTestProduct(t, e, "TEST-UPD-SKU-A", "Product A", 50000)
	idB := createTestProduct(t, e, "TEST-UPD-SKU-B", "Product B", 60000)

	rr := e.put(t, fmt.Sprintf("/api/products/%d", idB), map[string]any{
		"sku":   "TEST-UPD-SKU-A",
		"name":  "Product B Updated",
		"price": 60000,
	})
	assertStatus(t, rr, http.StatusConflict)
}

func TestUpdateProduct_NotFound(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)

	rr := e.put(t, "/api/products/999999999", map[string]any{
		"sku":   "TEST-NOTEXIST",
		"name":  "Ghost",
		"price": 10000,
	})
	assertStatus(t, rr, http.StatusNotFound)
}

func TestDeleteProduct_Success(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)

	rr := e.post(t, "/api/products", map[string]any{
		"sku":   "TEST-DEL-001",
		"name":  "Delete Me",
		"price": 10000,
	})
	assertStatus(t, rr, http.StatusCreated)
	body := decodeJSON(t, rr)
	id := int(body["data"].(map[string]any)["id"].(float64))

	rrDel := e.delete(t, fmt.Sprintf("/api/products/%d", id))
	assertStatus(t, rrDel, http.StatusNoContent)

	rrGet := e.get(t, fmt.Sprintf("/api/products/%d", id))
	assertStatus(t, rrGet, http.StatusNotFound)
}

func TestDeleteProduct_HasHistory(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)

	rr := e.get(t, "/api/products?search=SKU-001&page=1&limit=10")
	assertStatus(t, rr, http.StatusOK)
	body := decodeJSON(t, rr)
	data := body["data"].([]any)
	if len(data) == 0 {
		t.Skip("seed product SKU-001 not found; skipping")
	}
	p := data[0].(map[string]any)
	if p["sku"] != "SKU-001" {
		t.Skip("SKU-001 not in result; skipping")
	}
	id := int(p["id"].(float64))

	rrDel := e.delete(t, fmt.Sprintf("/api/products/%d", id))
	assertStatus(t, rrDel, http.StatusConflict)
	delBody := decodeJSON(t, rrDel)
	errObj := delBody["error"].(map[string]any)
	if errObj["code"] != "PRODUCT_HAS_HISTORY" {
		t.Errorf("expected PRODUCT_HAS_HISTORY, got %v", errObj["code"])
	}
}

func createStockProduct(t *testing.T, e *testEnv, sku, name string) int {
	t.Helper()
	id := createTestProduct(t, e, sku, name, 10000)
	t.Cleanup(func() {
		ctx := context.Background()
		e.pool.Exec(ctx, `DELETE FROM stock_movements WHERE product_id = $1`, id)
		e.pool.Exec(ctx, `DELETE FROM products WHERE id = $1`, id)
	})
	return id
}

func stockOf(t *testing.T, e *testEnv, id int) int {
	t.Helper()
	var stock int
	if err := e.pool.QueryRow(context.Background(), `SELECT stock FROM products WHERE id = $1`, id).Scan(&stock); err != nil {
		t.Fatalf("read stock: %v", err)
	}
	return stock
}

func movementCount(t *testing.T, e *testEnv, id int) int {
	t.Helper()
	var count int
	if err := e.pool.QueryRow(context.Background(),
		`SELECT count(*) FROM stock_movements WHERE product_id = $1`, id).Scan(&count); err != nil {
		t.Fatalf("count movements: %v", err)
	}
	return count
}

func TestAdjustStock_StockIn(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	id := createStockProduct(t, e, "TEST-STOCKIN-001", "Stock In Widget")

	rr := e.post(t, fmt.Sprintf("/api/products/%d/stock", id), map[string]any{
		"type": "in",
		"qty":  10,
		"note": "Restock from supplier",
	})
	assertStatus(t, rr, http.StatusOK)
	body := decodeJSON(t, rr)
	data := body["data"].(map[string]any)
	if data["stock"].(float64) != 10 {
		t.Errorf("expected stock=10, got %v", data["stock"])
	}
	movement := data["movement"].(map[string]any)
	if movement["type"] != "in" || movement["qty"].(float64) != 10 {
		t.Errorf("unexpected movement: %v", movement)
	}

	if stock := stockOf(t, e, id); stock != 10 {
		t.Errorf("expected persisted stock=10, got %d", stock)
	}
	if count := movementCount(t, e, id); count != 1 {
		t.Errorf("expected 1 movement, got %d", count)
	}
}

func TestAdjustStock_StockOut(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	id := createStockProduct(t, e, "TEST-STOCKOUT-001", "Stock Out Widget")

	e.post(t, fmt.Sprintf("/api/products/%d/stock", id), map[string]any{"type": "in", "qty": 10})

	rr := e.post(t, fmt.Sprintf("/api/products/%d/stock", id), map[string]any{
		"type": "out",
		"qty":  3,
		"note": "Sample delivery",
	})
	assertStatus(t, rr, http.StatusOK)
	body := decodeJSON(t, rr)
	data := body["data"].(map[string]any)
	if data["stock"].(float64) != 7 {
		t.Errorf("expected stock=7, got %v", data["stock"])
	}

	if stock := stockOf(t, e, id); stock != 7 {
		t.Errorf("expected persisted stock=7, got %d", stock)
	}
	if count := movementCount(t, e, id); count != 2 {
		t.Errorf("expected 2 movements, got %d", count)
	}
}

func TestAdjustStock_InsufficientStock(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	id := createStockProduct(t, e, "TEST-STOCKLOW-001", "Low Stock Widget")

	e.post(t, fmt.Sprintf("/api/products/%d/stock", id), map[string]any{"type": "in", "qty": 5})

	rr := e.post(t, fmt.Sprintf("/api/products/%d/stock", id), map[string]any{"type": "out", "qty": 8})
	assertStatus(t, rr, http.StatusConflict)
	body := decodeJSON(t, rr)
	errObj := body["error"].(map[string]any)
	if errObj["code"] != "INSUFFICIENT_STOCK" {
		t.Errorf("expected INSUFFICIENT_STOCK, got %v", errObj["code"])
	}
	if errObj["available"].(float64) != 5 {
		t.Errorf("expected available=5, got %v", errObj["available"])
	}

	if stock := stockOf(t, e, id); stock != 5 {
		t.Errorf("expected stock unchanged at 5, got %d", stock)
	}
	if count := movementCount(t, e, id); count != 1 {
		t.Errorf("expected no extra movement, got %d", count)
	}
}

func TestAdjustStock_Validation(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	id := createStockProduct(t, e, "TEST-STOCKVAL-001", "Validation Widget")

	cases := []struct {
		name string
		body map[string]any
	}{
		{"zero qty", map[string]any{"type": "in", "qty": 0}},
		{"negative qty", map[string]any{"type": "out", "qty": -5}},
		{"invalid type", map[string]any{"type": "sideways", "qty": 5}},
		{"missing type", map[string]any{"qty": 5}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rr := e.post(t, fmt.Sprintf("/api/products/%d/stock", id), tc.body)
			assertStatus(t, rr, http.StatusBadRequest)
		})
	}

	rr := e.postRaw(t, fmt.Sprintf("/api/products/%d/stock", id), "{not json")
	assertStatus(t, rr, http.StatusBadRequest)

	if stock := stockOf(t, e, id); stock != 0 {
		t.Errorf("expected stock unchanged at 0, got %d", stock)
	}
	if count := movementCount(t, e, id); count != 0 {
		t.Errorf("expected no movements, got %d", count)
	}
}

func TestAdjustStock_ProductNotFound(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)

	rr := e.post(t, "/api/products/999999999/stock", map[string]any{"type": "in", "qty": 5})
	assertStatus(t, rr, http.StatusNotFound)
	body := decodeJSON(t, rr)
	errObj := body["error"].(map[string]any)
	if errObj["code"] != "PRODUCT_NOT_FOUND" {
		t.Errorf("expected PRODUCT_NOT_FOUND, got %v", errObj["code"])
	}
}

func TestListMovements(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	id := createStockProduct(t, e, "TEST-MOVES-001", "Movement Widget")
	other := createStockProduct(t, e, "TEST-MOVES-002", "Other Movement Widget")

	e.post(t, fmt.Sprintf("/api/products/%d/stock", id), map[string]any{"type": "in", "qty": 5, "note": "first"})
	e.post(t, fmt.Sprintf("/api/products/%d/stock", id), map[string]any{"type": "out", "qty": 2, "note": "second"})
	e.post(t, fmt.Sprintf("/api/products/%d/stock", other), map[string]any{"type": "in", "qty": 9, "note": "other product"})

	rr := e.get(t, fmt.Sprintf("/api/products/%d/movements", id))
	assertStatus(t, rr, http.StatusOK)
	body := decodeJSON(t, rr)
	data := body["data"].([]any)
	if len(data) != 2 {
		t.Fatalf("expected 2 movements, got %d", len(data))
	}

	first := data[0].(map[string]any)
	second := data[1].(map[string]any)
	if first["note"] != "second" || second["note"] != "first" {
		t.Errorf("expected newest-first ordering, got %v then %v", first["note"], second["note"])
	}
	for _, item := range data {
		m := item.(map[string]any)
		if m["product_id"].(float64) != float64(id) {
			t.Errorf("movement belongs to another product: %v", m)
		}
	}
}

func TestListMovements_NotFound(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)

	rr := e.get(t, "/api/products/999999999/movements")
	assertStatus(t, rr, http.StatusNotFound)
	body := decodeJSON(t, rr)
	errObj := body["error"].(map[string]any)
	if errObj["code"] != "PRODUCT_NOT_FOUND" {
		t.Errorf("expected PRODUCT_NOT_FOUND, got %v", errObj["code"])
	}
}

func TestAdjustStock_RollsBackWhenMovementInsertFails(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	id := createStockProduct(t, e, "TEST-ROLLBACK-001", "Rollback Widget")

	ctx := context.Background()
	_, err := e.pool.Exec(ctx, `
		CREATE OR REPLACE FUNCTION test_block_movement() RETURNS trigger AS $$
		BEGIN
			RAISE EXCEPTION 'movement insert blocked by test';
		END;
		$$ LANGUAGE plpgsql`)
	if err != nil {
		t.Fatalf("create trigger function: %v", err)
	}
	if _, err := e.pool.Exec(ctx, `
		CREATE TRIGGER test_block_movement_trigger
		BEFORE INSERT ON stock_movements
		FOR EACH ROW EXECUTE FUNCTION test_block_movement()`); err != nil {
		t.Fatalf("create trigger: %v", err)
	}
	t.Cleanup(func() {
		e.pool.Exec(context.Background(), `DROP TRIGGER IF EXISTS test_block_movement_trigger ON stock_movements`)
		e.pool.Exec(context.Background(), `DROP FUNCTION IF EXISTS test_block_movement()`)
	})

	rr := e.post(t, fmt.Sprintf("/api/products/%d/stock", id), map[string]any{"type": "in", "qty": 5})
	assertStatus(t, rr, http.StatusInternalServerError)

	if stock := stockOf(t, e, id); stock != 0 {
		t.Errorf("expected stock rolled back to 0, got %d", stock)
	}
	if count := movementCount(t, e, id); count != 0 {
		t.Errorf("expected no movements, got %d", count)
	}
}

func TestAdjustStock_ConcurrentStockOut(t *testing.T) {
	if os.Getenv("INTEGRATION") == "" {
		t.Skip("set INTEGRATION=1 to run integration tests")
	}
	e := setupTestEnv(t)
	id := createStockProduct(t, e, "TEST-CONCURRENT-001", "Concurrent Widget")

	e.post(t, fmt.Sprintf("/api/products/%d/stock", id), map[string]any{"type": "in", "qty": 5})

	const attempts = 10
	codes := make([]int, attempts)
	var wg sync.WaitGroup
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			rr := e.post(t, fmt.Sprintf("/api/products/%d/stock", id), map[string]any{"type": "out", "qty": 1})
			codes[i] = rr.Code
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
	if ok != 5 || conflict != 5 {
		t.Errorf("expected 5 ok and 5 conflicts, got %d and %d", ok, conflict)
	}
	if stock := stockOf(t, e, id); stock != 0 {
		t.Errorf("expected final stock=0, got %d", stock)
	}
	if count := movementCount(t, e, id); count != 6 {
		t.Errorf("expected 6 movements (1 in + 5 out), got %d", count)
	}
}
