import { describe, expect, it } from "vitest";
import { validateOrderForm, validateProductForm } from "./validation";

describe("validateProductForm", () => {
  it("rejects an empty sku", () => {
    expect(validateProductForm({ sku: "  ", name: "Mouse", price: "150000" }).sku).toBeDefined();
  });

  it("rejects an empty name", () => {
    expect(validateProductForm({ sku: "SKU-001", name: "", price: "150000" }).name).toBeDefined();
  });

  it("requires a price", () => {
    expect(validateProductForm({ sku: "SKU-001", name: "Mouse", price: "" }).price).toBeDefined();
  });

  it("rejects a negative price", () => {
    expect(validateProductForm({ sku: "SKU-001", name: "Mouse", price: "-1" }).price).toBeDefined();
  });

  it("rejects a decimal price", () => {
    expect(validateProductForm({ sku: "SKU-001", name: "Mouse", price: "150000.50" }).price).toBeDefined();
  });

  it("accepts a valid product", () => {
    expect(validateProductForm({ sku: "SKU-001", name: "Mouse", price: "150000" })).toEqual({});
  });

  it("accepts zero as a price", () => {
    expect(validateProductForm({ sku: "SKU-001", name: "Mouse", price: "0" })).toEqual({});
  });
});

describe("validateOrderForm", () => {
  it("rejects an empty customer", () => {
    const errors = validateOrderForm({
      customer: "  ",
      items: [{ sku: "SKU-001", qty: "1" }],
    });
    expect(errors.customer).toBeDefined();
  });

  it("rejects an order without items", () => {
    const errors = validateOrderForm({ customer: "Rio", items: [] });
    expect(errors.items).toBeDefined();
  });

  it("rejects an item without a selected product", () => {
    const errors = validateOrderForm({
      customer: "Rio",
      items: [{ sku: "", qty: "1" }],
    });
    expect(errors.itemErrors[0]?.sku).toBeDefined();
  });

  it("rejects a duplicate sku", () => {
    const errors = validateOrderForm({
      customer: "Rio",
      items: [
        { sku: "SKU-001", qty: "1" },
        { sku: "SKU-001", qty: "2" },
      ],
    });
    expect(errors.itemErrors[1]?.sku).toBeDefined();
  });

  it("rejects a zero quantity", () => {
    const errors = validateOrderForm({
      customer: "Rio",
      items: [{ sku: "SKU-001", qty: "0" }],
    });
    expect(errors.itemErrors[0]?.qty).toBeDefined();
  });

  it("rejects a negative quantity", () => {
    const errors = validateOrderForm({
      customer: "Rio",
      items: [{ sku: "SKU-001", qty: "-2" }],
    });
    expect(errors.itemErrors[0]?.qty).toBeDefined();
  });

  it("rejects a decimal quantity", () => {
    const errors = validateOrderForm({
      customer: "Rio",
      items: [{ sku: "SKU-001", qty: "1.5" }],
    });
    expect(errors.itemErrors[0]?.qty).toBeDefined();
  });

  it("accepts a valid order", () => {
    const errors = validateOrderForm({
      customer: "Rio",
      items: [
        { sku: "SKU-001", qty: "2" },
        { sku: "SKU-002", qty: "1" },
      ],
    });
    expect(errors).toEqual({ itemErrors: {} });
  });
});
