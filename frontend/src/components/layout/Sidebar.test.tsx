
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Sidebar from "./Sidebar";

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("Sidebar", () => {
  it("renders every navigation menu", () => {
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Products" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Orders" })).toBeTruthy();
  });

  it("marks the current route as the active menu", () => {
    window.location.hash = "#/orders";
    render(<Sidebar />);

    expect(
      screen.getByRole("link", { name: "Orders" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Products" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("keeps the orders menu active on the order detail route", () => {
    window.location.hash = "#/orders/27";
    render(<Sidebar />);

    expect(
      screen.getByRole("link", { name: "Orders" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("navigates when a menu is clicked", () => {
    render(<Sidebar />);

    expect(
      screen.getByRole("link", { name: "Dashboard" }).getAttribute("href"),
    ).toBe("#/dashboard");
  });

  it("toggles the navigation for small screens", () => {
    render(<Sidebar />);

    const toggle = screen.getByRole("button", { name: "Toggle navigation" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);

    expect(
      screen
        .getByRole("button", { name: "Toggle navigation" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });
});
