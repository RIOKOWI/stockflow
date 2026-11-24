import { useEffect, useRef, useState } from "react";
import { getApiError, getErrorMessage } from "../../api/errors";
import { deleteProduct } from "../../api/products";
import type { Product } from "../../types/api";

interface DeleteProductDialogProps {
  product: Product;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteProductDialog({
  product,
  onClose,
  onDeleted,
}: DeleteProductDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const handleDelete = () => {
    if (deleting) return;

    setDeleting(true);
    setError(null);

    deleteProduct(product.id).then(
      () => {
        setDeleting(false);
        onDeleted();
      },
      (err: unknown) => {
        setDeleting(false);
        const apiError = getApiError(err);
        setError(
          apiError?.code === "PRODUCT_HAS_HISTORY"
            ? `${apiError.message}. This product has stock movement or order history, so it cannot be deleted.`
            : getErrorMessage(err),
        );
      },
    );
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-narrow"
      aria-labelledby="delete-product-title"
      onClose={onClose}
    >
      <div className="modal-head">
        <h2 id="delete-product-title">Delete product</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
          disabled={deleting}
        >
          ×
        </button>
      </div>

      <p>
        Delete <strong>{product.sku}</strong> - {product.name}? This cannot be
        undone.
      </p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="modal-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onClose}
          disabled={deleting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="button button-danger"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </dialog>
  );
}
