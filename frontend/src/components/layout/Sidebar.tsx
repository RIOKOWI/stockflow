import { useState } from "react";
import { useHashRoute } from "../../utils/router";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/orders", label: "Orders" },
];

export default function Sidebar() {
  const route = useHashRoute();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    route === href || route.startsWith(`${href}/`);

  return (
    <aside className={open ? "sidebar sidebar-open" : "sidebar"}>
      <div className="sidebar-head">
        <span className="sidebar-brand">StockFlow</span>
        <button
          type="button"
          className="icon-button sidebar-toggle"
          aria-label="Toggle navigation"
          aria-expanded={open}
          aria-controls="sidebar-nav"
          onClick={() => setOpen((value) => !value)}
        >
          ☰
        </button>
      </div>

      <nav id="sidebar-nav" className="sidebar-nav" aria-label="Main">
        <ul>
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={`#${link.href}`}
                aria-current={isActive(link.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
