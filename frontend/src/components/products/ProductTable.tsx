import type { Product } from "../../types/api";
import { formatDate } from "../../utils/date";
import { formatIDR } from "../../utils/currency";

interface ProductTableProps {
  products: Product[];
}

export default function ProductTable({ products }: ProductTableProps) {
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
          <th scope="col">Created At</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id}>
            <td className="numeric">{product.id}</td>
            <td className="sku">{product.sku}</td>
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
            <td>{formatDate(product.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
