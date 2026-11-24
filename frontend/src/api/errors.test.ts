import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { getApiError, getErrorMessage } from "./errors";

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const response = {
    status,
    statusText: "",
    headers: new AxiosHeaders(),
    data,
    config: { headers: new AxiosHeaders() },
  } as unknown as AxiosResponse;

  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, response);
}

describe("getApiError", () => {
  it("parses an insufficient stock response and keeps sku and available", () => {
    const error = axiosErrorWith(409, {
      error: {
        code: "INSUFFICIENT_STOCK",
        message: "insufficient stock",
        sku: "SKU-001",
        available: 3,
      },
    });

    expect(getApiError(error)).toMatchObject({
      code: "INSUFFICIENT_STOCK",
      message: "insufficient stock",
      sku: "SKU-001",
      available: 3,
      status: 409,
    });
  });

  it("parses a validation error", () => {
    const error = axiosErrorWith(400, {
      error: { code: "VALIDATION_ERROR", message: "price must not be negative" },
    });

    expect(getApiError(error)).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "price must not be negative",
      status: 400,
    });
  });

  it("returns null for a non axios error", () => {
    expect(getApiError(new Error("boom"))).toBeNull();
  });
});

describe("getErrorMessage", () => {
  it("uses the backend message when present", () => {
    expect(
      getErrorMessage(
        axiosErrorWith(409, {
          error: { code: "PRODUCT_HAS_HISTORY", message: "product has stock movement or order history" },
        }),
      ),
    ).toBe("product has stock movement or order history");
  });

  it("falls back to a status message for an unexpected body", () => {
    expect(getErrorMessage(axiosErrorWith(500, "boom"))).toBe(
      "Request failed with status 500.",
    );
  });

  it("falls back to a network message when there is no response", () => {
    const error = new AxiosError("Network Error", "ERR_NETWORK");
    expect(getErrorMessage(error)).toBe("Cannot reach the backend. Is the API running?");
  });

  it("falls back for an unknown error", () => {
    expect(getErrorMessage(new Error("boom"))).toBe(
      "Unexpected error while loading data.",
    );
  });
});
