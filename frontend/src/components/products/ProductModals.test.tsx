import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DeleteProductDialog from "./DeleteProductDialog";
import ProductFormModal from "./ProductFormModal";
import type { Product } from "../../types/api";

const product: Product = {
  id: 13,
  sku: "SKU-001",
  name: "iCrystal",
  price: 1500000,
  stock: 48,
  is_active: true,
  created_at: "2026-11-23T10:49:45.169696+07:00",
  last_movement_at: null,
};

describe("product modals render", () => {
  it("renders the create form with empty values", () => {
    const markup = renderToStaticMarkup(
      <ProductFormModal onClose={() => {}} onSaved={() => {}} />,
    );

    expect(markup).toContain("New product");
    expect(markup).toContain('name="sku"');
    expect(markup).toContain("Create product");
  });

  it("renders the edit form prefilled with the product values", () => {
    const markup = renderToStaticMarkup(
      <ProductFormModal product={product} onClose={() => {}} onSaved={() => {}} />,
    );

    expect(markup).toContain("Edit product");
    expect(markup).toContain("SKU-001");
    expect(markup).toContain("1500000");
  });

  it("renders the delete dialog identifying the product", () => {
    const markup = renderToStaticMarkup(
      <DeleteProductDialog product={product} onClose={() => {}} onDeleted={() => {}} />,
    );

    expect(markup).toContain("Delete product");
    expect(markup).toContain("SKU-001");
  });
});
