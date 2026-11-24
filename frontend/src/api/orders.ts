import api from "./client";
import type {
  CreateOrderRequest,
  Order,
  OrderResponse,
  OrdersResponse,
} from "../types/api";

export async function getOrders(
  page = 1,
  limit = 10,
  search?: string,
  signal?: AbortSignal,
): Promise<OrdersResponse> {
  const response = await api.get<OrdersResponse>("/api/orders", {
    params: { page, limit, ...(search ? { search } : {}) },
    signal,
  });

  return response.data;
}

export async function createOrder(payload: CreateOrderRequest): Promise<Order> {
  const response = await api.post<OrderResponse>("/api/orders", payload);

  return response.data.data;
}

export async function getOrder(
  id: number,
  signal?: AbortSignal,
): Promise<Order> {
  const response = await api.get<OrderResponse>(`/api/orders/${id}`, {
    signal,
  });

  return response.data.data;
}

export async function cancelOrder(id: number): Promise<Order> {
  const response = await api.post<OrderResponse>(`/api/orders/${id}/cancel`);

  return response.data.data;
}
