import { useEffect, useState } from "react";
import { getErrorMessage } from "../../api/errors";
import { getStockMovements } from "../../api/stock";
import type { StockMovement } from "../../types/api";
import { formatDate } from "../../utils/date";

interface StockMovementHistoryProps {
  productId: number;
  reloadToken?: number;
}

type HistoryState =
  | { status: "loading" }
  | { status: "success"; movements: StockMovement[] }
  | { status: "error"; message: string };

export default function StockMovementHistory({
  productId,
  reloadToken = 0,
}: StockMovementHistoryProps) {
  const [state, setState] = useState<HistoryState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    getStockMovements(productId, controller.signal).then(
      (movements) => setState({ status: "success", movements }),
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: getErrorMessage(err) });
      },
    );

    return () => controller.abort();
  }, [productId, reloadToken]);

  return (
    <section className="stock-history">
      <h3>Stock movement history</h3>

      {state.status === "loading" && <p className="state">Loading movements…</p>}

      {state.status === "error" && (
        <p className="state state-error" role="alert">
          {state.message}
        </p>
      )}

      {state.status === "success" && state.movements.length === 0 && (
        <p className="state">No stock movements yet.</p>
      )}

      {state.status === "success" && state.movements.length > 0 && (
        <table className="product-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Type</th>
              <th scope="col">Quantity</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {state.movements.map((movement) => (
              <tr key={movement.id}>
                <td>{formatDate(movement.created_at)}</td>
                <td>
                  <span
                    className={
                      movement.type === "in" ? "badge badge-active" : "badge badge-inactive"
                    }
                  >
                    {movement.type === "in" ? "In" : "Out"}
                  </span>
                </td>
                <td className="numeric">{movement.qty}</td>
                <td>{movement.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
