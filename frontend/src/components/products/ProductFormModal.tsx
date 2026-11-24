import { useEffect, useRef, useState } from "react";
import { getApiError, getErrorMessage } from "../../api/errors";
import { createProduct, updateProduct } from "../../api/products";
import type { Product } from "../../types/api";
import {
  validateProductForm,
  type ProductFormErrors,
  type ProductFormValues,
} from "../../utils/validation";

interface ProductFormModalProps {
  product?: Product;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

const EMPTY_VALUES: ProductFormValues = { sku: "", name: "", price: "" };

function fieldErrorsFromApi(message: string): ProductFormErrors {
  const text = message.toLowerCase();
  if (text.includes("sku")) return { sku: message };
  if (text.includes("name")) return { name: message };
  if (text.includes("price")) return { price: message };
  return {};
}

export default function ProductFormModal({
  product,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<ProductFormValues>(
    product
      ? { sku: product.sku, name: product.name, price: String(product.price) }
      : EMPTY_VALUES,
  );
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const isEdit = product !== undefined;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const clientErrors = validateProductForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSaving(true);
    setSubmitError(null);

    const payload = {
      sku: values.sku.trim(),
      name: values.name.trim(),
      price: Number(values.price.trim()),
    };

    const request = isEdit
      ? updateProduct(product.id, payload)
      : createProduct(payload);

    request.then(
      (saved) => {
        setSaving(false);
        onSaved(saved);
      },
      (err: unknown) => {
        setSaving(false);
        const apiError = getApiError(err);
        if (apiError) {
          setSubmitError(apiError.message);
          setErrors(fieldErrorsFromApi(apiError.message));
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
      aria-labelledby="product-form-title"
      onClose={onClose}
    >
      <div className="modal-head">
        <h2 id="product-form-title">
          {isEdit ? "Edit product" : "New product"}
        </h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close form"
          disabled={saving}
        >
          ×
        </button>
      </div>

      <form className="product-form" onSubmit={handleSubmit} noValidate>
        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}

        <label htmlFor="product-sku">SKU</label>
        <input
          id="product-sku"
          name="sku"
          value={values.sku}
          onChange={(event) =>
            setValues((current) => ({ ...current, sku: event.target.value }))
          }
          aria-invalid={Boolean(errors.sku)}
          aria-describedby={errors.sku ? "product-sku-error" : undefined}
          disabled={saving}
        />
        {errors.sku && (
          <p className="field-error" id="product-sku-error">
            {errors.sku}
          </p>
        )}

        <label htmlFor="product-name">Name</label>
        <input
          id="product-name"
          name="name"
          value={values.name}
          onChange={(event) =>
            setValues((current) => ({ ...current, name: event.target.value }))
          }
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "product-name-error" : undefined}
          disabled={saving}
        />
        {errors.name && (
          <p className="field-error" id="product-name-error">
            {errors.name}
          </p>
        )}

        <label htmlFor="product-price">Price (IDR)</label>
        <input
          id="product-price"
          name="price"
          inputMode="numeric"
          value={values.price}
          onChange={(event) =>
            setValues((current) => ({ ...current, price: event.target.value }))
          }
          aria-invalid={Boolean(errors.price)}
          aria-describedby={errors.price ? "product-price-error" : undefined}
          disabled={saving}
        />
        {errors.price && (
          <p className="field-error" id="product-price-error">
            {errors.price}
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="button" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
