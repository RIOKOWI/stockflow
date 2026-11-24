import { useEffect, useState } from "react";
import { getApiError, getErrorMessage } from "../api/errors";
import { getOrder } from "../api/orders";
import CancelOrderDialog from "../components/orders/CancelOrderDialog";
import OrderDetail from "../components/orders/OrderDetail";
import type { Order } from "../types/api";

interface OrderDetailPageProps {
  orderId: number;
}

export default function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const [version, setVersion] = useState(0);

  return (
    <section className="orders">
      <header className="products-header">
        <h1>Order #{orderId}</h1>
        <p className="products-meta">
          <a href="#/orders">Back to sales orders</a>
        </p>
      </header>

      <OrderDetailView
        key={`${orderId}:${version}`}
        orderId={orderId}
        onRefresh={() => setVersion((count) => count + 1)}
      />
    </section>
  );
}

interface OrderDetailViewProps {
  orderId: number;
  onRefresh: () => void;
}

function OrderDetailView({ orderId, onRefresh }: OrderDetailViewProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    getOrder(orderId, controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setOrder(data);
        setLoading(false);
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        const apiError = getApiError(err);
        setError(
          apiError?.code === "ORDER_NOT_FOUND"
            ? `Order #${orderId} was not found.`
            : getErrorMessage(err),
        );
        setLoading(false);
      },
    );

    return () => controller.abort();
  }, [orderId]);

  const handleCancelled = () => {
    setConfirming(false);
    
    onRefresh();
  };

  return (
    <>
      {loading && <p className="state">Loading order…</p>}

      {!loading && error && (
        <div className="state state-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={onRefresh}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && order && (
        <OrderDetail order={order} onCancel={() => setConfirming(true)} />
      )}

      {confirming && order && (
        <CancelOrderDialog
          order={order}
          onClose={() => setConfirming(false)}
          onCancelled={handleCancelled}
        />
      )}
    </>
  );
}
