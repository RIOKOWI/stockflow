import AppLayout from "./components/layout/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import OrdersPage from "./pages/OrdersPage";
import ProductsPage from "./pages/ProductsPage";
import { useHashRoute } from "./utils/router";
import "./App.css";

function App() {
  const route = useHashRoute();
  const orderMatch = /^\/orders\/(\d+)$/.exec(route);

  return (
    <AppLayout>
      {orderMatch ? (
        <OrderDetailPage orderId={Number(orderMatch[1])} />
      ) : route === "/orders" ? (
        <OrdersPage />
      ) : route === "/dashboard" || route === "" ? (
        <DashboardPage />
      ) : (
        <ProductsPage />
      )}
    </AppLayout>
  );
}

export default App;
