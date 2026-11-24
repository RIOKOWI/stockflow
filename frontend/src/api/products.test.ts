import { describe, expect, it, vi } from "vitest";
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProducts,
  updateProduct,
} from "./products";
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

describe("getProducts", () => {
  const listProduct = {
    id: 13,
    sku: "SKU-001",
    name: "iCrystal",
    price: 1500000,
    stock: 48,
    is_active: true,
    created_at: "2026-11-23T10:49:45.169696+07:00",
    last_movement_at: null,
  };

  it("reads the products with the pagination parameters", async () => {
    mockedGet.mockResolvedValue({
      data: {
        success: true,
        message: "",
        data: [listProduct],
        meta: { page: 2, limit: 10, total: 1, total_pages: 1 },
      },
    });

    const response = await getProducts(2, 10);

    expect(response.data).toEqual([listProduct]);
    expect(response.meta.total).toBe(1);
    expect(mockedGet).toHaveBeenCalledWith("/api/products", {
      params: { page: 2, limit: 10 },
      signal: undefined,
    });
  });

  it("sends the search term when there is one", async () => {
    mockedGet.mockResolvedValue({
      data: {
        success: true,
        message: "",
        data: [],
        meta: { page: 1, limit: 10, total: 0, total_pages: 1 },
      },
    });

    await getProducts(1, 10, "mouse");

    expect(mockedGet).toHaveBeenCalledWith("/api/products", {
      params: { page: 1, limit: 10, search: "mouse" },
      signal: undefined,
    });
  });

  it("passes the abort signal to the client", async () => {
    mockedGet.mockResolvedValue({
      data: {
        success: true,
        message: "",
        data: [],
        meta: { page: 1, limit: 10, total: 0, total_pages: 1 },
      },
    });

    const controller = new AbortController();
    await getProducts(1, 10, "mouse", controller.signal);

    expect(mockedGet).toHaveBeenCalledWith("/api/products", {
      params: { page: 1, limit: 10, search: "mouse" },
      signal: controller.signal,
    });
  });

  it("returns an empty list without an error", async () => {
    mockedGet.mockResolvedValue({
      data: {
        success: true,
        message: "",
        data: [],
        meta: { page: 1, limit: 10, total: 0, total_pages: 1 },
      },
    });

    const response = await getProducts(1, 10);

    expect(response.data).toEqual([]);
    expect(response.meta.total).toBe(0);
  });

  it("propagates an unexpected server error", async () => {
    const failure = {
      response: {
        status: 500,
        data: { error: { code: "INTERNAL_SERVER_ERROR", message: "boom" } },
      },
    };
    mockedGet.mockRejectedValue(failure);

    await expect(getProducts(1, 10)).rejects.toBe(failure);
  });
});
