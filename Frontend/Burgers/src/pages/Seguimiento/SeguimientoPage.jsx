import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import MercadoPagoComprobanteLink from "../../components/MercadoPagoComprobanteLink/MercadoPagoComprobanteLink";
import API_URL from "../../services/api";
import {
  pedidoDebeSincronizarMp,
  sincronizarPagoMercadoPagoPorPedido,
  sincronizarPagoMercadoPagoPorPedidoConReintentos,
} from "../../services/mercadopagoSync";
import { claseEstadoPedidoTone } from "../../data/pedidoEstados";
import "../../styles/pedidoEstadoColores.css";
import "./SeguimientoPage.css";

const ESTADOS = {
  PENDIENTE_CONFIRMACION_MP: {
    label: "Pago Mercado Pago",
    desc: "Estamos verificando tu comprobante. En breve pasamos el pedido a cocina.",
  },
  PENDIENTE: { label: "Recibido", desc: "Tu pedido ingresó y está en cola." },
  EN_PREPARACION: { label: "En preparación", desc: "Lo estamos armando en cocina." },
  LISTO: { label: "Listo", desc: "Ya está listo para envío o retiro." },
  EN_CAMINO: { label: "En la calle", desc: "Va en camino hacia tu dirección." },
  ENTREGADO: { label: "Entregado", desc: "¡Gracias por elegirnos!" },
  CANCELADO: { label: "Cancelado", desc: "Este pedido fue cancelado." },
};

export default function SeguimientoPage() {
  const { token: tokenFromUrl } = useParams();
  const navigate = useNavigate();

  const [telefono, setTelefono] = useState("");
  const [pedidosPorTelefono, setPedidosPorTelefono] = useState(null);
  const [telefonoConsulta, setTelefonoConsulta] = useState("");

  const [manualToken, setManualToken] = useState("");
  const [mostrarPorEnlace, setMostrarPorEnlace] = useState(false);

  const [pedidoUnico, setPedidoUnico] = useState(null);
  const [loading, setLoading] = useState(!!tokenFromUrl);
  const [loadingTelefono, setLoadingTelefono] = useState(false);
  const [error, setError] = useState(null);

  const cargarPorToken = useCallback(async (tok) => {
    if (!tok?.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/pedidos/seguimiento/${encodeURIComponent(tok.trim())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.detail === "string"
            ? data.detail
            : Array.isArray(data.detail)
              ? data.detail.map((x) => x.msg).join(" ")
              : "No encontramos ese enlace.";
        throw new Error(msg);
      }
      setPedidoUnico(data);
      if (pedidoDebeSincronizarMp(data)) {
        void (async () => {
          const r = await sincronizarPagoMercadoPagoPorPedidoConReintentos(data.id_pedido);
          if (r.ok && r.data?.mercadopago_payment_id) setPedidoUnico(r.data);
        })();
      }
    } catch (e) {
      setPedidoUnico(null);
      setError(e.message || "Error al consultar");
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarPorTelefono = useCallback(async (telRaw) => {
    const tel = telRaw?.trim();
    if (!tel) return;
    setLoadingTelefono(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/pedidos/consulta-seguimiento-telefono`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: tel }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof data?.detail === "string"
            ? data.detail
            : "No pudimos consultar. Probá de nuevo.";
        throw new Error(msg);
      }
      if (!Array.isArray(data)) {
        throw new Error("Respuesta inválida del servidor.");
      }
      const merged = await Promise.all(
        data.map(async (p) => {
          if (!pedidoDebeSincronizarMp(p)) return p;
          const r = await sincronizarPagoMercadoPagoPorPedidoConReintentos(p.id_pedido);
          return r.ok && r.data ? r.data : p;
        }),
      );
      setPedidosPorTelefono(merged);
      setTelefonoConsulta(tel);
      setPedidoUnico(null);
      if (data.length === 0) {
        setError(
          "No hay pedidos para mostrar con ese número (los solo “Recibido” y los entregados no se listan), o el teléfono no coincide. Revisá el código de área."
        );
      }
    } catch (e) {
      setPedidosPorTelefono([]);
      setTelefonoConsulta("");
      setError(e.message || "Error al consultar");
    } finally {
      setLoadingTelefono(false);
    }
  }, []);

  useEffect(() => {
    if (tokenFromUrl) {
      setPedidosPorTelefono(null);
      setTelefonoConsulta("");
      cargarPorToken(tokenFromUrl);
    }
  }, [tokenFromUrl, cargarPorToken]);

  useEffect(() => {
    if (!tokenFromUrl || !pedidoUnico) return;
    const id = setInterval(() => cargarPorToken(tokenFromUrl), 60000);
    return () => clearInterval(id);
  }, [tokenFromUrl, pedidoUnico, cargarPorToken]);

  useEffect(() => {
    if (tokenFromUrl || !telefonoConsulta || pedidosPorTelefono === null) return;
    const id = setInterval(() => cargarPorTelefono(telefonoConsulta), 60000);
    return () => clearInterval(id);
  }, [tokenFromUrl, telefonoConsulta, pedidosPorTelefono, cargarPorTelefono]);

  const handleTelefonoSubmit = (e) => {
    e.preventDefault();
    const t = telefono.trim();
    if (!t) return;
    const digitos = t.replace(/\D/g, "");
    if (digitos.length < 8) {
      setError("Ingresá un teléfono válido (al menos 8 dígitos).");
      return;
    }
    cargarPorTelefono(t);
  };

  const handleConsultarEnlace = (e) => {
    e.preventDefault();
    const raw = manualToken.trim();
    if (!raw) return;
    const extracted = extraerTokenDePegado(raw);
    navigate(`/seguimiento/${encodeURIComponent(extracted)}`, { replace: true });
  };

  const volverBuscarTelefono = () => {
    navigate("/seguimiento", { replace: true });
    setPedidoUnico(null);
    setError(null);
    setPedidosPorTelefono(null);
    setTelefonoConsulta("");
    setTelefono("");
    setManualToken("");
  };

  const mostrarResultadoToken = tokenFromUrl && !loading && pedidoUnico;
  const listaTelefono =
    !tokenFromUrl && pedidosPorTelefono !== null && pedidosPorTelefono.length > 0;

  return (
    <div className="seguimiento-page">
      <Navbar />
      <main className="container py-4 py-lg-5">
        <h1 className="display-6 display-font seg-title mb-2">Seguimiento de pedido</h1>
        <p className="seg-subtitle mb-4">
          Ingresá el <strong>mismo teléfono</strong> que usaste al hacer el pedido y ves los pedidos en
          curso (no mostramos los marcados solo como &quot;Recibido&quot; ni los ya entregados). Si
          pagaste con <strong>Mercado Pago</strong>, vas a ver el estado hasta que el local confirme el
          pago. Actualización automática cada minuto.
        </p>

        {!tokenFromUrl && (
          <form onSubmit={handleTelefonoSubmit} className="seg-form card border-0 shadow-sm p-4 mb-4">
            <label htmlFor="seg-telefono" className="form-label fw-semibold">
              Teléfono
            </label>
            <input
              id="seg-telefono"
              type="tel"
              className="form-control seg-input mb-2"
              autoComplete="tel"
              placeholder="Ej. 091 123 456"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
            <button type="submit" className="btn seg-btn" disabled={loadingTelefono}>
              {loadingTelefono ? "Buscando…" : "Ver mis pedidos"}
            </button>
            <p className="small text-muted mt-3 mb-0">
              <button
                type="button"
                className="btn btn-link btn-sm p-0 seg-link-muted"
                onClick={() => setMostrarPorEnlace((v) => !v)}
              >
                {mostrarPorEnlace ? "Ocultar" : "Tengo el enlace con código del pedido"}
              </button>
            </p>
            {mostrarPorEnlace && (
              <div className="mt-3 pt-3 border-top border-light">
                <label htmlFor="token-manual" className="form-label fw-semibold small">
                  Enlace o código al final de la URL
                </label>
                <textarea
                  id="token-manual"
                  className="form-control seg-input mb-2"
                  rows={2}
                  placeholder="Pegá el enlace completo o solo el código"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                />
                <button type="button" className="btn seg-btn seg-btn--outline" onClick={handleConsultarEnlace}>
                  Abrir con ese código
                </button>
              </div>
            )}
          </form>
        )}

        {tokenFromUrl && (
          <p className="mb-4">
            <button type="button" className="btn btn-link p-0 seg-link-muted" onClick={volverBuscarTelefono}>
              ← Buscar por teléfono
            </button>
          </p>
        )}

        {tokenFromUrl && loading && <p className="seg-subtitle">Cargando…</p>}
        {loadingTelefono && !tokenFromUrl && (
          <p className="seg-subtitle mb-3">Buscando tus pedidos…</p>
        )}

        {error && (
          <div className="alert alert-danger seg-alert" role="alert">
            {error}
          </div>
        )}

        {mostrarResultadoToken && (
          <PedidoCard
            pedido={pedidoUnico}
            showRefreshHint
            onPagoAsociado={(p) => setPedidoUnico(p)}
          />
        )}

        {listaTelefono && (
          <div className="seg-results-stack mb-4">
            <p className="fw-semibold seg-results-heading mb-3">
              {pedidosPorTelefono.length === 1
                ? "1 pedido con este número"
                : `${pedidosPorTelefono.length} pedidos con este número`}
            </p>
            {pedidosPorTelefono.map((p) => (
              <PedidoCard
                key={p.id_pedido}
                pedido={p}
                showRefreshHint={false}
                onPagoAsociado={() => telefonoConsulta && cargarPorTelefono(telefonoConsulta)}
              />
            ))}
            <p className="small text-muted mb-0">
              Actualizado automáticamente cada minuto mientras tengas esta página abierta.
            </p>
          </div>
        )}

        <p className="small text-muted mb-0">
          <Link to="/pedido">Hacer otro pedido</Link>
          {" · "}
          <Link to="/">Inicio</Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}

function PedidoCard({ pedido, showRefreshHint, onPagoAsociado }) {
  const info = ESTADOS[pedido.estado] || { label: pedido.estado, desc: "" };
  const mpOpRaw = pedido.mercadopago_payment_id || pedido.mercadopago_referencia;
  return (
    <div className="seg-result card border-0 shadow-sm p-4 mb-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <p className="text-muted small mb-1">Pedido #{pedido.id_pedido}</p>
          <span className={`seg-badge ${claseEstadoPedidoTone(pedido.estado)}`}>{info.label}</span>
        </div>
        <p className="mb-0 seg-total">
          Total <strong>${Number(pedido.total).toFixed(2)}</strong>
        </p>
      </div>
      <p className="seg-desc mb-3">{info.desc}</p>
      {pedido.medio_pago === "mercadopago" &&
        pedido.estado === "PENDIENTE_CONFIRMACION_MP" &&
        !pedido.mercadopago_payment_id &&
        !pedido.mercadopago_referencia && (
          <p className="small seg-mp-pendiente rounded-2 px-2 py-2 mb-3" role="status">
            Estamos confirmando tu pago con Mercado Pago. Si ya pagaste, en breve se actualiza solo; si
            pasan varios minutos, usá abajo &quot;Asociar pago&quot; con el n° de operación.
          </p>
        )}
      <p className="small seg-pago-line mb-2">
        Pago: <strong>{etiquetaMedioPago(pedido.medio_pago)}</strong>
        {pedido.medio_pago === "mercadopago" && mpOpRaw && (
          <>
            {" "}
            ·{" "}
            <MercadoPagoComprobanteLink
              paymentId={pedido.mercadopago_payment_id}
              referencia={pedido.mercadopago_referencia}
              className="seg-mp-comprobante"
            />
          </>
        )}
        {pedido.medio_pago === "mercadopago" && pedido.comprobante_adjunto && <> · Comprobante adjunto</>}
        {pedido.medio_pago === "efectivo" && pedido.efectivo_necesita_cambio && pedido.efectivo_pago_con != null && (
          <>
            {" "}
            · Cambio: paga con <strong>${Number(pedido.efectivo_pago_con).toFixed(2)}</strong>
          </>
        )}
      </p>
      {showRefreshHint && (
        <p className="small text-muted mb-2">
          Actualizado automáticamente cada minuto mientras tengas esta página abierta.
        </p>
      )}
      <ul className="list-unstyled seg-items mb-0">
        {pedido.items?.map((it, idx) => (
          <li key={idx} className="d-flex justify-content-between py-1 border-bottom border-light">
            <span>
              {it.nombre_producto} × {it.cantidad}
            </span>
            <span className="text-muted">${Number(it.subtotal).toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <AsociarPagoMpLink pedido={pedido} onActualizado={onPagoAsociado} />
    </div>
  );
}

function AsociarPagoMpLink({ pedido, onActualizado }) {
  const [op, setOp] = useState("");
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState(null);

  const mostrar =
    pedido.medio_pago === "mercadopago" &&
    !pedido.mercadopago_payment_id &&
    pedido.estado !== "CANCELADO" &&
    pedido.estado !== "ENTREGADO";

  if (!mostrar) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalErr(null);
    const raw = op.trim();
    if (!raw) {
      setLocalErr("Ingresá el número de operación que figura en Mercado Pago.");
      return;
    }
    setBusy(true);
    try {
      const base = String(API_URL).replace(/\/+$/, "");
      const res = await fetch(`${base}/pedidos/mercadopago/asociar-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_seguimiento: pedido.token_seguimiento,
          payment_id: raw,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.detail === "string"
            ? data.detail
            : "No se pudo asociar el pago. Revisá el número y que el monto coincida con el pedido.";
        throw new Error(msg);
      }
      setOp("");
      onActualizado?.(data);
    } catch (err) {
      setLocalErr(err.message || "Error de red");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="seg-mp-asociar mt-3 pt-3 border-top border-light" onSubmit={handleSubmit}>
      <p className="small fw-semibold mb-2">¿Pagaste con el link del negocio?</p>
      <p className="small text-muted mb-2">
        Pegá el <strong>número de operación</strong> (el de &quot;Operación #…&quot;) para vincular el pago a este
        pedido. Tiene que ser el mismo monto que este pedido.
      </p>
      <div className="d-flex flex-column flex-sm-row gap-2 align-items-stretch">
        <input
          type="text"
          className="form-control form-control-sm seg-input"
          placeholder="Ej. 153909079941"
          value={op}
          onChange={(e) => setOp(e.target.value)}
          autoComplete="off"
          disabled={busy}
          aria-label="Número de operación Mercado Pago"
        />
        <button type="submit" className="btn btn-sm seg-btn text-nowrap" disabled={busy}>
          {busy ? "Asociando…" : "Asociar pago"}
        </button>
      </div>
      {localErr && (
        <p className="small text-danger mb-0 mt-2" role="alert">
          {localErr}
        </p>
      )}
    </form>
  );
}

/** Acepta URL completa o solo el token */
function extraerTokenDePegado(texto) {
  const t = texto.trim();
  const m = t.match(/seguimiento\/([^/?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  return t;
}

function etiquetaMedioPago(medio) {
  const map = {
    efectivo: "Efectivo",
    debito: "Débito",
    mercadopago: "Mercado Pago",
  };
  return map[medio] || medio || "—";
}
