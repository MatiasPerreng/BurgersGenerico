import { useCallback, useEffect, useState } from "react";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import StaffGate from "../../components/StaffGate/StaffGate";
import API_URL from "../../services/api";
import "./RepartidorPage.css";

const STORAGE_REP = "lbv_repartidor_jwt";

function RepartidorPanel({ token, onLogout }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marcando, setMarcando] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/repartidor/pedidos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        onLogout();
        setError("Clave incorrecta o sesión vencida.");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Error al cargar");
      }
      setPedidos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Error de red");
    } finally {
      setLoading(false);
    }
  }, [token, onLogout]);

  useEffect(() => {
    load();
  }, [load]);

  const marcarEntregado = async (idPedido) => {
    setMarcando(idPedido);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/repartidor/pedidos/${idPedido}/entregado`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        onLogout();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "No se pudo marcar");
      }
      setPedidos((prev) => prev.filter((p) => p.id_pedido !== idPedido));
    } catch (e) {
      setError(e.message || "Error");
    } finally {
      setMarcando(null);
    }
  };

  return (
    <main className="container rep-main py-4 py-lg-5">
      <div className="rep-shell">
        <header className="rep-hero">
          <span className="rep-eyebrow">Tu ruta</span>
          <h1 className="rep-title">En la calle</h1>
          <p className="rep-lead">
            Pedidos que cocina marcó como <strong>en la calle</strong> y asignó a vos. Al entregar,
            confirmá abajo.
          </p>
          <div className="rep-hero-actions">
            <button type="button" className="btn btn-sm rep-btn-secondary" onClick={load} disabled={loading}>
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
            <button type="button" className="btn btn-sm rep-btn-logout" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </header>

        {error && (
          <div className="alert alert-warning py-2 small mb-3" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-muted small mb-0">
            Cargando pedidos…
          </p>
        )}

        {!loading && pedidos.length === 0 && (
          <div className="rep-empty">
            <p className="rep-empty-icon mb-2" aria-hidden>
              🛵
            </p>
            <p className="fw-semibold text-dark mb-1">No hay pedidos en reparto</p>
            <p className="small text-muted mb-0">Cuando te asignen uno, aparecerá acá al instante.</p>
          </div>
        )}

        <div className="rep-list">
          {pedidos.map((p) => (
            <article key={p.id_pedido} className="rep-card">
              <div className="rep-card-inner">
                <div className="rep-card-top">
                  <span className="rep-card-id">#{p.id_pedido}</span>
                  <span className="rep-card-total">${Number(p.total).toFixed(2)}</span>
                </div>
                <a className="rep-card-phone" href={`tel:${p.cliente_telefono}`}>
                  {p.cliente_nombre} {p.cliente_apellido}
                  <br />
                  <span className="rep-phone-num">{p.cliente_telefono}</span>
                </a>
                <p className="rep-card-dir">{p.direccion}</p>
                {p.referencia && (
                  <p className="rep-card-ref mb-2">
                    <strong>Referencia</strong> {p.referencia}
                  </p>
                )}
                {p.notas && (
                  <p className="rep-card-notas mb-2">
                    <strong>Notas</strong> {p.notas}
                  </p>
                )}
                <div className="rep-items-wrap">
                  <div className="rep-items-title">Detalle del pedido</div>
                  <ul className="rep-items list-unstyled small mb-0">
                    {p.items?.map((it, idx) => (
                      <li
                        key={idx}
                        className="d-flex justify-content-between align-items-baseline gap-2 py-1 border-bottom"
                      >
                        <span>
                          {it.nombre_producto} × {it.cantidad}
                        </span>
                        <span className="text-muted text-nowrap">${Number(it.subtotal).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  className="btn rep-btn-entregado w-100 py-3"
                  disabled={marcando === p.id_pedido}
                  onClick={() => marcarEntregado(p.id_pedido)}
                >
                  {marcando === p.id_pedido ? "Guardando…" : "Marcar entregado"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function RepartidorPage() {
  return (
    <div className="repartidor-page">
      <Navbar />
      <StaffGate
        storageKey={STORAGE_REP}
        title="Repartidor"
        subtitle="Ingresá usuario y contraseña de tu cuenta de repartidor."
        expectedRole="repartidor"
      >
        {({ token, logout }) => <RepartidorPanel token={token} onLogout={logout} />}
      </StaffGate>
      <Footer />
    </div>
  );
}
