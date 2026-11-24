import { isAxiosError } from "axios";
import type { ApiErrorBody } from "../types/api";

export interface ApiError {
  code: string;
  message: string;
  status: number;
  available?: number;
  sku?: string;
}

export function getApiError(error: unknown): ApiError | null {
  if (!isAxiosError(error)) return null;

  const body = error.response?.data as ApiErrorBody | undefined;
  if (body?.error) {
    return {
      code: body.error.code,
      message: body.error.message,
      status: error.response?.status ?? 0,
      available: body.error.available,
      sku: body.error.sku,
    };
  }

  return null;
}

export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const apiError = getApiError(error);
    if (apiError) return apiError.message;
    if (error.code === "ECONNABORTED") return "Request timed out. Please try again.";
    if (!error.response) return "Cannot reach the backend. Is the API running?";
    return `Request failed with status ${error.response.status}.`;
  }
  return "Unexpected error while loading data.";
}
