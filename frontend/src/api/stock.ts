import api from "./client";
import type {
  StockAdjustmentRequest,
  StockAdjustmentResponse,
  StockAdjustmentResult,
  StockMovementsResponse,
  StockMovement,
} from "../types/api";

export async function adjustStock(
  productId: number,
  payload: StockAdjustmentRequest,
): Promise<StockAdjustmentResult> {
  const response = await api.post<StockAdjustmentResponse>(
    `/api/products/${productId}/stock`,
    payload,
  );

  return response.data.data;
}

export async function getStockMovements(
  productId: number,
  signal?: AbortSignal,
): Promise<StockMovement[]> {
  const response = await api.get<StockMovementsResponse>(
    `/api/products/${productId}/movements`,
    { signal },
  );

  return response.data.data;
}
