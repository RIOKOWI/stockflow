import { useEffect, useState } from "react";


export function useHashRoute(): string {
  const [route, setRoute] = useState(
    () => window.location.hash.slice(1) || "/products",
  );

  useEffect(() => {
    const sync = () => setRoute(window.location.hash.slice(1) || "/products");
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return route;
}

export function navigate(path: string): void {
  window.location.hash = path;
}
