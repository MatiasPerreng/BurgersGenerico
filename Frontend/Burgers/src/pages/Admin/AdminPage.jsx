import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import StaffGate from "../../components/StaffGate/StaffGate";
import API_URL from "../../services/api";
import MercadoPagoComprobanteLink from "../../components/MercadoPagoComprobanteLink/MercadoPagoComprobanteLink";
import {
  pedidoDebeSincronizarMp,
  sincronizarPagoMercadoPagoPorPedidoConReintentos,
} from "../../services/mercadopagoSync";
import {
  claseEstadoPedidoTone,
  ESTADOS_ADMIN_OPCIONES,
  ESTADO_PEDIDO_LABEL,
} from "../../data/pedidoEstados";
import "../../styles/pedidoEstadoColores.css";
import "./AdminPage.css";

const STORAGE_ADMIN = "lbv_admin_jwt";

/** Botones tipo admin/horarios: un estado activo a la vez; "TODOS" muestra la lista completa de la pestaña. */
const FILTROS_ESTADO_ACTIVOS = [
  { value: "TODOS", label: "Todos" },
  { value: "PENDIENTE_CONFIRMACION_MP", label: "MP · confirmar" },
  { value: "PENDIENTE", label: ESTADO_PEDIDO_LABEL.PENDIENTE },
  { value: "EN_PREPARACION", label: ESTADO_PEDIDO_LABEL.EN_PREPARACION },
  { value: "LISTO", label: ESTADO_PEDIDO_LABEL.LISTO },
  { value: "EN_CAMINO", label: ESTADO_PEDIDO_LABEL.EN_CAMINO },
];

const FILTROS_ESTADO_HISTORIAL = [
  { value: "TODOS", label: "Todos" },
  { value: "ENTREGADO", label: ESTADO_PEDIDO_LABEL.ENTREGADO },
  { value: "CANCELADO", label: ESTADO_PEDIDO_LABEL.CANCELADO },
];

/** Mensaje legible desde respuestas FastAPI (`detail` string, lista o objeto). */
function formatApiError(data, fallback) {
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((x) => (x && typeof x === "object" && "msg" in x ? x.msg : JSON.stringify(x)))
      .join("; ");
  }
  if (d && typeof d === "object") return JSON.stringify(d);
  return fallback;
}

function pedidoEnHistorial(p) {
  return p.estado === "ENTREGADO" || p.estado === "CANCELADO";
}

function textoPedido(s) {
  if (s == null) return "";
  const t = String(s).trim();
  return t.length ? t : "";
}

/** Enlace wa.me para Uruguay: normaliza dígitos y prefijo 598. */
function whatsappUrl(telefono) {
  const raw = String(telefono || "").replace(/\D/g, "");
  if (!raw) return "https://wa.me/";
  let n = raw;
  if (n.startsWith("598")) {
    /* ya internacional */
  } else if (n.startsWith("0")) {
    n = `598${n.slice(1)}`;
  } else if (n.length >= 8 && n.length <= 9) {
    n = `598${n}`;
  }
  return `https://wa.me/${n}`;
}

function IconWhatsapp({ className }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function urlComprobante(nombre) {
  if (!nombre) return null;
  const b = String(API_URL || "/api").replace(/\/+$/, "");
  return `${b}/media/comprobantes/${encodeURIComponent(nombre)}`;
}

function esImagenComprobante(nombre) {
  return Boolean(nombre && /\.(jpe?g|png|webp)$/i.test(nombre));
}

/** Texto claro para cuándo se hizo el pedido (no solo fecha cruda). */
function pedidoRealizadoMeta(iso) {
  if (!iso) {
    return { label: "Realizado", line: "sin fecha", dateTime: undefined };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { label: "Pedido realizado", line: "—", dateTime: undefined };
  }
  const fecha = d.toLocaleDateString("es-UY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const hora = d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
  return {
    label: "Realizado",
    line: `${fecha} · ${hora}`,
    dateTime: d.toISOString(),
  };
}

function formatMoney(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "—";
  return x.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PedidoDetalleModal({ pedido, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!pedido) return null;

  const items = Array.isArray(pedido.items) ? pedido.items : [];
  const refTxt = textoPedido(pedido.referencia);
  const notasTxt = textoPedido(pedido.notas);
  const mpRefTxt = textoPedido(pedido.mercadopago_referencia);
  const mpPaymentId = textoPedido(pedido.mercadopago_payment_id);

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-head">
          <div className="admin-modal-head-text">
            <p className="admin-modal-eyebrow">Detalle completo</p>
            <h2 id="admin-modal-title" className="admin-modal-title">
              Pedido <span className="admin-modal-title-num">#{pedido.id_pedido}</span>
            </h2>
            <p className="admin-modal-total-chip">
              Total <strong>${formatMoney(pedido.total)}</strong>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="admin-modal-body">
          <section className="admin-modal-panel">
            <h3 className="admin-modal-k">Productos</h3>
            {items.length === 0 ? (
              <p className="admin-modal-empty">No hay ítems en este pedido.</p>
            ) : (
              <div className="admin-modal-table-wrap">
                <table className="admin-modal-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cant.</th>
                      <th>P. unit.</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={`${it.id_producto}-${i}`}>
                        <td className="admin-modal-prod">{it.nombre_producto}</td>
                        <td className="admin-modal-num">{it.cantidad}</td>
                        <td className="admin-modal-num">${formatMoney(it.precio_unitario)}</td>
                        <td className="admin-modal-num admin-modal-num--strong">
                          ${formatMoney(it.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="admin-modal-panel">
            <h3 className="admin-modal-k">Referencia para la entrega</h3>
            <p className="admin-modal-text">{refTxt || "Sin referencia indicada."}</p>
          </section>

          {pedido.medio_pago === "efectivo" && (
            <section className="admin-modal-panel">
              <h3 className="admin-modal-k">Efectivo</h3>
              {pedido.efectivo_necesita_cambio && pedido.efectivo_pago_con != null ? (
                <p className="admin-modal-text mb-0">
                  <strong>Necesita cambio.</strong> Paga con{" "}
                  <strong>${formatMoney(pedido.efectivo_pago_con)}</strong> (total pedido{" "}
                  <strong>${formatMoney(pedido.total)}</strong>
                  ).
                </p>
              ) : (
                <p className="admin-modal-text mb-0">Sin indicación de cambio (pago exacto o no aplica).</p>
              )}
            </section>
          )}

          {pedido.medio_pago === "mercadopago" && (
            <section className="admin-modal-panel">
              <h3 className="admin-modal-k">Pago Mercado Pago</h3>
              {mpPaymentId || mpRefTxt ? (
                <p className="admin-modal-text mb-0">
                  <MercadoPagoComprobanteLink
                    paymentId={mpPaymentId}
                    referencia={mpRefTxt}
                  />
                </p>
              ) : (
                <p className="admin-modal-text mb-0">
                  Aún no hay pago asociado (pendiente de confirmación desde Mercado Pago).
                </p>
              )}
            </section>
          )}

          <section className="admin-modal-panel">
            <h3 className="admin-modal-k">Nota del cliente</h3>
            <p className="admin-modal-text">{notasTxt || "Sin notas."}</p>
          </section>
        </div>
        <div className="admin-modal-foot">
          <button type="button" className="admin-modal-btn-primary" onClick={onClose}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminEstadoEditor({ pedido: p, esVistaActivos, updating, patchEstado }) {
  if (!esVistaActivos) {
    return (
      <span className={`admin-estado-pill ${claseEstadoPedidoTone(p.estado)}`}>
        {ESTADO_PEDIDO_LABEL[p.estado] || p.estado}
      </span>
    );
  }
  if (p.estado === "PENDIENTE_CONFIRMACION_MP") {
    const u = urlComprobante(p.comprobante_nombre);
    return (
      <div className="admin-mp-confirm">
        <div className="admin-mp-row">
          {u && esImagenComprobante(p.comprobante_nombre) && (
            <img src={u} alt="" className="admin-mp-thumb" />
          )}
          <div className="admin-mp-actions">
            {u ? (
              <a
                className="admin-mp-btn admin-mp-btn--ghost"
                href={u}
                target="_blank"
                rel="noopener noreferrer"
              >
                Comprobante
              </a>
            ) : (
              <span className="admin-mp-no-file">Sin adjunto</span>
            )}
            <button
              type="button"
              className="admin-mp-btn admin-mp-btn--ok"
              disabled={updating === p.id_pedido}
              onClick={() => patchEstado(p.id_pedido, "PENDIENTE")}
            >
              Confirmar
            </button>
            <button
              type="button"
              className="admin-mp-btn admin-mp-btn--no"
              disabled={updating === p.id_pedido}
              onClick={() => patchEstado(p.id_pedido, "CANCELADO")}
            >
              Cancelar
            </button>
            {updating === p.id_pedido && (
              <span className="admin-mp-saving" aria-live="polite">
                Guardando…
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="admin-estado-wrap">
      <select
        className="form-select form-select-sm admin-select admin-select--estado"
        value={p.estado}
        disabled={updating === p.id_pedido}
        onChange={(e) => patchEstado(p.id_pedido, e.target.value)}
        aria-label={`Estado pedido ${p.id_pedido}`}
      >
        {ESTADOS_ADMIN_OPCIONES.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {updating === p.id_pedido && (
        <span className="admin-saving" aria-live="polite">
          Guardando…
        </span>
      )}
    </div>
  );
}

function AdminPanel({ token, onLogout }) {
  const [pedidos, setPedidos] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [repPorPedido, setRepPorPedido] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [repError, setRepError] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [vistaAdmin, setVistaAdmin] = useState("activos");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [detallePedido, setDetallePedido] = useState(null);
  const [mpSyncBusy, setMpSyncBusy] = useState(false);
  const pedidosRef = useRef(pedidos);
  pedidosRef.current = pedidos;

  const pedidosActivos = useMemo(
    () => pedidos.filter((p) => !pedidoEnHistorial(p)),
    [pedidos],
  );
  const pedidosHistorial = useMemo(
    () => pedidos.filter(pedidoEnHistorial),
    [pedidos],
  );

  const listaVista = vistaAdmin === "activos" ? pedidosActivos : pedidosHistorial;
  const esVistaActivos = vistaAdmin === "activos";

  useEffect(() => {
    setFiltroEstado("TODOS");
  }, [vistaAdmin]);

  const listaFiltrada = useMemo(() => {
    if (filtroEstado === "TODOS") return listaVista;
    return listaVista.filter((p) => p.estado === filtroEstado);
  }, [listaVista, filtroEstado]);

  const conteoEstadoEnVista = useMemo(() => {
    const m = {};
    for (const p of listaVista) {
      m[p.estado] = (m[p.estado] || 0) + 1;
    }
    return m;
  }, [listaVista]);

  const opcionesFiltroEstado = esVistaActivos ? FILTROS_ESTADO_ACTIVOS : FILTROS_ESTADO_HISTORIAL;

  const resumenActivos = useMemo(() => {
    const a = pedidosActivos;
    return {
      mpPorConfirmar: a.filter((p) => p.estado === "PENDIENTE_CONFIRMACION_MP").length,
    };
  }, [pedidosActivos]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRepError(null);
    try {
      const resPed = await fetch(`${API_URL}/admin/pedidos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resPed.status === 401 || resPed.status === 403) {
        onLogout();
        setError("Sesión vencida o sin permiso.");
        return;
      }
      const dataPed = await resPed.json().catch(() => ({}));
      if (!resPed.ok) {
        throw new Error(
          formatApiError(dataPed, `Error al cargar pedidos (HTTP ${resPed.status}). Revisá el backend y la base.`),
        );
      }
      setPedidos(Array.isArray(dataPed) ? dataPed : []);
      setLastLoadedAt(new Date());

      const resRep = await fetch(`${API_URL}/admin/repartidores`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resRep.status === 401 || resRep.status === 403) {
        onLogout();
        return;
      }
      const dataRep = await resRep.json().catch(() => ({}));
      if (!resRep.ok) {
        setRepError(
          formatApiError(dataRep, `No se pudieron cargar repartidores (HTTP ${resRep.status}).`),
        );
        setRepartidores([]);
        return;
      }
      setRepartidores(Array.isArray(dataRep) ? dataRep : []);
    } catch (e) {
      setError(e.message || "Error de red. ¿El backend está en marcha y el proxy /api configurado?");
    } finally {
      setLoading(false);
    }
  }, [token, onLogout]);

  useEffect(() => {
    load();
  }, [load]);

  /** Sin webhook / sin volver del checkout: consulta MP por id de pedido (external_reference) mientras el panel está abierto. */
  useEffect(() => {
    if (loading) return;

    const runSync = () => {
      const need = pedidosRef.current.filter(pedidoDebeSincronizarMp);
      if (!need.length) return;
      void (async () => {
        setMpSyncBusy(true);
        try {
          for (const p of need) {
            const r = await sincronizarPagoMercadoPagoPorPedidoConReintentos(p.id_pedido);
            if (r.ok && r.data?.mercadopago_payment_id) {
              setPedidos((prev) =>
                prev.map((x) => (x.id_pedido === p.id_pedido ? { ...x, ...r.data } : x)),
              );
              setDetallePedido((d) => (d?.id_pedido === p.id_pedido ? { ...d, ...r.data } : d));
            }
          }
        } finally {
          setMpSyncBusy(false);
        }
      })();
    };

    runSync();
    const intervalMs = 25000;
    const id = setInterval(runSync, intervalMs);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!repartidores.length) return;
    setRepPorPedido((prev) => {
      const next = { ...prev };
      for (const p of pedidos) {
        if (next[p.id_pedido] == null) {
          next[p.id_pedido] = p.id_repartidor ?? repartidores[0].id;
        }
      }
      return next;
    });
  }, [pedidos, repartidores]);

  const patchEstado = async (idPedido, estado, idRepartidorOverride) => {
    const idRep =
      estado === "EN_CAMINO" ? idRepartidorOverride ?? repPorPedido[idPedido] : undefined;
    if (estado === "EN_CAMINO") {
      if (!repartidores.length) {
        setError("No hay repartidores cargados. Agregá uno en la base de datos.");
        return;
      }
      if (!idRep) {
        setError("Elegí qué repartidor lleva el pedido antes de ponerlo en la calle.");
        return;
      }
    }
    setUpdating(idPedido);
    setError(null);
    try {
      const body =
        estado === "EN_CAMINO"
          ? { estado, id_repartidor: idRep }
          : { estado };
      const res = await fetch(`${API_URL}/admin/pedidos/${idPedido}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401 || res.status === 403) {
        onLogout();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "No se pudo actualizar");
      }
      setPedidos((prev) => prev.map((p) => (p.id_pedido === idPedido ? { ...p, ...data } : p)));
      if (data.id_repartidor != null) {
        setRepPorPedido((prev) => ({ ...prev, [idPedido]: data.id_repartidor }));
      }
    } catch (e) {
      setError(e.message || "Error");
    } finally {
      setUpdating(null);
    }
  };

  const onRepartidorChange = (idPedido, idRepStr) => {
    const idRep = Number(idRepStr);
    setRepPorPedido((prev) => ({ ...prev, [idPedido]: idRep }));
    const p = pedidos.find((x) => x.id_pedido === idPedido);
    if (p?.estado === "EN_CAMINO") {
      patchEstado(idPedido, "EN_CAMINO", idRep);
    }
  };

  return (
    <main className="admin-main">
      <div className="container py-4 py-lg-5 admin-panel-container">
      <header className="admin-hero mb-4">
        <div className="admin-hero-top">
          <div className="admin-hero-titles">
            <span className="admin-eyebrow">Panel de cocina</span>
            <h1 className="admin-title">Pedidos</h1>
            <p className="admin-lead">
              {esVistaActivos ? (
                <>
                  <strong>Mercado Pago</strong>: revisá el comprobante y{" "}
                  <strong>Confirmar pago</strong>. Para <strong>En la calle</strong>, elegí repartidor.
                  Los <strong>entregados</strong> pasan al historial.
                </>
              ) : (
                <>
                  Pedidos finalizados: <strong>entregados</strong> y <strong>cancelados</strong>. Solo
                  lectura.
                </>
              )}
            </p>
            {!loading && pedidos.length > 0 && (
              <div className="admin-hero-meta">
                {lastLoadedAt && (
                  <span className="admin-hero-updated" title="Última vez que se cargó la lista">
                    Lista actualizada{" "}
                    {lastLoadedAt.toLocaleString("es-UY", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                )}
                <a className="admin-hero-site-link" href="/" target="_blank" rel="noopener noreferrer">
                  Ver sitio público
                </a>
              </div>
            )}
          </div>
          <div className="admin-hero-actions">
            <button
              type="button"
              className="btn admin-btn-refresh"
              onClick={load}
              disabled={loading}
              title="Recargar pedidos desde el servidor"
            >
              <span className="admin-btn-refresh__icon" aria-hidden>
                ↻
              </span>
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
            <button
              type="button"
              className="btn admin-btn-logout"
              onClick={onLogout}
              title="Salir del panel"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {!loading && pedidos.length > 0 && esVistaActivos && (
          <p className="admin-hero-inline-stats" aria-label="Resumen rápido">
            <span>
              <strong>{pedidosActivos.length}</strong> en curso
            </span>
            {resumenActivos.mpPorConfirmar > 0 && (
              <span className="admin-hero-inline-stats__mp">
                {" "}
                · <strong>{resumenActivos.mpPorConfirmar}</strong> MP sin confirmar
              </span>
            )}
            <span className="admin-hero-inline-stats__muted">
              {" "}
              · {pedidosHistorial.length} en historial
            </span>
          </p>
        )}

        {!loading && esVistaActivos && resumenActivos.mpPorConfirmar > 0 && (
          <div className="admin-mp-banner" role="status">
            <span className="admin-mp-banner__dot" aria-hidden />
            <span>
              <strong>{resumenActivos.mpPorConfirmar}</strong>{" "}
              {resumenActivos.mpPorConfirmar === 1 ? "pedido espera" : "pedidos esperan"} confirmación de
              pago (Mercado Pago). Usá Comprobante / Confirmar / Cancelar en el pedido.
            </span>
          </div>
        )}
      </header>

      {error && (
        <div className="alert admin-alert admin-alert--warn py-3 small mb-4" role="alert">
          {error}
        </div>
      )}

      {repError && !error && (
        <div className="alert admin-alert admin-alert--info py-3 small mb-4" role="status">
          {repError} Podés ver pedidos igual; para asignar repartidor cargá al menos un staff con rol{" "}
          <code>repartidor</code>.
        </div>
      )}

      {loading && (
        <div className="admin-loading">
          <span className="admin-loading-dot" />
          <span className="admin-loading-dot" />
          <span className="admin-loading-dot" />
          <span className="ms-2 text-muted">Cargando pedidos…</span>
        </div>
      )}

      {!loading && !error && pedidos.length === 0 && (
        <div className="admin-empty">
          <p className="admin-empty-icon" aria-hidden>
            📋
          </p>
          <p className="admin-empty-title">No hay pedidos por ahora</p>
          <p className="admin-empty-text">Cuando entren pedidos desde la web, aparecerán acá.</p>
        </div>
      )}

      {!loading && !error && pedidos.length > 0 && (
        <section className="admin-workspace" aria-label="Listado de pedidos">
          <div className="admin-workspace-tabs" role="tablist" aria-label="Vista de pedidos">
            <button
              type="button"
              role="tab"
              aria-selected={vistaAdmin === "activos"}
              className={`admin-tab${vistaAdmin === "activos" ? " is-active" : ""}`}
              onClick={() => setVistaAdmin("activos")}
            >
              <span className="admin-tab__label">Activos</span>
              <span className="admin-tab__badge">{pedidosActivos.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={vistaAdmin === "historial"}
              className={`admin-tab${vistaAdmin === "historial" ? " is-active" : ""}`}
              onClick={() => setVistaAdmin("historial")}
            >
              <span className="admin-tab__label">Historial</span>
              <span className="admin-tab__badge admin-tab__badge--muted">{pedidosHistorial.length}</span>
            </button>
          </div>

          <div className="admin-workspace-body">
            {!listaVista.length && (
              <div className="admin-empty admin-empty--section">
                <p className="admin-empty-icon" aria-hidden>
                  {vistaAdmin === "historial" ? "📚" : "✓"}
                </p>
                <p className="admin-empty-title">
                  {vistaAdmin === "activos"
                    ? "No hay pedidos en curso"
                    : "El historial está vacío"}
                </p>
                <p className="admin-empty-text">
                  {vistaAdmin === "activos"
                    ? pedidosHistorial.length > 0
                      ? "Todos los pedidos figuran en el historial. Cambiá de pestaña para verlos."
                      : "Cuando haya pedidos nuevos, aparecerán acá."
                    : "Al marcar un pedido como entregado o cancelado, pasará a esta lista."}
                </p>
                {vistaAdmin === "activos" && pedidosHistorial.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm admin-btn-ghost mt-2"
                    onClick={() => setVistaAdmin("historial")}
                  >
                    Ver historial
                  </button>
                )}
              </div>
            )}

            {listaVista.length > 0 && (
              <>
                <div className="admin-pedidos-filtros" role="group" aria-label="Filtrar pedidos por estado">
                  <span className="admin-pedidos-filtros-label">Estado</span>
                  <div className="admin-pedidos-filtros-botones">
                    {opcionesFiltroEstado.map((opt) => {
                      const n =
                        opt.value === "TODOS"
                          ? listaVista.length
                          : conteoEstadoEnVista[opt.value] ?? 0;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={`admin-filtro-estado admin-filtro-estado--${String(
                            opt.value,
                          ).toLowerCase()}${filtroEstado === opt.value ? " active" : ""}`}
                          onClick={() => setFiltroEstado(opt.value)}
                          aria-pressed={filtroEstado === opt.value}
                        >
                          <span className="admin-filtro-estado-label">{opt.label}</span>
                          <span className="admin-filtro-estado-n" aria-hidden>
                            {n}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!listaFiltrada.length && (
                  <div className="admin-empty admin-empty--section admin-empty--filtro">
                    <p className="admin-empty-icon" aria-hidden>
                      🔍
                    </p>
                    <p className="admin-empty-title">Ningún pedido con este estado</p>
                    <p className="admin-empty-text">
                      Probá otro filtro o elegí <strong>Todos</strong> para ver el listado completo de esta
                      pestaña.
                    </p>
                    {filtroEstado !== "TODOS" && (
                      <button
                        type="button"
                        className="btn btn-sm admin-btn-ghost mt-2"
                        onClick={() => setFiltroEstado("TODOS")}
                      >
                        Ver todos
                      </button>
                    )}
                  </div>
                )}

                {listaFiltrada.length > 0 && (
                  <>
                <div className="admin-workspace-toolbar">
                  <div>
                    <h2 className="admin-workspace-heading">
                      {listaFiltrada.length} {listaFiltrada.length === 1 ? "pedido" : "pedidos"}
                      {esVistaActivos ? " en curso" : " en historial"}
                      {filtroEstado !== "TODOS" && (
                        <span className="admin-workspace-heading-filtro">
                          {" "}
                          · filtrado por estado
                        </span>
                      )}
                    </h2>
                    <p className="admin-workspace-hint">
                      {esVistaActivos
                        ? "Orden de prioridad: primero el pedido más antiguo (quien encargó antes va primero en la cola)."
                        : "Orden cronológico: del más antiguo al más reciente."}
                    </p>
                  </div>
                </div>

                <ul className="admin-order-list">
                  {listaFiltrada.map((p, colaIdx) => {
                    const dt = pedidoRealizadoMeta(p.created_at);
                    const posGlobal = listaVista.findIndex((x) => x.id_pedido === p.id_pedido) + 1;
                    return (
                      <li key={p.id_pedido}>
                        <article className="admin-order">
                          <div className="admin-order-layout">
                            <div
                              className="admin-order-rail"
                              aria-label={`Pedido número ${p.id_pedido}`}
                            >
                              <span className="admin-order-rail-k">Pedido</span>
                              <div className="admin-order-rail-group">
                                <span className="admin-order-num">#{p.id_pedido}</span>
                                {esVistaActivos && (
                                  <span
                                    className="admin-order-queue"
                                    title={
                                      filtroEstado === "TODOS"
                                        ? "Posición en cola (más antiguo = prioridad)"
                                        : `En este filtro: ${colaIdx + 1}/${listaFiltrada.length} · En la cola total: ${posGlobal}/${listaVista.length}`
                                    }
                                  >
                                    Cola {colaIdx + 1}/{listaFiltrada.length}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="admin-order-center">
                              <div className="admin-order-grid">
                                <div className="admin-order-block">
                                  <h3 className="admin-order-k">Cliente</h3>
                                  <p className="admin-order-name">
                                    {p.cliente_nombre} {p.cliente_apellido}
                                  </p>
                                  <a
                                    className="admin-order-wa"
                                    href={whatsappUrl(p.cliente_telefono)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`Abrir WhatsApp con ${p.cliente_telefono}`}
                                  >
                                    <IconWhatsapp className="admin-order-wa-icon" />
                                    WhatsApp
                                  </a>
                                </div>
                                <div className="admin-order-block admin-order-block--grow">
                                  <h3 className="admin-order-k">Entrega</h3>
                                  <p className="admin-order-addr">{p.direccion}</p>
                                </div>
                              </div>
                            </div>

                            <div className="admin-order-aside">
                              <div className="admin-order-aside-actions">
                                <button
                                  type="button"
                                  className="admin-btn-detalle"
                                  title="Productos pedidos, referencia y notas"
                                  onClick={() => setDetallePedido(p)}
                                >
                                  Detalle
                                </button>
                                {p.medio_pago === "mercadopago" &&
                                  (p.mercadopago_payment_id || p.mercadopago_referencia) && (
                                    <MercadoPagoComprobanteLink
                                      paymentId={p.mercadopago_payment_id}
                                      referencia={p.mercadopago_referencia}
                                      className="admin-mp-comprobante-inline admin-mp-comprobante--in-aside"
                                    />
                                  )}
                              </div>
                              <p className="admin-order-total">${Number(p.total).toFixed(2)}</p>
                            </div>
                          </div>

                          {p.medio_pago === "mercadopago" &&
                            !p.mercadopago_payment_id &&
                            !p.mercadopago_referencia && (
                              <div
                                className="admin-order-mp-line admin-order-mp-line--pending"
                                role="status"
                              >
                                <span className="admin-order-mp-pending">
                                  MP: sin n° de operación en el sistema aún
                                  {pedidoDebeSincronizarMp(p) && mpSyncBusy
                                    ? " — consultando Mercado Pago…"
                                    : " — se actualiza solo cada ~25 s con esta página abierta (o el cliente en Seguimiento)."}
                                </span>
                              </div>
                            )}

                          <footer className="admin-order-foot">
                            <div className="admin-order-foot-fields">
                              <div className="admin-order-field admin-order-field--rep">
                                <label className="admin-order-field-label" htmlFor={`rep-${p.id_pedido}`}>
                                  Repartidor
                                </label>
                                {esVistaActivos ? (
                                  <select
                                    id={`rep-${p.id_pedido}`}
                                    className="form-select form-select-sm admin-select admin-select--rep"
                                    value={repPorPedido[p.id_pedido] ?? ""}
                                    disabled={updating === p.id_pedido || !repartidores.length}
                                    onChange={(e) => onRepartidorChange(p.id_pedido, e.target.value)}
                                  >
                                    {repartidores.map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {r.nombre}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <p className="admin-order-readonly">{p.repartidor_nombre || "—"}</p>
                                )}
                              </div>
                              <div className="admin-order-field admin-order-field--estado">
                                <span className="admin-order-field-label">Estado</span>
                                <div className="admin-order-estado">
                                  <AdminEstadoEditor
                                    pedido={p}
                                    esVistaActivos={esVistaActivos}
                                    updating={updating}
                                    patchEstado={patchEstado}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="admin-order-foot-datetime">
                              <span className="admin-order-datetime-label">{dt.label}</span>
                              <time className="admin-order-datetime-value" dateTime={dt.dateTime}>
                                {dt.line}
                              </time>
                            </div>
                          </footer>
                        </article>
                      </li>
                    );
                  })}
                </ul>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      )}
      </div>

      {detallePedido && (
        <PedidoDetalleModal pedido={detallePedido} onClose={() => setDetallePedido(null)} />
      )}
    </main>
  );
}

export default function AdminPage() {
  return (
    <div className="admin-page">
      <Navbar />
      <StaffGate
        storageKey={STORAGE_ADMIN}
        title="Administración"
        subtitle="Ingresá el usuario y contraseña del administrador (cuenta staff con rol admin)."
        expectedRole="admin"
      >
        {({ token, logout }) => <AdminPanel token={token} onLogout={logout} />}
      </StaffGate>
      <Footer />
    </div>
  );
}
