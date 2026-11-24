import { useEffect, useState } from "react";
import { getErrorMessage } from "../api/errors";
import { getProducts } from "../api/products";
import ProductTable from "../components/products/ProductTable";
import type { Product, ProductMeta } from "../types/api";

const PAGE = 1;
const LIMIT = 10;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<ProductMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    getProducts(PAGE, LIMIT).then(
      (response) => {
        if (!active) return;
        setProducts(response.data);
        setMeta(response.meta);
        setLoading(false);
      },
      (err: unknown) => {
        if (!active) return;
        setError(getErrorMessage(err));
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [reload]);

  const retry = () => {
    setError(null);
    setLoading(true);
    setReload((count) => count + 1);
  };

  return (
    <section className="products">
      <header className="products-header">
        <h1>Products</h1>
        {meta && (
          <p className="products-meta">
            Total {meta.total} products &middot; Page {meta.page} of{" "}
            {meta.total_pages}
          </p>
        )}
      </header>

      {loading && <p className="state">Loading products…</p>}

      {!loading && error && (
        <div className="state state-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <p className="state">No products found.</p>
      )}

      {!loading && !error && products.length > 0 && (
        <ProductTable products={products} />
      )}
    </section>
  );
}
