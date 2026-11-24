import { describe, expect, it } from "vitest";
import { cancelOrder, createOrder, getOrder, getOrders } from "../../src/api/orders";
import { createProduct, getProduct } from "../../src/api/products";
import { adjustStock } from "../../src/api/stock";

const SKU = `ORD-IT-${Date.now()}`;
const PRICE = 25000;

const integration = describe.skipIf(import.meta.env.MODE !== "integration");

integration("orders api against the real backend", () => {
  it("creates, reads and cancels an order", async () => {
    const product = await createProduct({
      sku: SKU,
      name: "Order Integration Test",
      price: PRICE,
    });
    await adjustStock(product.id, { type: "in", qty: 5 });

    const created = await createOrder({
      customer: "Integration Test",
      items: [{ sku: SKU, qty: 2 }],
    });

    expect(created.status).toBe("CREATED");
    expect(created.total).toBe(PRICE * 2);
    expect(created.items).toHaveLength(1);
    expect(created.items?.[0].unit_price).toBe(PRICE);

    const fetched = await getOrder(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.customer).toBe("Integration Test");

    const afterOrder = await getProduct(product.id);
    expect(afterOrder.stock).toBe(3);

    const cancelled = await cancelOrder(created.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelled_at).not.toBeNull();

    const afterCancel = await getOrder(created.id);
    expect(afterCancel.status).toBe("CANCELLED");
    expect(afterCancel.total).toBe(PRICE * 2);

    const restored = await getProduct(product.id);
    expect(restored.stock).toBe(5);
  });

  it("rejects an order with more stock than available with 409", async () => {
    const product = await createProduct({
      sku: `${SKU}-B`,
      name: "Order Integration Short",
      price: PRICE,
    });
    await adjustStock(product.id, { type: "in", qty: 1 });

    await expect(
      createOrder({
        customer: "Integration Test",
        items: [{ sku: `${SKU}-B`, qty: 5 }],
      }),
    ).rejects.toMatchObject({
      response: {
        status: 409,
        data: { error: { code: "INSUFFICIENT_STOCK", sku: `${SKU}-B` } },
      },
    });

    const unchanged = await getProduct(product.id);
    expect(unchanged.stock).toBe(1);
  });

  it("rejects an empty customer with 400", async () => {
    await expect(
      createOrder({ customer: "  ", items: [{ sku: SKU, qty: 1 }] }),
    ).rejects.toMatchObject({
      response: { status: 400, data: { error: { code: "VALIDATION_ERROR" } } },
    });
  });

  it("rejects a duplicate sku with 400", async () => {
    await expect(
      createOrder({
        customer: "Integration Test",
        items: [
          { sku: SKU, qty: 1 },
          { sku: SKU, qty: 1 },
        ],
      }),
    ).rejects.toMatchObject({
      response: { status: 400, data: { error: { code: "VALIDATION_ERROR" } } },
    });
  });

  it("returns 404 for a missing order", async () => {
    await expect(getOrder(99999999)).rejects.toMatchObject({
      response: { status: 404, data: { error: { code: "ORDER_NOT_FOUND" } } },
    });
  });

  it("refuses to cancel an order twice with 409", async () => {
    const product = await createProduct({
      sku: `${SKU}-C`,
      name: "Order Integration Cancel",
      price: PRICE,
    });
    await adjustStock(product.id, { type: "in", qty: 3 });

    const created = await createOrder({
      customer: "Integration Test",
      items: [{ sku: `${SKU}-C`, qty: 1 }],
    });

    await cancelOrder(created.id);

    await expect(cancelOrder(created.id)).rejects.toMatchObject({
      response: {
        status: 409,
        data: { error: { code: "ORDER_ALREADY_CANCELLED" } },
      },
    });
  });

  it("lists the orders with pagination and a customer search", async () => {
    const product = await createProduct({
      sku: `${SKU}-L`,
      name: "Order Integration List",
      price: PRICE,
    });
    await adjustStock(product.id, { type: "in", qty: 4 });

    const created = await createOrder({
      customer: "Integration List Customer",
      items: [{ sku: `${SKU}-L`, qty: 1 }],
    });

    const listed = await getOrders(1, 10, "Integration List Customer");
    expect(listed.data.some((order) => order.id === created.id)).toBe(true);
    expect(listed.meta.total).toBeGreaterThanOrEqual(1);
    expect(listed.meta.page).toBe(1);
    
    expect(listed.data[0].items).toBeUndefined();

    const paged = await getOrders(1, 1);
    expect(paged.data).toHaveLength(1);
    expect(paged.meta.total).toBeGreaterThanOrEqual(1);
    expect(paged.meta.total_pages).toBeGreaterThanOrEqual(1);
  });

  it("returns an empty list when no order matches the search", async () => {
    const listed = await getOrders(1, 10, "no-such-customer-for-the-list");

    expect(listed.data).toEqual([]);
    expect(listed.meta.total).toBe(0);
  });

  it("rejects invalid pagination parameters with 400", async () => {
    await expect(getOrders(0, 10)).rejects.toMatchObject({
      response: { status: 400, data: { error: { code: "VALIDATION_ERROR" } } },
    });
  });
});
