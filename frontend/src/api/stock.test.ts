import { describe, expect, it, vi } from "vitest";
import { adjustStock, getStockMovements } from "./stock";
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

const movement = {
  id: 223,
  product_id: 13,
  type: "in" as const,
  qty: 10,
  note: "Restock from supplier",
  created_at: "2026-11-24T05:07:28.362550+07:00",
};

describe("stock api", () => {
  it("adjusts stock and returns the new stock and movement", async () => {
    mockedPost.mockResolvedValue({
      data: { success: true, message: "", data: { stock: 58, movement } },
    });

    await expect(
      adjustStock(13, { type: "in", qty: 10, note: "Restock from supplier" }),
    ).resolves.toEqual({ stock: 58, movement });

    expect(mockedPost).toHaveBeenCalledWith("/api/products/13/stock", {
      type: "in",
      qty: 10,
      note: "Restock from supplier",
    });
  });

  it("sends a stock out adjustment without a note", async () => {
    mockedPost.mockResolvedValue({
      data: { success: true, message: "", data: { stock: 3, movement } },
    });

    await expect(adjustStock(13, { type: "out", qty: 5 })).resolves.toEqual({
      stock: 3,
      movement,
    });

    expect(mockedPost).toHaveBeenCalledWith("/api/products/13/stock", {
      type: "out",
      qty: 5,
    });
  });

  it("propagates a failed adjustment", async () => {
    const failure = new Error("Request failed with status 409");
    mockedPost.mockRejectedValue(failure);

    await expect(adjustStock(13, { type: "out", qty: 999 })).rejects.toBe(failure);
  });

  it("reads the movement history", async () => {
    mockedGet.mockResolvedValue({
      data: { success: true, message: "", data: [movement] },
    });

    await expect(getStockMovements(13)).resolves.toEqual([movement]);
    expect(mockedGet).toHaveBeenCalledWith("/api/products/13/movements", {
      signal: undefined,
    });
  });

  it("returns an empty list when there is no history", async () => {
    mockedGet.mockResolvedValue({
      data: { success: true, message: "", data: [] },
    });

    await expect(getStockMovements(13)).resolves.toEqual([]);
  });

  it("propagates a failed history request", async () => {
    const failure = new Error("Request failed with status 404");
    mockedGet.mockRejectedValue(failure);

    await expect(getStockMovements(13)).rejects.toBe(failure);
  });
});
