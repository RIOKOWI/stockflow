import api from "./client";
import type { ProductsResponse } from "../types/api";

export async function getProducts(
  page = 1,
  limit = 10,
): Promise<ProductsResponse> {
  const response = await api.get<ProductsResponse>("/api/products", {
    params: { page, limit },
  });

  return response.data;
}
