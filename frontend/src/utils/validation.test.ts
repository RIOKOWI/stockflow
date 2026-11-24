import { describe, expect, it } from "vitest";
import { validateProductForm } from "./validation";

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
