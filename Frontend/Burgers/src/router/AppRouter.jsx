import { Routes, Route } from "react-router-dom";
import HomePage from "../pages/Home/HomePage";
import PedidoPage from "../pages/Pedido/PedidoPage";
import PedidoPagoResultado from "../pages/Pedido/PedidoPagoResultado";
import SeguimientoPage from "../pages/Seguimiento/SeguimientoPage";
import AdminPage from "../pages/Admin/AdminPage";
import RepartidorPage from "../pages/Repartidor/RepartidorPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/pedido" element={<PedidoPage />} />
      <Route path="/pedido/pago-resultado" element={<PedidoPagoResultado />} />
      <Route path="/seguimiento" element={<SeguimientoPage />} />
      <Route path="/seguimiento/:token" element={<SeguimientoPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/repartidor" element={<RepartidorPage />} />
    </Routes>
  );
}
