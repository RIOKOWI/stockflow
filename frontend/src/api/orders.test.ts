import { describe, expect, it, vi } from "vitest";
import { cancelOrder, createOrder, getOrder, getOrders } from "./orders";
import api from "./client";
import type { CreateOrderRequest } from "../types/api";

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

const item = {
  id: 35,
  order_id: 27,
  sku: "SKU-001",
  name: "iCrystal",
  qty: 2,
  unit_price: 150000,
  subtotal: 300000,
};

const order = {
  id: 27,
  customer: "Rio Achyar",
  status: "CREATED" as const,
  total: 300000,
  created_at: "2026-11-24T05:17:07.093305+07:00",
  cancelled_at: null,
  items: [item],
};

function apiError(status: number, error: Record<string, unknown>) {
  return { response: { status, data: { error } } };
}

describe("orders api", () => {
  it("creates an order and returns the server calculated order", async () => {
    mockedPost.mockResolvedValue({
      data: { success: true, message: "", data: order },
    });

    await expect(
      createOrder({ customer: "Rio Achyar", items: [{ sku: "SKU-001", qty: 2 }] }),
    ).resolves.toEqual(order);

    expect(mockedPost).toHaveBeenCalledWith("/api/orders", {
      customer: "Rio Achyar",
      items: [{ sku: "SKU-001", qty: 2 }],
    });
  });

  it("does not send prices or a total", async () => {
    mockedPost.mockResolvedValue({
      data: { success: true, message: "", data: order },
    });

    await createOrder({
      customer: "Rio Achyar",
      items: [{ sku: "SKU-001", qty: 2 }],
    });

    const payload = mockedPost.mock.calls[0][1] as CreateOrderRequest;
    expect(payload).not.toHaveProperty("total");
    expect(payload.items[0]).not.toHaveProperty("unit_price");
  });

  it("propagates a validation error", async () => {
    const failure = apiError(400, {
      code: "VALIDATION_ERROR",
      message: "customer is required",
    });
    mockedPost.mockRejectedValue(failure);

    await expect(
      createOrder({ customer: "", items: [{ sku: "SKU-001", qty: 1 }] }),
    ).rejects.toBe(failure);
  });

  it("propagates an insufficient stock error with the sku and available quantity", async () => {
    const failure = apiError(409, {
      code: "INSUFFICIENT_STOCK",
      message: "insufficient stock",
      sku: "SKU-001",
      available: 3,
    });
    mockedPost.mockRejectedValue(failure);

    await expect(
      createOrder({ customer: "Rio", items: [{ sku: "SKU-001", qty: 99 }] }),
    ).rejects.toMatchObject({
      response: {
        status: 409,
        data: {
          error: {
            code: "INSUFFICIENT_STOCK",
            sku: "SKU-001",
            available: 3,
          },
        },
      },
    });
  });

  it("propagates an unexpected server error", async () => {
    const failure = apiError(500, {
      code: "INTERNAL_SERVER_ERROR",
      message: "internal server error",
    });
    mockedPost.mockRejectedValue(failure);

    await expect(
      createOrder({ customer: "Rio", items: [{ sku: "SKU-001", qty: 1 }] }),
    ).rejects.toBe(failure);
  });

  it("reads an order by id", async () => {
    mockedGet.mockResolvedValue({
      data: { success: true, message: "", data: order },
    });

    await expect(getOrder(27)).resolves.toEqual(order);
    expect(mockedGet).toHaveBeenCalledWith("/api/orders/27", {
      signal: undefined,
    });
  });

  it("propagates a missing order", async () => {
    const failure = apiError(404, {
      code: "ORDER_NOT_FOUND",
      message: "order not found",
    });
    mockedGet.mockRejectedValue(failure);

    await expect(getOrder(99999999)).rejects.toMatchObject({
      response: { status: 404, data: { error: { code: "ORDER_NOT_FOUND" } } },
    });
  });

  it("cancels an order and returns the cancelled order", async () => {
    const cancelled = {
      ...order,
      status: "CANCELLED" as const,
      cancelled_at: "2026-11-24T05:17:28.340132+07:00",
    };
    mockedPost.mockResolvedValue({
      data: { success: true, message: "", data: cancelled },
    });

    await expect(cancelOrder(27)).resolves.toEqual(cancelled);
    expect(mockedPost).toHaveBeenCalledWith("/api/orders/27/cancel");
  });

  it("propagates a cancellation conflict", async () => {
    const failure = apiError(409, {
      code: "ORDER_ALREADY_CANCELLED",
      message: "order already cancelled",
    });
    mockedPost.mockRejectedValue(failure);

    await expect(cancelOrder(27)).rejects.toMatchObject({
      response: {
        status: 409,
        data: { error: { code: "ORDER_ALREADY_CANCELLED" } },
      },
    });
  });

  it("propagates a missing order on cancellation", async () => {
    const failure = apiError(404, {
      code: "ORDER_NOT_FOUND",
      message: "order not found",
    });
    mockedPost.mockRejectedValue(failure);

    await expect(cancelOrder(99999999)).rejects.toMatchObject({
      response: { status: 404, data: { error: { code: "ORDER_NOT_FOUND" } } },
    });
  });
});

describe("getOrders", () => {
  const listOrder = {
    id: 27,
    customer: "Rio Achyar",
    status: "CREATED" as const,
    total: 300000,
    created_at: "2026-11-24T05:17:07.093305+07:00",
    cancelled_at: null,
  };

  it("reads the orders with the pagination parameters", async () => {
    mockedGet.mockResolvedValue({
      data: {
        success: true,
        message: "",
        data: [listOrder],
        meta: { page: 2, limit: 10, total: 1, total_pages: 1 },
      },
    });

    const response = await getOrders(2, 10);

    expect(response.data).toEqual([listOrder]);
    expect(response.meta.total).toBe(1);
    expect(mockedGet).toHaveBeenCalledWith("/api/orders", {
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

    await getOrders(1, 10, "Rio");

    expect(mockedGet).toHaveBeenCalledWith("/api/orders", {
      params: { page: 1, limit: 10, search: "Rio" },
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
    await getOrders(1, 10, "Rio", controller.signal);

    expect(mockedGet).toHaveBeenCalledWith("/api/orders", {
      params: { page: 1, limit: 10, search: "Rio" },
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

    const response = await getOrders(1, 10);

    expect(response.data).toEqual([]);
    expect(response.meta.total).toBe(0);
  });

  it("propagates a validation error for invalid pagination", async () => {
    const failure = apiError(400, {
      code: "VALIDATION_ERROR",
      message: "page must be a positive integer",
    });
    mockedGet.mockRejectedValue(failure);

    await expect(getOrders(0, 10)).rejects.toBe(failure);
  });

  it("propagates an unexpected server error", async () => {
    const failure = apiError(500, {
      code: "INTERNAL_SERVER_ERROR",
      message: "internal server error",
    });
    mockedGet.mockRejectedValue(failure);

    await expect(getOrders(1, 10)).rejects.toBe(failure);
  });
});
