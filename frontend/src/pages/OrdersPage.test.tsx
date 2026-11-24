
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrdersPage from "./OrdersPage";
import { createOrder, getOrders } from "../api/orders";
import { getProducts } from "../api/products";
import type { Order, OrderMeta, Product } from "../types/api";
import { navigate } from "../utils/router";

vi.mock("../api/orders", () => ({
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  getOrders: vi.fn(),
  cancelOrder: vi.fn(),
}));

vi.mock("../api/products", () => ({
  getProducts: vi.fn(),
}));

vi.mock("../utils/router", () => ({
  navigate: vi.fn(),
}));

const mockedCreateOrder = vi.mocked(createOrder);
const mockedGetOrders = vi.mocked(getOrders);
const mockedGetProducts = vi.mocked(getProducts);
const mockedNavigate = vi.mocked(navigate);

const product: Product = {
  id: 13,
  sku: "SKU-001",
  name: "iCrystal",
  price: 150000,
  stock: 48,
  is_active: true,
  created_at: "2026-11-23T10:49:45.169696+07:00",
  last_movement_at: null,
};

const order: Order = {
  id: 27,
  customer: "Rio Achyar",
  status: "CREATED",
  total: 300000,
  created_at: "2026-11-24T05:17:07.093305+07:00",
  cancelled_at: null,
};

const cancelledOrder: Order = {
  ...order,
  id: 28,
  customer: "Sari Wijaya",
  status: "CANCELLED",
  cancelled_at: "2026-11-24T06:00:00.000000+07:00",
};

function listResponse(
  orders: Order[],
  meta?: Partial<OrderMeta>,
): Awaited<ReturnType<typeof getOrders>> {
  return {
    success: true,
    message: "",
    data: orders,
    meta: {
      page: 1,
      limit: 10,
      total: orders.length,
      total_pages: 1,
      ...meta,
    },
  };
}

function apiFailure(status: number, error: Record<string, unknown>) {
  return {
    isAxiosError: true,
    response: { status, data: { error } },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OrdersPage", () => {
  it("renders the orders returned by the backend", async () => {
    mockedGetOrders.mockResolvedValue(listResponse([order, cancelledOrder]));

    render(<OrdersPage />);

    expect(await screen.findByText("Rio Achyar")).toBeTruthy();
    expect(screen.getByText("Sari Wijaya")).toBeTruthy();
    expect(screen.getByText("#27")).toBeTruthy();
    expect(screen.getByText("CREATED")).toBeTruthy();
    expect(screen.getByText("CANCELLED")).toBeTruthy();
    expect(screen.getAllByText(/300[.\s]?000/).length).toBe(2);
    expect(screen.getByText(/Total 2 orders/)).toBeTruthy();
  });

  it("shows a loading state while the orders are fetched", () => {
    mockedGetOrders.mockReturnValue(
      new Promise<Awaited<ReturnType<typeof getOrders>>>(() => {}),
    );

    render(<OrdersPage />);

    expect(screen.getByText("Loading orders…")).toBeTruthy();
  });

  it("shows an empty state when there are no orders", async () => {
    mockedGetOrders.mockResolvedValue(listResponse([]));

    render(<OrdersPage />);

    expect(await screen.findByText("No orders found.")).toBeTruthy();
  });

  it("shows the backend error and retries on demand", async () => {
    mockedGetOrders.mockRejectedValue(
      apiFailure(500, {
        code: "INTERNAL_SERVER_ERROR",
        message: "internal server error",
      }),
    );

    render(<OrdersPage />);

    expect(await screen.findByText("internal server error")).toBeTruthy();

    mockedGetOrders.mockResolvedValue(listResponse([order]));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Rio Achyar")).toBeTruthy();
  });

  it("navigates to the order detail when the view action is used", async () => {
    mockedGetOrders.mockResolvedValue(listResponse([order]));

    render(<OrdersPage />);
    await screen.findByText("Rio Achyar");

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(mockedNavigate).toHaveBeenCalledWith("/orders/27");
  });

  it("opens the existing order form when the create order button is used", async () => {
    mockedGetOrders.mockResolvedValue(listResponse([]));
    mockedGetProducts.mockResolvedValue({
      success: true,
      message: "",
      data: [product],
      meta: { page: 1, limit: 100, total: 1, total_pages: 1 },
    });

    render(<OrdersPage />);
    await screen.findByText("No orders found.");

    fireEvent.click(screen.getByRole("button", { name: "Create order" }));

    expect(screen.getByLabelText("Customer")).toBeTruthy();
    expect(await screen.findByRole("option", { name: /SKU-001/ })).toBeTruthy();
  });

  it("refreshes the order list after a successful creation", async () => {
    mockedGetOrders.mockResolvedValue(listResponse([order]));
    mockedGetProducts.mockResolvedValue({
      success: true,
      message: "",
      data: [product],
      meta: { page: 1, limit: 100, total: 1, total_pages: 1 },
    });
    mockedCreateOrder.mockResolvedValue({ ...order, id: 29 });

    render(<OrdersPage />);
    await screen.findByText("Rio Achyar");

    fireEvent.click(screen.getByRole("button", { name: "Create order" }));
    await screen.findByRole("option", { name: /SKU-001/ });

    fireEvent.change(screen.getByLabelText("Customer"), {
      target: { value: "Rio Achyar" },
    });
    fireEvent.change(screen.getByLabelText("Product 1"), {
      target: { value: "SKU-001" },
    });
    fireEvent.change(screen.getByLabelText("Quantity"), {
      target: { value: "2" },
    });

    const buttons = screen.getAllByRole("button", { name: "Create order" });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() =>
      expect(mockedCreateOrder).toHaveBeenCalledWith({
        customer: "Rio Achyar",
        items: [{ sku: "SKU-001", qty: 2 }],
      }),
    );
    expect(
      await screen.findByText("Order #29 created successfully."),
    ).toBeTruthy();
    await waitFor(() => expect(mockedGetOrders).toHaveBeenCalledTimes(2));
  });

  it("renders a search field next to the create order button", async () => {
    mockedGetOrders.mockResolvedValue(listResponse([order]));

    render(<OrdersPage />);
    await screen.findByText("Rio Achyar");

    const search = screen.getByLabelText("Search orders");
    expect(search.getAttribute("placeholder")).toBe("Search orders...");
  });

  it("sends the search term to the backend after the debounce delay", async () => {
    mockedGetOrders.mockResolvedValue(listResponse([order]));

    render(<OrdersPage />);
    await screen.findByText("Rio Achyar");

    mockedGetOrders.mockClear();
    fireEvent.change(screen.getByLabelText("Search orders"), {
      target: { value: "Rio" },
    });

    
    expect(mockedGetOrders).not.toHaveBeenCalled();

    await waitFor(
      () =>
        expect(mockedGetOrders).toHaveBeenCalledWith(
          1,
          10,
          "Rio",
          expect.any(AbortSignal),
        ),
      { timeout: 2000 },
    );
  });

  it("shows an empty state when nothing matches the search", async () => {
    mockedGetOrders.mockResolvedValue(listResponse([]));

    render(<OrdersPage />);
    await screen.findByText("No orders found.");

    mockedGetOrders.mockResolvedValue(listResponse([]));
    fireEvent.change(screen.getByLabelText("Search orders"), {
      target: { value: "nobody" },
    });

    expect(await screen.findByText('No orders match "nobody".')).toBeTruthy();
  });

  it("moves to the next page and back", async () => {
    mockedGetOrders.mockResolvedValue(
      listResponse([order], { page: 1, total: 25, total_pages: 3 }),
    );

    render(<OrdersPage />);
    await screen.findByText("Rio Achyar");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() =>
      expect(mockedGetOrders).toHaveBeenCalledWith(
        2,
        10,
        undefined,
        expect.any(AbortSignal),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));

    await waitFor(() =>
      expect(mockedGetOrders).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        expect.any(AbortSignal),
      ),
    );
  });
});
