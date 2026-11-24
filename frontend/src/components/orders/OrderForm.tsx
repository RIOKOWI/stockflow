import { useEffect, useState } from "react";
import { getApiError, getErrorMessage } from "../../api/errors";
import { createOrder } from "../../api/orders";
import { getProducts } from "../../api/products";
import type { Order, Product } from "../../types/api";
import { formatIDR } from "../../utils/currency";
import {
  validateOrderForm,
  type OrderFormErrors,
  type OrderItemValues,
} from "../../utils/validation";

const PRODUCT_LIMIT = 100;

interface OrderFormProps {
  onCreated: (order: Order) => void;
}

interface FormItem extends OrderItemValues {
  key: number;
}

export default function OrderForm({ onCreated }: OrderFormProps) {
  const [productsState, setProductsState] = useState<{
    key: number;
    products: Product[];
    error: string | null;
  } | null>(null);
  const [productsVersion, setProductsVersion] = useState(0);

  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState<FormItem[]>([
    { key: 1, sku: "", qty: "" },
  ]);
  const [errors, setErrors] = useState<OrderFormErrors>({ itemErrors: {} });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stockIssue, setStockIssue] = useState<{
    sku: string;
    available: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    getProducts(1, PRODUCT_LIMIT).then(
      (response) => {
        if (!active) return;
        setProductsState({
          key: productsVersion,
          products: response.data.filter((product) => product.is_active),
          error: null,
        });
      },
      (err: unknown) => {
        if (!active) return;
        setProductsState({
          key: productsVersion,
          products: [],
          error: getErrorMessage(err),
        });
      },
    );

    return () => {
      active = false;
    };
  }, [productsVersion]);

  const products =
    productsState?.key === productsVersion ? productsState.products : [];
  const productsError =
    productsState?.key === productsVersion ? productsState.error : null;
  const productsLoading = productsState?.key !== productsVersion;

  const priceOf = (sku: string): number =>
    products.find((product) => product.sku === sku)?.price ?? 0;

  const estimate = items.reduce(
    (sum, item) => sum + priceOf(item.sku) * (Number(item.qty) || 0),
    0,
  );

  const updateItem = (key: number, patch: Partial<OrderItemValues>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        key: current.reduce((max, item) => Math.max(max, item.key), 0) + 1,
        sku: "",
        qty: "",
      },
    ]);
  };

  const removeItem = (key: number) => {
    setItems((current) => current.filter((item) => item.key !== key));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const clientErrors = validateOrderForm({ customer, items });
    setErrors(clientErrors);
    if (
      clientErrors.customer ||
      clientErrors.items ||
      Object.keys(clientErrors.itemErrors).length > 0
    ) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setStockIssue(null);

    createOrder({
      customer: customer.trim(),
      items: items.map((item) => ({
        sku: item.sku.trim(),
        qty: Number(item.qty.trim()),
      })),
    }).then(
      (order) => {
        setSubmitting(false);
        onCreated(order);
      },
      (err: unknown) => {
        setSubmitting(false);
        const apiError = getApiError(err);
        if (apiError?.code === "INSUFFICIENT_STOCK") {
          setStockIssue({
            sku: apiError.sku ?? "",
            available: apiError.available ?? 0,
          });
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
    <form className="order-form" onSubmit={handleSubmit} noValidate>
      <h2>New sales order</h2>

      {submitError && (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      )}

      <label htmlFor="order-customer">Customer</label>
      <input
        id="order-customer"
        name="customer"
        value={customer}
        onChange={(event) => setCustomer(event.target.value)}
        aria-invalid={Boolean(errors.customer)}
        aria-describedby={errors.customer ? "order-customer-error" : undefined}
        disabled={submitting}
      />
      {errors.customer && (
        <p className="field-error" id="order-customer-error">
          {errors.customer}
        </p>
      )}

      <h3>Items</h3>

      {productsLoading && <p className="state">Loading products…</p>}

      {!productsLoading && productsError && (
        <div className="state state-error" role="alert">
          <p>{productsError}</p>
          <button
            type="button"
            onClick={() => setProductsVersion((count) => count + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {!productsLoading && !productsError && products.length === 0 && (
        <p className="state">No active products available.</p>
      )}

      {errors.items && <p className="field-error">{errors.items}</p>}

      <ul className="order-items">
        {items.map((item, index) => {
          const itemErrors = errors.itemErrors[index];
          const selectedSkus = items
            .filter((other) => other.key !== item.key)
            .map((other) => other.sku);
          const short = stockIssue?.sku === item.sku;

          return (
            <li
              key={item.key}
              className={short ? "order-item order-item-short" : "order-item"}
            >
              <label htmlFor={`order-item-${item.key}-sku`}>
                Product {index + 1} 
              </label>
              <br/>
              <select
                id={`order-item-${item.key}-sku`}
                value={item.sku}
                onChange={(event) =>
                  updateItem(item.key, { sku: event.target.value })
                }
                aria-invalid={Boolean(itemErrors?.sku)}
                disabled={submitting}
              >
                <option value="">Select a product</option>
                {products
                  .filter(
                    (product) => !selectedSkus.includes(product.sku),
                  )
                  .map((product) => (
                    <option key={product.id} value={product.sku}>
                      {product.sku} - {product.name} ({product.stock} in stock)
                    </option>
                  ))}
              </select>
              {itemErrors?.sku && (
                <p className="field-error">{itemErrors.sku}</p>
              )}
              <br/>
              <label htmlFor={`order-item-${item.key}-qty`}>Quantity</label>
              <br/>
              <input
                id={`order-item-${item.key}-qty`}
                inputMode="numeric"
                value={item.qty}
                onChange={(event) =>
                  updateItem(item.key, { qty: event.target.value })
                }
                aria-invalid={Boolean(itemErrors?.qty)}
                disabled={submitting}
              />
              {itemErrors?.qty && (
                <p className="field-error">{itemErrors.qty}</p>
              )}

              <p className="order-item-estimate">
                Estimated subtotal: {formatIDR(priceOf(item.sku) * (Number(item.qty) || 0))}
              </p>

              <button
                type="button"
                className="link-button link-danger"
                onClick={() => removeItem(item.key)}
                disabled={submitting}
              >
                Remove item
              </button>
            </li>
          );
        })}
      </ul>

      <div className="order-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={addItem}
          disabled={submitting}
        >
          Add item
        </button>
        <p className="order-estimate">
          Estimated total: <strong>{formatIDR(estimate)}</strong>
        </p>
      </div>

      <div className="modal-actions">
        <button
          type="submit"
          className="button"
          disabled={submitting || productsLoading}
        >
          {submitting ? "Creating order…" : "Create order"}
        </button>
      </div>
    </form>
  );
}
