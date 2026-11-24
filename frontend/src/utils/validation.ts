export interface ProductFormValues {
  sku: string;
  name: string;
  price: string;
}

export type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>>;

export function validateProductForm(values: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = {};

  if (!values.sku.trim()) errors.sku = "SKU is required";
  if (!values.name.trim()) errors.name = "Name is required";

  const price = values.price.trim();
  if (!price) {
    errors.price = "Price is required";
  } else if (!/^\d+$/.test(price)) {
    errors.price = "Price must be a whole number in IDR, 0 or more";
  }

  return errors;
}
