import api from "./client";
import type {
  CreateProductRequest,
  Product,
  ProductResponse,
  ProductsResponse,
  UpdateProductRequest,
} from "../types/api";

export async function getProducts(
  page = 1,
  limit = 10,
): Promise<ProductsResponse> {
  const response = await api.get<ProductsResponse>("/api/products", {
    params: { page, limit },
  });

  return response.data;
}

export async function getProduct(
  id: number,
  signal?: AbortSignal,
): Promise<Product> {
  const response = await api.get<ProductResponse>(`/api/products/${id}`, {
    signal,
  });

  return response.data.data;
}

export async function createProduct(payload: CreateProductRequest): Promise<Product> {
  const response = await api.post<ProductResponse>("/api/products", payload);

  return response.data.data;
}

export async function updateProduct(
  id: number,
  payload: UpdateProductRequest,
): Promise<Product> {
  const response = await api.put<ProductResponse>(`/api/products/${id}`, payload);

  return response.data.data;
}

export async function deleteProduct(id: number): Promise<void> {
  await api.delete(`/api/products/${id}`);
}
