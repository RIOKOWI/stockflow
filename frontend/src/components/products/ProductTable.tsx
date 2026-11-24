import type { Product } from "../../types/api";
import { formatRelativeTime } from "../../utils/date";
import { formatIDR } from "../../utils/currency";

interface ProductTableProps {
  products: Product[];
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onAdjustStock: (product: Product) => void;
}

export default function ProductTable({
  products,
  onView,
  onEdit,
  onDelete,
  onAdjustStock,
}: ProductTableProps) {
  return (
    <table className="product-table">
      <thead>
        <tr>
          <th scope="col">ID</th>
          <th scope="col">SKU</th>
          <th scope="col">Product Name</th>
          <th scope="col">Price</th>
          <th scope="col">Stock</th>
          <th scope="col">Status</th>
          <th scope="col">Last Movement</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id}>
            <td className="numeric">{product.id}</td>
            <td className="sku">
              <button
                type="button"
                className="link-button"
                onClick={() => onView(product)}
              >
                {product.sku}
              </button>
            </td>
            <td>{product.name}</td>
            <td className="numeric">{formatIDR(product.price)}</td>
            <td className="numeric">{product.stock}</td>
            <td>
              <span
                className={
                  product.is_active ? "badge badge-active" : "badge badge-inactive"
                }
              >
                {product.is_active ? "Active" : "Inactive"}
              </span>
            </td>
            <td>{formatRelativeTime(product.last_movement_at)}</td>
            <td className="actions">
              <button
                type="button"
                className="link-button1"
                onClick={() => onView(product)}
              >
                View
              </button>
              <button
                type="button"
                className="link-button2"
                onClick={() => onEdit(product)}
              >
                Edit
              </button>
              <button
                type="button"
                className="link-button3"
                onClick={() => onAdjustStock(product)}
              >
                Stock
              </button>
              <button
                type="button"
                className="link-button link-danger"
                onClick={() => onDelete(product)}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
