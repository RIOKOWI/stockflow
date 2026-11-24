import { useEffect, useState } from "react";
import { getErrorMessage } from "../api/errors";
import { getOrders } from "../api/orders";
import CreateOrderDialog from "../components/orders/CreateOrderDialog";
import { useDebounce } from "../hooks/useDebounce";
import type { Order, OrderMeta } from "../types/api";
import { formatIDR } from "../utils/currency";
import { formatDate } from "../utils/date";
import { navigate } from "../utils/router";

const LIMIT = 10;

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<OrderMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  
  const searching = search !== debouncedSearch;

  useEffect(() => {
    const controller = new AbortController();

    getOrders(
      page,
      LIMIT,
      debouncedSearch || undefined,
      controller.signal,
    ).then(
      (response) => {
        if (controller.signal.aborted) return;
        
        if (page > response.meta.total_pages) {
          setPage(response.meta.total_pages);
          return;
        }
        setOrders(response.data);
        setMeta(response.meta);
        setLoading(false);
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setError(getErrorMessage(err));
        setLoading(false);
      },
    );

    
    return () => controller.abort();
  }, [reload, page, debouncedSearch]);

  const retry = () => {
    setError(null);
    setLoading(true);
    setReload((count) => count + 1);
  };

  const goToPage = (nextPage: number) => {
    setError(null);
    setLoading(true);
    setPage(nextPage);
  };

  const handleCreated = (order: Order) => {
    setCreating(false);
    setNotice(`Order #${order.id} created successfully.`);
    setLoading(true);
    setReload((count) => count + 1);
  };

  return (
    <section className="orders">
      <header className="products-header">
        <h1>Sales orders</h1>
        {meta && (
          <p className="products-meta">
            Total {meta.total} orders &middot; Page {meta.page} of{" "}
            {meta.total_pages}
          </p>
        )}
      </header>

      <div className="products-toolbar">
        <input
          id="order-search"
          className="search-input"
          type="search"
          aria-label="Search orders"
          placeholder="Search orders..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
            setError(null);
          }}
        />
        {searching && (
          <span className="search-status" role="status">
            Searching…
          </span>
        )}
        <button
          type="button"
          className="button"
          onClick={() => {
            setNotice(null);
            setCreating(true);
          }}
        >
          Create order
        </button>
      </div>

      {notice && (
        <p className="state state-success" role="status">
          {notice}
        </p>
      )}

      {loading && <p className="state">Loading orders…</p>}

      {!loading && error && (
        <div className="state state-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <p className="state">
          {debouncedSearch
            ? `No orders match "${debouncedSearch}".`
            : "No orders found."}
        </p>
      )}

      {!loading && !error && orders.length > 0 && (
        <table className="product-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Total</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="sku">#{order.id}</td>
                <td>{order.customer}</td>
                <td>
                  <span
                    className={
                      order.status === "CANCELLED"
                        ? "badge badge-cancelled"
                        : "badge badge-active"
                    }
                  >
                    {order.status}
                  </span>
                </td>
                <td className="numeric">{formatIDR(order.total)}</td>
                <td>{formatDate(order.created_at)}</td>
                <td>
                  <div className="actions">
                    <button
                      type="button"
                      className="link-button1"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !error && meta && meta.total_pages > 1 && (
        <nav className="pagination" aria-label="Order pages">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </button>
          <span className="pagination-status">
            Page {meta.page} of {meta.total_pages}
          </span>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => goToPage(page + 1)}
            disabled={page >= meta.total_pages}
          >
            Next
          </button>
        </nav>
      )}

      {creating && (
        <CreateOrderDialog
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}
    </section>
  );
}
