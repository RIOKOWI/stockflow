
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import CancelOrderDialog from "./CancelOrderDialog";
import OrderDetail from "./OrderDetail";
import OrderForm from "./OrderForm";
import { cancelOrder, createOrder } from "../../api/orders";
import { getProducts } from "../../api/products";
import type { Order, Product } from "../../types/api";

vi.mock("../../api/orders", () => ({
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  cancelOrder: vi.fn(),
}));

vi.mock("../../api/products", () => ({
  getProducts: vi.fn(),
}));

const mockedCreateOrder = vi.mocked(createOrder);
const mockedCancelOrder = vi.mocked(cancelOrder);
const mockedGetProducts = vi.mocked(getProducts);

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
  items: [
    {
      id: 35,
      order_id: 27,
      sku: "SKU-001",
      name: "iCrystal",
      qty: 2,
      unit_price: 150000,
      subtotal: 300000,
    },
  ],
};

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

describe("OrderForm", () => {
  it("renders the customer field and one item row with the backend products", async () => {
    mockedGetProducts.mockResolvedValue({
      success: true,
      message: "",
      data: [product],
      meta: { page: 1, limit: 100, total: 1, total_pages: 1 },
    });

    render(<OrderForm onCreated={() => {}} />);

    expect(screen.getByLabelText("Customer")).toBeTruthy();
    const select = (await screen.findByLabelText("Product 1")) as HTMLSelectElement;
    expect(screen.getByLabelText("Quantity")).toBeTruthy();

    
    await screen.findByRole("option", { name: /SKU-001/ });
    expect(select.options.length).toBe(2);
  });

  it("shows validation errors and does not submit an empty form", async () => {
    mockedGetProducts.mockResolvedValue({
      success: true,
      message: "",
      data: [product],
      meta: { page: 1, limit: 100, total: 1, total_pages: 1 },
    });

    render(<OrderForm onCreated={() => {}} />);
    await screen.findByRole("option", { name: /SKU-001/ });

    fireEvent.click(screen.getByRole("button", { name: "Create order" }));

    expect(await screen.findByText("Customer is required")).toBeTruthy();
    expect(screen.getByText("Quantity is required")).toBeTruthy();
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it("submits the trimmed customer and the selected items", async () => {
    mockedGetProducts.mockResolvedValue({
      success: true,
      message: "",
      data: [product],
      meta: { page: 1, limit: 100, total: 1, total_pages: 1 },
    });
    mockedCreateOrder.mockResolvedValue(order);

    const onCreated = vi.fn();
    render(<OrderForm onCreated={onCreated} />);
    await screen.findByRole("option", { name: /SKU-001/ });

    fireEvent.change(screen.getByLabelText("Customer"), {
      target: { value: "  Rio Achyar  " },
    });
    fireEvent.change(screen.getByLabelText("Product 1"), {
      target: { value: "SKU-001" },
    });
    fireEvent.change(screen.getByLabelText("Quantity"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create order" }));

    await waitFor(() =>
      expect(mockedCreateOrder).toHaveBeenCalledWith({
        customer: "Rio Achyar",
        items: [{ sku: "SKU-001", qty: 2 }],
      }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(order));
  });

  it("shows the available quantity when the backend reports insufficient stock", async () => {
    mockedGetProducts.mockResolvedValue({
      success: true,
      message: "",
      data: [product],
      meta: { page: 1, limit: 100, total: 1, total_pages: 1 },
    });
    mockedCreateOrder.mockRejectedValue(
      apiFailure(409, {
        code: "INSUFFICIENT_STOCK",
        message: "insufficient stock",
        sku: "SKU-001",
        available: 3,
      }),
    );

    render(<OrderForm onCreated={() => {}} />);
    await screen.findByRole("option", { name: /SKU-001/ });

    fireEvent.change(screen.getByLabelText("Customer"), {
      target: { value: "Rio Achyar" },
    });
    fireEvent.change(screen.getByLabelText("Product 1"), {
      target: { value: "SKU-001" },
    });
    fireEvent.change(screen.getByLabelText("Quantity"), {
      target: { value: "99" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create order" }));

    expect(
      await screen.findByText("Insufficient stock. Available quantity: 3."),
    ).toBeTruthy();
    
    expect((screen.getByLabelText("Customer") as HTMLInputElement).value).toBe(
      "Rio Achyar",
    );
  });
});

describe("OrderDetail", () => {
  it("renders the order fields, the items and the server total", () => {
    const markup = renderToStaticMarkup(<OrderDetail order={order} />);

    expect(markup).toContain("#27");
    expect(markup).toContain("Rio Achyar");
    expect(markup).toContain("CREATED");
    expect(markup).toContain("SKU-001");
    expect(markup).toContain("iCrystal");
    expect(markup).toMatch(/300[.\s]?000/);
  });

  it("offers the cancel action only for a created order", () => {
    const created = renderToStaticMarkup(<OrderDetail order={order} onCancel={() => {}} />);
    expect(created).toContain("Cancel order");

    const cancelled = renderToStaticMarkup(
      <OrderDetail
        order={{ ...order, status: "CANCELLED", cancelled_at: "2026-11-24T05:17:28Z" }}
        onCancel={() => {}}
      />,
    );
    expect(cancelled).toContain("CANCELLED");
    expect(cancelled).not.toContain("Cancel order</button>");
  });
});

describe("CancelOrderDialog", () => {
  it("asks for confirmation before cancelling", () => {
    const markup = renderToStaticMarkup(
      <CancelOrderDialog order={order} onClose={() => {}} onCancelled={() => {}} />,
    );

    expect(markup).toContain("Cancel order");
    expect(markup).toContain("Rio Achyar");
    expect(markup).toContain("restores the stock");
  });

  it("cancels the order through the api and reports the cancelled order", async () => {
    const cancelled: Order = {
      ...order,
      status: "CANCELLED",
      cancelled_at: "2026-11-24T05:17:28.340132+07:00",
    };
    mockedCancelOrder.mockResolvedValue(cancelled);
    const onCancelled = vi.fn();

    render(
      <CancelOrderDialog order={order} onClose={() => {}} onCancelled={onCancelled} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    await waitFor(() => expect(mockedCancelOrder).toHaveBeenCalledWith(27));
    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith(cancelled));
  });

  it("shows the backend error when the cancellation is refused", async () => {
    mockedCancelOrder.mockRejectedValue(
      apiFailure(409, {
        code: "ORDER_ALREADY_CANCELLED",
        message: "order already cancelled",
      }),
    );

    render(
      <CancelOrderDialog order={order} onClose={() => {}} onCancelled={() => {}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    expect(await screen.findByText("This order is already cancelled.")).toBeTruthy();
  });
});
