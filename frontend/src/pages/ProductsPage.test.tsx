
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProductsPage from "./ProductsPage";
import { getProducts } from "../api/products";
import type { Product, ProductMeta } from "../types/api";

vi.mock("../api/products", () => ({
  getProducts: vi.fn(),
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

const mockedGetProducts = vi.mocked(getProducts);

const product: Product = {
  id: 13,
  sku: "SKU-001",
  name: "Wireless Mouse",
  price: 150000,
  stock: 48,
  is_active: true,
  created_at: "2026-11-23T10:49:45.169696+07:00",
  last_movement_at: null,
};

function listResponse(
  products: Product[],
  meta?: Partial<ProductMeta>,
): Awaited<ReturnType<typeof getProducts>> {
  return {
    success: true,
    message: "",
    data: products,
    meta: {
      page: 1,
      limit: 10,
      total: products.length,
      total_pages: 1,
      ...meta,
    },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProductsPage search", () => {
  it("renders a search field next to the new product button", async () => {
    mockedGetProducts.mockResolvedValue(listResponse([product]));

    render(<ProductsPage />);
    await screen.findByText("Wireless Mouse");

    const search = screen.getByLabelText("Search products");
    expect(search.getAttribute("placeholder")).toBe("Search products...");
    expect(screen.getByRole("button", { name: "New product" })).toBeTruthy();
  });

  it("does not request on every keystroke and debounces the search term", async () => {
    mockedGetProducts.mockResolvedValue(listResponse([product]));

    render(<ProductsPage />);
    await screen.findByText("Wireless Mouse");

    mockedGetProducts.mockClear();
    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "mouse" },
    });

    expect(mockedGetProducts).not.toHaveBeenCalled();

    await waitFor(
      () =>
        expect(mockedGetProducts).toHaveBeenCalledWith(
          1,
          10,
          "mouse",
          expect.any(AbortSignal),
        ),
      { timeout: 2000 },
    );
  });

  it("shows the matching products returned by the backend", async () => {
    mockedGetProducts.mockResolvedValue(listResponse([product]));

    render(<ProductsPage />);
    await screen.findByText("Wireless Mouse");

    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "mouse" },
    });

    await waitFor(
      () =>
        expect(mockedGetProducts).toHaveBeenCalledWith(
          1,
          10,
          "mouse",
          expect.any(AbortSignal),
        ),
      { timeout: 2000 },
    );
    expect(screen.getByText("Wireless Mouse")).toBeTruthy();
  });

  it("shows a search specific empty state when nothing matches", async () => {
    mockedGetProducts.mockResolvedValue(listResponse([]));

    render(<ProductsPage />);
    await screen.findByText("No products found.");

    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "nothing" },
    });

    expect(
      await screen.findByText('No products match "nothing".'),
    ).toBeTruthy();
  });

  it("returns to the plain list when the search term is cleared", async () => {
    mockedGetProducts.mockResolvedValue(listResponse([product]));

    render(<ProductsPage />);
    await screen.findByText("Wireless Mouse");

    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "mouse" },
    });
    await waitFor(
      () =>
        expect(mockedGetProducts).toHaveBeenCalledWith(
          1,
          10,
          "mouse",
          expect.any(AbortSignal),
        ),
      { timeout: 2000 },
    );

    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "" },
    });

    await waitFor(
      () =>
        expect(mockedGetProducts).toHaveBeenCalledWith(
          1,
          10,
          undefined,
          expect.any(AbortSignal),
        ),
      { timeout: 2000 },
    );
  });
});
