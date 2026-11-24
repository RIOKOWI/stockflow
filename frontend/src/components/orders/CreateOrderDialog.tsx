import { useEffect, useRef } from "react";
import type { Order } from "../../types/api";
import OrderForm from "./OrderForm";

interface CreateOrderDialogProps {
  onClose: () => void;
  onCreated: (order: Order) => void;
}

export default function CreateOrderDialog({
  onClose,
  onCreated,
}: CreateOrderDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-wide"
      aria-labelledby="create-order-title"
      onClose={onClose}
    >
      <div className="modal-head">
        <h2 id="create-order-title">Create order</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close form"
        >
          ×
        </button>
      </div>

      <OrderForm onCreated={onCreated} />
    </dialog>
  );
}
