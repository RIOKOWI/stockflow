import { useEffect, useState } from "react";
import { getErrorMessage } from "../api/errors";
import { getProducts } from "../api/products";
import DeleteProductDialog from "../components/products/DeleteProductDialog";
import ProductDetailModal from "../components/products/ProductDetailModal";
import ProductFormModal from "../components/products/ProductFormModal";
import ProductTable from "../components/products/ProductTable";
import StockAdjustmentModal from "../components/products/StockAdjustmentModal";
import { useDebounce } from "../hooks/useDebounce";
import type { Product, ProductMeta } from "../types/api";

const LIMIT = 10;

type EditorState = { mode: "create" } | { mode: "edit"; product: Product };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<ProductMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [stockTargetId, setStockTargetId] = useState<number | null>(null);
  const [stockVersion, setStockVersion] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const searching = search !== debouncedSearch;
  type FilterKey = "all" | "active" | "inactive" | "low_stock";
  const [filter, setFilter] = useState<FilterKey>("all");

  function filterParams(key: FilterKey) {
    if (key === "active") return { is_active: true };
    if (key === "inactive") return { is_active: false };
    if (key === "low_stock") return { max_stock: 10 };
    return {};
  }

  useEffect(() => {
    const controller = new AbortController();

    getProducts(
      page,
      LIMIT,
      debouncedSearch || undefined,
      controller.signal,
      filterParams(filter),
    ).then(
      (response) => {
        if (controller.signal.aborted) return;
        if (page > response.meta.total_pages) {
          setPage(response.meta.total_pages);
          return;
        }
        setProducts(response.data);
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
  }, [reload, page, debouncedSearch, filter]);

  const retry = () => {
    setError(null);
    setLoading(true);
    setReload((count) => count + 1);
  };

  const refresh = () => {
    setLoading(true);
    setReload((count) => count + 1);
  };

  const goToPage = (nextPage: number) => {
    setError(null);
    setLoading(true);
    setPage(nextPage);
  };

  const openEditor = (state: EditorState) => {
    setDetailId(null);
    setNotice(null);
    setEditor(state);
  };

  const handleSaved = (product: Product) => {
    setEditor(null);
    setNotice(
      editor?.mode === "edit"
        ? `Product ${product.sku} updated successfully.`
        : `Product ${product.sku} created successfully.`,
    );
    refresh();
  };

  const handleDeleted = () => {
    setDeleteTarget(null);
    setNotice("Product deleted successfully.");
    refresh();
  };

  const handleStockAdjusted = (result: { stock: number }) => {
    setStockTargetId(null);
    setNotice(`Stock updated. New stock: ${result.stock} units.`);
    setStockVersion((version) => version + 1);
    refresh();
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

      <div className="products-toolbar">
        <input
          id="product-search"
          className="search-input"
          type="search"
          aria-label="Search products"
          placeholder="Search products..."
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
          onClick={() => openEditor({ mode: "create" })}
        >
          New product
        </button>
      </div>

      {notice && (
        <p className="state state-success" role="status">
          {notice}
        </p>
      )}

      {loading && <p className="state">Loading products…</p>}

      {!loading && error && (
        <div className="state state-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      <div className="filter-tabs" role="group" aria-label="Filter products">
        {(
          [
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "inactive", label: "Inactive" },
            { key: "low_stock", label: "Low Stock" },
          ] as { key: FilterKey; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`filter-tab${filter === key ? " filter-tab-active" : ""}`}
            aria-pressed={filter === key}
            onClick={() => { setFilter(key); setPage(1); }}
          >
            {label}
          </button>
        ))}
      </div>

      {!loading && !error && products.length === 0 && (
        <p className="state">
          {debouncedSearch
            ? `No products match "${debouncedSearch}".`
            : filter !== "all"
              ? "No products match the current filter."
              : "No products found."}
        </p>
      )}

      {!loading && !error && products.length > 0 && (
        <ProductTable
          products={products}
          onView={(product) => {
            setNotice(null);
            setDetailId(product.id);
          }}
          onEdit={(product) => openEditor({ mode: "edit", product })}
          onDelete={(product) => setDeleteTarget(product)}
          onAdjustStock={(product) => {
            setNotice(null);
            setStockTargetId(product.id);
          }}
        />
      )}

      {!loading && !error && meta && meta.total_pages > 1 && (
        <nav className="pagination" aria-label="Product pages">
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

      {detailId !== null && (
        <ProductDetailModal
          key={detailId}
          productId={detailId}
          stockVersion={stockVersion}
          onClose={() => setDetailId(null)}
          onEdit={(product) => openEditor({ mode: "edit", product })}
          onAdjustStock={(product) => {
            setNotice(null);
            setStockTargetId(product.id);
          }}
        />
      )}

      {stockTargetId !== null && (
        <StockAdjustmentModal
          productId={stockTargetId}
          onClose={() => setStockTargetId(null)}
          onAdjusted={handleStockAdjusted}
        />
      )}

      {editor && (
        <ProductFormModal
          product={editor.mode === "edit" ? editor.product : undefined}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteProductDialog
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </section>
  );
}
