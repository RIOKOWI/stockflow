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

export interface StockAdjustmentValues {
  type: "in" | "out";
  qty: string;
}

export type StockAdjustmentErrors = Partial<
  Record<keyof StockAdjustmentValues, string>
>;

export function validateStockAdjustment(
  values: StockAdjustmentValues,
): StockAdjustmentErrors {
  const errors: StockAdjustmentErrors = {};

  if (values.type !== "in" && values.type !== "out") {
    errors.type = "Type must be in or out";
  }

  const qty = values.qty.trim();
  if (!qty) {
    errors.qty = "Quantity is required";
  } else if (!/^\d+$/.test(qty) || Number(qty) <= 0) {
    errors.qty = "Quantity must be a whole number greater than zero";
  }

  return errors;
}
