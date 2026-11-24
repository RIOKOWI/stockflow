
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./DashboardPage";
import { getProducts } from "../api/products";
import type { Product } from "../types/api";

vi.mock("../api/products", () => ({
  getProducts: vi.fn(),
}));

const mockedGetProducts = vi.mocked(getProducts);

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 1,
    sku: "SKU-001",
    name: "iCrystal",
    price: 150000,
    stock: 50,
    is_active: true,
    created_at: "2026-11-23T10:49:45.169696+07:00",
    last_movement_at: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function cardValue(label: string): string {
  return screen.getByText(label).parentElement?.textContent ?? "";
}

describe("DashboardPage", () => {
  it("summarises the products returned by the backend", async () => {
    mockedGetProducts.mockResolvedValue({
      success: true,
      message: "",
      data: [
        makeProduct({ id: 1, stock: 50, price: 150000, is_active: true }),
        makeProduct({
          id: 2,
          sku: "SKU-002",
          name: "Case",
          stock: 5,
          price: 20000,
          is_active: false,
        }),
      ],
      meta: { page: 1, limit: 100, total: 2, total_pages: 1 },
    });

    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText("Total products")).toBeTruthy());
    expect(cardValue("Total products")).toContain("2");
    expect(cardValue("Active products")).toContain("1");
    
    expect(cardValue("Total stock value")).toContain("7.600.000");
    expect(cardValue("Low stock products")).toContain("1");
  });

  it("reads every product page so the summary is not limited to one page", async () => {
    mockedGetProducts.mockImplementation((page = 1) =>
      Promise.resolve({
        success: true,
        message: "",
        data: [makeProduct({ id: page, stock: 1, price: 1000 })],
        meta: { page, limit: 100, total: 200, total_pages: 2 },
      }),
    );

    render(<DashboardPage />);

    await waitFor(() => expect(mockedGetProducts).toHaveBeenCalledTimes(2));
    expect(mockedGetProducts).toHaveBeenCalledWith(1, 100);
    expect(mockedGetProducts).toHaveBeenCalledWith(2, 100);
    expect(cardValue("Total products")).toContain("2");
  });

  it("shows the backend error", async () => {
    mockedGetProducts.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 500,
        data: {
          error: { code: "INTERNAL_SERVER_ERROR", message: "internal server error" },
        },
      },
    });

    render(<DashboardPage />);

    expect(await screen.findByText("internal server error")).toBeTruthy();
  });
});
