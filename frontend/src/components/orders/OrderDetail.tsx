import type { Order } from "../../types/api";
import { formatIDR } from "../../utils/currency";
import { formatDate } from "../../utils/date";

interface OrderDetailProps {
  order: Order;
  onCancel?: () => void;
}

export default function OrderDetail({ order, onCancel }: OrderDetailProps) {
  const items = order.items ?? [];

  return (
    <div className="order-detail">
      <dl className="detail-list">
        <dt>Order ID</dt>
        <dd>#{order.id}</dd>
        <dt>Customer</dt>
        <dd>{order.customer}</dd>
        <dt>Status</dt>
        <dd>
          <span
            className={
              order.status === "CANCELLED"
                ? "badge badge-cancelled"
                : "badge badge-active"
            }
          >
            {order.status}
          </span>
        </dd>
        <dt>Created</dt>
        <dd>{formatDate(order.created_at)}</dd>
        {order.cancelled_at && (
          <>
            <dt>Cancelled</dt>
            <dd>{formatDate(order.cancelled_at)}</dd>
          </>
        )}
      </dl>

      <table className="product-table order-items-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th className="numeric">Qty</th>
            <th className="numeric">Unit price</th>
            <th className="numeric">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="sku">{item.sku}</td>
              <td>{item.name}</td>
              <td className="numeric">{item.qty}</td>
              <td className="numeric">{formatIDR(item.unit_price)}</td>
              <td className="numeric">{formatIDR(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && <p className="state">This order has no items.</p>}

      <p className="order-total">
        Total: <strong>{formatIDR(order.total)}</strong>
      </p>

      {onCancel && order.status === "CREATED" && (
        <button
          type="button"
          className="button button-danger"
          onClick={onCancel}
        >
          Cancel order
        </button>
      )}
    </div>
  );
}
