import { useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../../api/errors";
import { getProduct } from "../../api/products";
import type { Product } from "../../types/api";
import { formatIDR } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import StockMovementHistory from "./StockMovementHistory";

interface ProductDetailModalProps {
  productId: number;
  stockVersion: number;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onAdjustStock: (product: Product) => void;
}

type DetailState =
  | { status: "loading" }
  | { status: "success"; product: Product }
  | { status: "error"; message: string };

export default function ProductDetailModal({
  productId,
  stockVersion,
  onClose,
  onEdit,
  onAdjustStock,
}: ProductDetailModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getProduct(productId, controller.signal).then(
      (product) => setState({ status: "success", product }),
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: getErrorMessage(err) });
      },
    );

    return () => controller.abort();
  }, [productId, reload, stockVersion]);

  const retry = () => {
    setState({ status: "loading" });
    setReload((count) => count + 1);
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="product-detail-title"
      onClose={onClose}
    >
      <div className="modal-head">
        <h2 id="product-detail-title">Product detail</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close product detail"
        >
          ×
        </button>
      </div>

      {state.status === "loading" && <p className="state">Loading product…</p>}

      {state.status === "error" && (
        <div className="state state-error" role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {state.status === "success" && (
        <>
          <dl className="detail-list">
            <dt>SKU</dt>
            <dd className="sku">{state.product.sku}</dd>
            <dt>Name</dt>
            <dd>{state.product.name}</dd>
            <dt>Price</dt>
            <dd>{formatIDR(state.product.price)}</dd>
            <dt>Stock</dt>
            <dd>{state.product.stock} units</dd>
            <dt>Status</dt>
            <dd>
              <span
                className={
                  state.product.is_active
                    ? "badge badge-active"
                    : "badge badge-inactive"
                }
              >
                {state.product.is_active ? "Active" : "Inactive"}
              </span>
            </dd>
            <dt>Created at</dt>
            <dd>{formatDate(state.product.created_at)}</dd>
            <dt>Last movement</dt>
            <dd>
              {state.product.last_movement_at
                ? formatDate(state.product.last_movement_at)
                : "No movement"}
            </dd>
          </dl>

          <div className="modal-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => onAdjustStock(state.product)}
            >
              Adjust stock
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => onEdit(state.product)}
            >
              Edit
            </button>
            <button type="button" className="button" onClick={onClose}>
              Close
            </button>
          </div>

          <StockMovementHistory
            productId={productId}
            reloadToken={stockVersion}
          />
        </>
      )}
    </dialog>
  );
}
