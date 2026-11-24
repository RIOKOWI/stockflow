import { describe, expect, it, vi } from "vitest";
import { createProduct, deleteProduct, getProduct, updateProduct } from "./products";
import api from "./client";

vi.mock("./client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedGet = vi.mocked(api.get);
const mockedPost = vi.mocked(api.post);
const mockedPut = vi.mocked(api.put);
const mockedDelete = vi.mocked(api.delete);

const product = {
  id: 13,
  sku: "SKU-001",
  name: "iCrystal",
  price: 1500000,
  stock: 48,
  is_active: true,
  created_at: "2026-11-23T10:49:45.169696+07:00",
  last_movement_at: null,
};

describe("products api", () => {
  it("fetches a product by id", async () => {
    mockedGet.mockResolvedValue({ data: { success: true, message: "", data: product } });

    await expect(getProduct(13)).resolves.toEqual(product);
    expect(mockedGet).toHaveBeenCalledWith("/api/products/13", {
      signal: undefined,
    });
  });

  it("creates a product with the given payload", async () => {
    mockedPost.mockResolvedValue({ data: { success: true, message: "", data: product } });

    await expect(
      createProduct({ sku: "SKU-001", name: "iCrystal", price: 1500000 }),
    ).resolves.toEqual(product);
    expect(mockedPost).toHaveBeenCalledWith("/api/products", {
      sku: "SKU-001",
      name: "iCrystal",
      price: 1500000,
    });
  });

  it("updates a product through the product url", async () => {
    mockedPut.mockResolvedValue({ data: { success: true, message: "", data: product } });

    await expect(
      updateProduct(13, { sku: "SKU-001", name: "iCrystal Pro", price: 1750000 }),
    ).resolves.toEqual(product);
    expect(mockedPut).toHaveBeenCalledWith("/api/products/13", {
      sku: "SKU-001",
      name: "iCrystal Pro",
      price: 1750000,
    });
  });

  it("deletes a product and tolerates an empty 204 body", async () => {
    mockedDelete.mockResolvedValue({ data: "" });

    await expect(deleteProduct(13)).resolves.toBeUndefined();
    expect(mockedDelete).toHaveBeenCalledWith("/api/products/13");
  });
});
