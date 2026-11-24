import { isAxiosError } from "axios";
import type { ApiErrorBody } from "../types/api";

export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
    if (error.code === "ECONNABORTED") return "Request timed out. Please try again.";
    if (!error.response) return "Cannot reach the backend. Is the API running?";
    return `Request failed with status ${error.response.status}.`;
  }
  return "Unexpected error while loading data.";
}
