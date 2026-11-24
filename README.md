# StockFlow

StockFlow is a mini ERP module for inventory and sales management. It lets a warehouse supervisor manage products, adjust stock, record stock movements, create sales orders (which deduct inventory automatically), and cancel orders (which restores it).

| Layer | Stack |
|---|---|
| Backend | Go 1.26, `chi` router, `pgx/v5` + `pgxpool`, `goose` migrations |
| Database | PostgreSQL 17 (monetary values are plain integers in IDR) |
| Frontend | React 19 + TypeScript, Vite, Axios, Vitest |
| Orchestration | Docker Compose (postgres + backend + nginx-served frontend) |

```
stockflow/
├── backend/          # Go API
│   ├── cmd/api/      # server entrypoint
│   ├── cmd/migrate/  # goose migration runner
│   ├── internal/     # config, database, handler, model, repository, service
│   └── migrations/   # 001..005 SQL (schema + seed)
├── frontend/         # React SPA (dashboard, products, orders)
├── docker-compose.yml
└── .env.example
```

---

## 1. How to Run

### Prerequisites

- Go 1.26+ (`go version`)
- Node.js 20+ and npm
- Docker with Docker Compose (for PostgreSQL, or the whole stack)
- `curl` (Windows: use `curl.exe` or Git Bash)

### Option A — everything in Docker (fastest)

Run from the repository root:

```bash
cp .env.example .env      # optional; the defaults work locally
docker compose up -d
docker compose ps          # wait until postgres and backend are "healthy"
```

Migrations and seed data run automatically when the backend container starts (`/bin/migrate && /bin/api`).

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8080 |
| PostgreSQL | `localhost:5432` (`stockflow` / `stockflow_dev_password`) |

Verify:

```bash
curl http://localhost:8080/healthz     # {"database":"ok","status":"ok"}
curl http://localhost:5173/             # frontend index.html
```

Stop / reset:

```bash
docker compose stop          # stop, keep containers and data
docker compose down          # remove containers, keep the database volume
docker compose down -v       # remove containers AND the database volume
```

Rebuild after a code change (the API URL is compiled into the frontend bundle):

```bash
docker compose up -d --build
```

### Option B — local development

**1. Start PostgreSQL only** (from the repository root):

```bash
docker compose up -d postgres
```

**2. Configure the backend** — `backend/.env` (copy `backend/.env.example`):

```env
APP_PORT=8080

DB_HOST=localhost
DB_PORT=5432
DB_USER=stockflow
DB_PASSWORD=stockflow_dev_password
DB_NAME=stockflow
DB_SSLMODE=disable

FRONTEND_ORIGIN=http://localhost:5173
```

The backend reads `.env` from its **own working directory** (`backend/`), and real environment variables take precedence over the file. Every value has a built-in default, so the file is optional for local work.

> `FRONTEND_ORIGIN` must match the URL the browser uses. Vite serves the dev server on `http://localhost:5173`, but `backend/.env.example` ships `5174` — set it to `5173` (or run Vite on 5174) or every request from the browser will fail the CORS check.

**3. Apply migrations and seed data** (from directory `backend/`):

```bash
go run ./cmd/migrate up       # apply all migrations + seed
go run ./cmd/migrate status   # show applied/pending versions
go run ./cmd/migrate version  # current version
go run ./cmd/migrate down     # roll back the last migration
go run ./cmd/migrate reset    # roll back everything
```

The seed migration (`005_seed_data.sql`) inserts 13 products (`SKU-001` … `SKU-013`, the last one inactive), their initial stock movements, and two sample orders. It is idempotent: re-running `up` does not duplicate records.

**4. Run the backend** (from `backend/`):

```bash
go run ./cmd/api
# server listening port=8080
```

**5. Run the frontend** (from `frontend/`):

```bash
npm install
npm run dev      # http://localhost:5173
```

The frontend calls the API directly from the browser. Point it at the backend with `frontend/.env` (see `frontend/.env.example`):

```env
VITE_API_BASE_URL=http://localhost:8080
```

Other frontend scripts:

```bash
npm run build     # type-check (tsc -b) + production bundle in dist/
npm run preview   # serve the production bundle locally
npm run lint      # eslint
```

### 6. Verify the whole stack

```bash
# backend is up and the database is reachable
curl http://localhost:8080/healthz

# seed data is present
curl "http://localhost:8080/api/products?limit=3"

# open http://localhost:5173 — the dashboard shows live product/order counts
```

### Tests

Backend unit and integration tests (integration tests need PostgreSQL and are skipped unless `INTEGRATION=1`):

```bash
cd backend
go test ./...                # unit only, integration skipped
INTEGRATION=1 go test ./...  # includes DB integration tests
INTEGRATION=1 go test -race ./...
```

The integration tests apply migrations themselves and clean up only the rows they create (`TEST-%` SKUs and `TEST%` customers), so they are safe to run against the local development database.

Frontend tests:

```bash
cd frontend
npm test                  # unit + component tests (Vitest)
npm run test:integration  # real API calls, requires the backend running
```

> The frontend integration tests run in jsdom, which enforces CORS, so the test origin is `http://localhost:5173` (`environmentOptions.jsdom.url` in `frontend/vitest.config.ts`). If you change `FRONTEND_ORIGIN`, change it there too.

---

## 2. API Usage

Base URL: `http://localhost:8080`. All API routes are prefixed with `/api`.

### Conventions

- Request and response bodies are JSON, `snake_case` field names.
- `Content-Type: application/json` is required for requests with a body. No authentication is used (out of scope for this project).
- Money is an integer amount in IDR — no decimals.
- Timestamps are ISO 8601 (`2026-11-24T05:17:07Z`).
- Successful list responses carry pagination metadata; successful single-resource responses carry the resource in `data`.

Success envelope (single resource):

```json
{
  "success": true,
  "message": "Product created successfully",
  "data": { "id": 13, "sku": "SKU-013", "name": "iZen Pro", "price": 1750000, "stock": 0, "is_active": true, "created_at": "2026-11-24T05:00:00Z", "last_movement_at": null }
}
```

Success envelope (list):

```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [],
  "meta": { "page": 1, "limit": 10, "total": 13, "total_pages": 2 }
}
```

Error envelope:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "insufficient stock",
    "sku": "SKU-001",
    "available": 3
  }
}
```

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 404 | `PRODUCT_NOT_FOUND`, `ORDER_NOT_FOUND` |
| 409 | `PRODUCT_ALREADY_EXISTS`, `PRODUCT_HAS_HISTORY`, `INSUFFICIENT_STOCK`, `ORDER_ALREADY_CANCELLED` |
| 500 | `INTERNAL_SERVER_ERROR` |

### Endpoint summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness + database ping |
| GET | `/api/products` | List, search, filter, sort, paginate |
| POST | `/api/products` | Create a product |
| GET | `/api/products/{id}` | Read one product |
| PUT | `/api/products/{id}` | Update a product (and its stock) |
| DELETE | `/api/products/{id}` | Delete a product without history |
| POST | `/api/products/{id}/stock` | Adjust stock in/out |
| GET | `/api/products/{id}/movements` | Stock movement history, newest first |
| GET | `/api/orders` | List orders, search, sort, paginate |
| POST | `/api/orders` | Create a sales order |
| GET | `/api/orders/{id}` | Read one order with its items |
| POST | `/api/orders/{id}/cancel` | Cancel an order and restore stock |

### Health check

```bash
curl http://localhost:8080/healthz
```

```json
{ "status": "ok", "database": "ok" }
```

Returns `503` with `{"status":"degraded","database":"<error>"}` when the database is unreachable.

### Products

#### List products

`GET /api/products`

| Query param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | – | Case-insensitive match on SKU **or** name |
| `page` | int | `1` | Must be ≥ 1 |
| `limit` | int | `10` | 1–100 |
| `min_price` | int | – | Non-negative |
| `max_price` | int | – | Non-negative, ≥ `min_price` |
| `is_active` | bool | – | `true` / `false` |
| `max_stock` | int | – | Non-negative; products with `stock <= max_stock` |
| `sort_by` | string | `id` | `id`, `name`, `price`, `stock`, `created_at` |
| `sort_order` | string | `asc` | `asc` / `desc` |

```bash
curl "http://localhost:8080/api/products?search=zen&min_price=1000000&max_price=2000000&is_active=true&sort_by=price&sort_order=desc&page=1&limit=10"
```

```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [
    {
      "id": 4,
      "sku": "SKU-004",
      "name": "iZen",
      "price": 1750000,
      "stock": 40,
      "is_active": true,
      "created_at": "2026-11-23T10:49:45.169696Z",
      "last_movement_at": "2026-11-23T10:49:45.169696Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "total_pages": 1 }
}
```

`last_movement_at` is the timestamp of the most recent stock movement for that product, or `null` when it has none.

#### Create product

`POST /api/products` — body: `sku` (required, unique), `name` (required), `price` (required, integer ≥ 0). Initial stock is always `0`.

```bash
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{"sku":"SKU-014","name":"iZen Pro","price":1750000}'
```

`201 Created`:

```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": 14,
    "sku": "SKU-014",
    "name": "iZen Pro",
    "price": 1750000,
    "stock": 0,
    "is_active": true,
    "created_at": "2026-11-24T05:10:00Z",
    "last_movement_at": null
  }
}
```

Duplicate SKU -> `409`:

```json
{ "error": { "code": "PRODUCT_ALREADY_EXISTS", "message": "sku already exists" } }
```

#### Read product

```bash
curl http://localhost:8080/api/products/1
```

`404` when the product does not exist:

```json
{ "error": { "code": "PRODUCT_NOT_FOUND", "message": "product not found" } }
```

#### Update product

`PUT /api/products/{id}` — body: `sku`, `name`, `price` (all validated as on create) and optional `stock` (integer ≥ 0). `stock` is a set-to-value field; omitting it leaves the current stock untouched. Changing the stock through this endpoint also writes a stock movement.

```bash
curl -X PUT http://localhost:8080/api/products/14 \
  -H "Content-Type: application/json" \
  -d '{"sku":"SKU-014","name":"iZen Pro","price":1800000,"stock":25}'
```

`200 OK` with the updated product in `data`.

#### Delete product

```bash
curl -i -X DELETE http://localhost:8080/api/products/14
```

`204 No Content` on success. A product that already has stock movements or order items cannot be deleted (`409`), because history must be preserved:

```json
{ "error": { "code": "PRODUCT_HAS_HISTORY", "message": "product has stock movement or order history" } }
```

#### Adjust stock

`POST /api/products/{id}/stock` — body: `type` (`in` or `out`), `qty` (integer > 0), optional `note`.

```bash
curl -X POST http://localhost:8080/api/products/14/stock \
  -H "Content-Type: application/json" \
  -d '{"type":"in","qty":10,"note":"Restock from supplier"}'
```

`200 OK`:

```json
{
  "success": true,
  "message": "Stock updated successfully",
  "data": {
    "stock": 35,
    "movement": {
      "id": 224,
      "product_id": 14,
      "type": "in",
      "qty": 10,
      "note": "Restock from supplier",
      "created_at": "2026-11-24T05:12:00Z"
    }
  }
}
```

Taking more stock than available -> `409`:

```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "insufficient stock", "available": 5 } }
```

#### Stock movement history

`GET /api/products/{id}/movements` — newest first.

```bash
curl http://localhost:8080/api/products/14/movements
```

```json
{
  "success": true,
  "message": "Stock movements retrieved successfully",
  "data": [
    {
      "id": 224,
      "product_id": 14,
      "type": "in",
      "qty": 10,
      "note": "Restock from supplier",
      "created_at": "2026-11-24T05:12:00Z"
    }
  ]
}
```

### Orders

#### List orders

`GET /api/orders`

| Query param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | – | Case-insensitive match on customer name |
| `page` | int | `1` | Must be ≥ 1 |
| `limit` | int | `10` | 1–100 |
| `sort_by` | string | `created_at` | `id`, `customer`, `total`, `status`, `created_at` |
| `sort_order` | string | `desc` | `asc` / `desc` |

```bash
curl "http://localhost:8080/api/orders?search=Metro&sort_by=created_at&sort_order=desc&page=1&limit=10"
```

```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "data": [
    {
      "id": 2,
      "customer": "CV Metro Tech",
      "status": "CREATED",
      "total": 7100000,
      "created_at": "2026-11-23T10:50:00Z",
      "cancelled_at": null
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "total_pages": 1 }
}
```

The list endpoint does not include order items — use the detail endpoint for those.

#### Create sales order

`POST /api/orders` — body: `customer` (required), `items` (required, non-empty; each item is `{ "sku": "...", "qty": 3 }` with `qty > 0` and no duplicate SKUs).

Prices are **never** accepted from the client — unit price and total are read from the database.

```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "PT Sinar Mas Elektronik",
    "items": [
      { "sku": "SKU-001", "qty": 2 },
      { "sku": "SKU-005", "qty": 1 }
    ]
  }'
```

`201 Created`:

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": 3,
    "customer": "PT Sinar Mas Elektronik",
    "status": "CREATED",
    "total": 5200000,
    "created_at": "2026-11-24T05:20:00Z",
    "cancelled_at": null,
    "items": [
      { "id": 7, "order_id": 3, "sku": "SKU-001", "name": "iCrystal", "qty": 2, "unit_price": 1500000, "subtotal": 3000000 },
      { "id": 8, "order_id": 3, "sku": "SKU-005", "name": "Notte Stelle", "qty": 1, "unit_price": 2200000, "subtotal": 2200000 }
    ]
  }
}
```

Stock is deducted as part of the same transaction. If any line cannot be fulfilled, nothing is written at all:

```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "insufficient stock", "sku": "SKU-001", "available": 3 } }
```

Other failures: unknown SKU and inactive product -> `400 VALIDATION_ERROR`; empty customer, empty items, duplicate SKU, non-positive qty -> `400 VALIDATION_ERROR`.

#### Read order detail

```bash
curl http://localhost:8080/api/orders/3
```

Returns the order with its `items` array (each item has `sku`, `name`, `qty`, `unit_price`, `subtotal`). `404` with `ORDER_NOT_FOUND` when it does not exist.

#### Cancel order

```bash
curl -X POST http://localhost:8080/api/orders/3/cancel
```

`200 OK` with the cancelled order (`status: "CANCELLED"`, `cancelled_at` set). Stock is restored and a stock-in movement is recorded for every line, in one transaction.

Cancelling twice -> `409`:

```json
{ "error": { "code": "ORDER_ALREADY_CANCELLED", "message": "order already cancelled" } }
```

---

## 3. Design Decisions

### Layered backend architecture

Request -> `handler` -> `service` -> `repository` -> PostgreSQL.

**Chosen:** because each file/folder taking each responsibility

## 4. What I Would Improve

- Idempotency-Key support on POST /api/orders (retries never double-order).
- GET /api/reports/daily-sales?date= + a summary card.
- Skeleton loading rows, tasteful styling.

## 5. Hours Spent

- 23 november = i spent 8 hours 14 minute
- 24 november = i spent 7 hours 3 minute ++
- total =  i spent 15 hours 17 minute ++