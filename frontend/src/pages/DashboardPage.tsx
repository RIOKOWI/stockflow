import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "../api/errors";
import { getProducts } from "../api/products";
import type { Product } from "../types/api";
import { formatIDR } from "../utils/currency";

const LIMIT = 100;
const LOW_STOCK_THRESHOLD = 10;

async function loadAllProducts(): Promise<Product[]> {
  const first = await getProducts(1, LIMIT);
  const pages = Math.max(first.meta.total_pages, 1);
  if (pages === 1) return first.data;

  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      getProducts(index + 2, LIMIT),
    ),
  );

  return [first.data, ...rest.map((response) => response.data)].flat();
}

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;

    loadAllProducts().then(
      (data) => {
        if (!active) return;
        setProducts(data);
      },
      (err: unknown) => {
        if (!active) return;
        setError(getErrorMessage(err));
      },
    );

    return () => {
      active = false;
    };
  }, [reload]);

  const summary = useMemo(() => {
    const list = products ?? [];
    return {
      total: list.length,
      active: list.filter((product) => product.is_active).length,
      stockValue: list.reduce(
        (sum, product) => sum + product.stock * product.price,
        0,
      ),
      lowStock: list.filter(
        (product) => product.stock <= LOW_STOCK_THRESHOLD,
      ).length,
    };
  }, [products]);

  return (
    <section className="dashboard">
      <header className="products-header">
        <h1>Dashboard</h1>
        <p className="products-meta">Inventory summary from the live product data.</p>
      </header>

      {error && (
        <div className="state state-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setReload((count) => count + 1)}>
            Retry
          </button>
        </div>
      )}

      {!error && products === null && <p className="state">Loading summary…</p>}

      {!error && products !== null && (
        <div className="summary-cards">
          <div className="summary-card">
            <span className="summary-label">Total products</span>
            <strong className="summary-value">{summary.total}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Active products</span>
            <strong className="summary-value">{summary.active}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total stock value</span>
            <strong className="summary-value">
              {formatIDR(summary.stockValue)}
            </strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Low stock products</span>
            <strong className="summary-value">{summary.lowStock}</strong>
          </div>
        </div>
      )}
    </section>
  );
}
