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

export interface OrderItemValues {
  sku: string;
  qty: string;
}

export interface OrderFormValues {
  customer: string;
  items: OrderItemValues[];
}

export interface OrderItemErrors {
  sku?: string;
  qty?: string;
}

export interface OrderFormErrors {
  customer?: string;
  items?: string;
  itemErrors: Record<number, OrderItemErrors>;
}

export function validateOrderForm(values: OrderFormValues): OrderFormErrors {
  const errors: OrderFormErrors = { itemErrors: {} };

  if (!values.customer.trim()) errors.customer = "Customer is required";
  if (values.items.length === 0) errors.items = "Add at least one item";

  const seen = new Set<string>();
  values.items.forEach((item, index) => {
    const itemErrors: OrderItemErrors = {};

    const sku = item.sku.trim();
    if (!sku) {
      itemErrors.sku = "Select a product";
    } else if (seen.has(sku)) {
      itemErrors.sku = "Duplicate SKU in this order";
    } else {
      seen.add(sku);
    }

    const qty = item.qty.trim();
    if (!qty) {
      itemErrors.qty = "Quantity is required";
    } else if (!/^\d+$/.test(qty) || Number(qty) <= 0) {
      itemErrors.qty = "Quantity must be a whole number greater than zero";
    }

    if (itemErrors.sku || itemErrors.qty) errors.itemErrors[index] = itemErrors;
  });

  return errors;
}
