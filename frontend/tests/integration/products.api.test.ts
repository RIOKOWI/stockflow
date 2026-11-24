import { describe, expect, it } from "vitest";
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProducts,
  updateProduct,
} from "../../src/api/products";

const SKU = `IT-${Date.now()}`;

const integration = describe.skipIf(import.meta.env.MODE !== "integration");

integration("products api against the real backend", () => {
  it("reads, creates, updates and deletes a product", async () => {
    const created = await createProduct({ sku: SKU, name: "Integration Test", price: 42000 });
    expect(created.sku).toBe(SKU);
    expect(created.stock).toBe(0);
    expect(created.is_active).toBe(true);

    const fetched = await getProduct(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe("Integration Test");

    const updated = await updateProduct(created.id, {
      sku: SKU,
      name: "Integration Test Updated",
      price: 50000,
    });
    expect(updated.name).toBe("Integration Test Updated");
    expect(updated.price).toBe(50000);
    expect(updated.stock).toBe(0);

    await deleteProduct(created.id);

    await expect(getProduct(created.id)).rejects.toMatchObject({
      response: { status: 404 },
    });
  });

  it("rejects a duplicate sku with 409", async () => {
    const created = await createProduct({ sku: SKU, name: "Duplicate", price: 1000 });
    await expect(
      createProduct({ sku: SKU, name: "Duplicate again", price: 1000 }),
    ).rejects.toMatchObject({
      response: { status: 409, data: { error: { code: "PRODUCT_ALREADY_EXISTS" } } },
    });
    await deleteProduct(created.id);
  });

  it("rejects an invalid price with 400", async () => {
    await expect(
      createProduct({ sku: `${SKU}-X`, name: "Invalid", price: -1 }),
    ).rejects.toMatchObject({
      response: { status: 400, data: { error: { code: "VALIDATION_ERROR" } } },
    });
  });

  it("returns 404 for a missing product", async () => {
    await expect(getProduct(99999999)).rejects.toMatchObject({
      response: { status: 404, data: { error: { code: "PRODUCT_NOT_FOUND" } } },
    });
  });

  it("refuses to delete a product that has history", async () => {
    await expect(deleteProduct(1)).rejects.toMatchObject({
      response: { status: 409, data: { error: { code: "PRODUCT_HAS_HISTORY" } } },
    });
  });

  it("paginates the product list", async () => {
    const first = await getProducts(1, 5);
    const second = await getProducts(2, 5);

    expect(first.data.length).toBe(5);
    expect(second.meta.page).toBe(2);
    expect(second.meta.total).toBe(first.meta.total);
    expect(second.meta.total_pages).toBe(Math.ceil(first.meta.total / 5));
    expect(second.data[0].id).not.toBe(first.data[0].id);
  });
});
