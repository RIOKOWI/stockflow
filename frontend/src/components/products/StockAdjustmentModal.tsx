import { useEffect, useRef, useState } from "react";
import { getApiError, getErrorMessage } from "../../api/errors";
import { getProduct } from "../../api/products";
import { adjustStock } from "../../api/stock";
import type {
  Product,
  StockAdjustmentResult,
  StockMovementType,
} from "../../types/api";
import {
  validateStockAdjustment,
  type StockAdjustmentErrors,
} from "../../utils/validation";

interface StockAdjustmentModalProps {
  productId: number;
  onClose: () => void;
  onAdjusted: (result: StockAdjustmentResult) => void;
}

export default function StockAdjustmentModal({
  productId,
  onClose,
  onAdjusted,
}: StockAdjustmentModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [type, setType] = useState<StockMovementType>("in");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<StockAdjustmentErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getProduct(productId, controller.signal).then(
      (data) => setProduct(data),
      () => {
        if (controller.signal.aborted) return;
        setSubmitError("Could not load the product.");
      },
    );

    return () => controller.abort();
  }, [productId]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const clientErrors = validateStockAdjustment({ type, qty });
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    adjustStock(productId, {
      type,
      qty: Number(qty.trim()),
      note: note.trim() || null,
    }).then(
      (result) => {
        setSubmitting(false);
        onAdjusted(result);
      },
      (err: unknown) => {
        setSubmitting(false);
        const apiError = getApiError(err);
        if (apiError?.code === "INSUFFICIENT_STOCK") {
          setSubmitError(
            `Insufficient stock. Available quantity: ${apiError.available ?? 0}.`,
          );
        } else if (apiError) {
          setSubmitError(apiError.message);
        } else {
          setSubmitError(getErrorMessage(err));
        }
      },
    );
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="stock-adjustment-title"
      onClose={onClose}
    >
      <div className="modal-head">
        <h2 id="stock-adjustment-title">Adjust stock</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close stock adjustment"
          disabled={submitting}
        >
          ×
        </button>
      </div>

      {product ? (
        <p className="stock-current">
          {product.sku} · {product.name} — current stock:{" "}
          <strong>{product.stock}</strong> units
        </p>
      ) : (
        <p className="stock-current">Loading current stock…</p>
      )}

      <form className="product-form" onSubmit={handleSubmit} noValidate>
        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}

        <fieldset className="stock-type">
          <legend>Movement type</legend>
          <label htmlFor="stock-type-in">
            <input
              id="stock-type-in"
              type="radio"
              name="type"
              value="in"
              checked={type === "in"}
              onChange={() => setType("in")}
              disabled={submitting}
            />
            Stock in
          </label>
          <label htmlFor="stock-type-out">
            <input
              id="stock-type-out"
              type="radio"
              name="type"
              value="out"
              checked={type === "out"}
              onChange={() => setType("out")}
              disabled={submitting}
            />
            Stock out
          </label>
        </fieldset>

        <label htmlFor="stock-qty">Quantity</label>
        <input
          id="stock-qty"
          name="qty"
          inputMode="numeric"
          value={qty}
          onChange={(event) => setQty(event.target.value)}
          aria-invalid={Boolean(errors.qty)}
          aria-describedby={errors.qty ? "stock-qty-error" : undefined}
          disabled={submitting}
        />
        {errors.qty && (
          <p className="field-error" id="stock-qty-error">
            {errors.qty}
          </p>
        )}

        <label htmlFor="stock-note">Note (optional)</label>
        <input
          id="stock-note"
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={submitting}
        />

        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" className="button" disabled={submitting}>
            {submitting ? "Saving…" : "Adjust stock"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
