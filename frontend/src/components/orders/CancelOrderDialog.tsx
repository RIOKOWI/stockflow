import { useEffect, useRef, useState } from "react";
import { getApiError, getErrorMessage } from "../../api/errors";
import { cancelOrder } from "../../api/orders";
import type { Order } from "../../types/api";
import { formatIDR } from "../../utils/currency";

interface CancelOrderDialogProps {
  order: Order;
  onClose: () => void;
  onCancelled: (order: Order) => void;
}

export default function CancelOrderDialog({
  order,
  onClose,
  onCancelled,
}: CancelOrderDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open && typeof dialog.showModal === "function") {
      dialog.showModal();
    }
  }, []);

  const handleCancel = () => {
    if (cancelling) return;

    setCancelling(true);
    setError(null);

    cancelOrder(order.id).then(
      (cancelled) => {
        setCancelling(false);
        onCancelled(cancelled);
      },
      (err: unknown) => {
        setCancelling(false);
        const apiError = getApiError(err);
        setError(
          apiError?.code === "ORDER_ALREADY_CANCELLED"
            ? "This order is already cancelled."
            : getErrorMessage(err),
        );
      },
    );
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-narrow"
      aria-labelledby="cancel-order-title"
      onClose={onClose}
    >
      <div className="modal-head">
        <h2 id="cancel-order-title">Cancel order</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
          disabled={cancelling}
        >
          ×
        </button>
      </div>

      <p>
        Cancel order <strong>#{order.id}</strong> for {order.customer} (
        {formatIDR(order.total)})? Cancelling restores the stock of every item
        in this order.
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
          disabled={cancelling}
        >
          Keep order
        </button>
        <button
          type="button"
          className="button button-danger"
          onClick={handleCancel}
          disabled={cancelling}
        >
          {cancelling ? "Cancelling…" : "Cancel order"}
        </button>
      </div>
    </dialog>
  );
}
