import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import API_URL from "../../services/api";
import MercadoPagoComprobanteLink from "../../components/MercadoPagoComprobanteLink/MercadoPagoComprobanteLink";
import { MP_BROADCAST_NAME } from "../../services/mercadopagoSync";
import "./PedidoPagoResultado.css";

function apiBase() {
  return String(API_URL).replace(/\/+$/, "");
}

/**
 * MP a veces manda parámetros en el fragmento (#...) además del query (?).
 * useSearchParams() solo ve ? — por eso mergeamos search + hash.
 */
function mergeSearchAndHash(location) {
  const merged = new URLSearchParams(location.search);
  const h = location.hash;
  if (h && h.length > 1) {
    const raw = h.startsWith("#") ? h.slice(1) : h;
    if (raw.includes("=")) {
      // "#/ruta?payment_id=…" no es parseable por URLSearchParams(raw) (arma keys rotas).
      const queryPart = raw.includes("?") ? raw.split("?").slice(1).join("?") : raw;
      const hp = new URLSearchParams(queryPart);
      hp.forEach((value, key) => {
        if (!merged.has(key)) merged.set(key, value);
      });
    }
  }
  return merged;
}

/**
 * Retorno desde Checkout Pro: Mercado Pago redirige con payment_id (y a veces collection_id).
 */
export default function PedidoPagoResultado() {
  const location = useLocation();
  const params = useMemo(() => mergeSearchAndHash(location), [location.search, location.hash]);
  const [state, setState] = useState({ loading: true, error: null, pedido: null });
  const broadcastHecho = useRef(false);

  /** Avisar a la pestaña del pedido (/pedido) que el pago ya quedó asociado. */
  useEffect(() => {
    const ped = state.pedido;
    if (!ped || broadcastHecho.current) return;
    if (!ped.mercadopago_payment_id && !ped.mercadopago_referencia) return;
    broadcastHecho.current = true;
    try {
      const bc = new BroadcastChannel(MP_BROADCAST_NAME);
      bc.postMessage({ type: "paid", pedido: ped });
      bc.close();
    } catch {
      /* */
    }
  }, [state.pedido]);

  useEffect(() => {
    const collectionStatus = params.get("collection_status");
    const status = params.get("status");

    if (collectionStatus === "null" || status === "null") {
      setState({
        loading: false,
        error: "No se completó el pago en Mercado Pago.",
        pedido: null,
      });
      return;
    }

    if (collectionStatus === "rejected" || status === "rejected") {
      setState({
        loading: false,
        error: "El pago fue rechazado. Podés intentar de nuevo desde el pedido o elegir otro medio de pago.",
        pedido: null,
      });
      return;
    }

    const paymentId = params.get("payment_id") || params.get("collection_id");
    const extRef = params.get("external_reference");
    const prefId = params.get("preference_id");

    if (!paymentId && !extRef && !prefId) {
      setState({
        loading: false,
        error:
          "No se recibieron datos del pago en la URL (ni en #). Si ya pagaste, probá Seguimiento con tu teléfono o cargá el n° de operación allí.",
        pedido: null,
      });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const syncBody = {};
        if (paymentId) syncBody.payment_id = paymentId;
        if (extRef) syncBody.external_reference = extRef;
        if (prefId) syncBody.preference_id = prefId;

        const res = await fetch(`${apiBase()}/pedidos/mercadopago/sincronizar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(syncBody),
        });
        const raw = await res.text();
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = {};
        }
        if (!res.ok) {
          const msg =
            typeof data.detail === "string"
              ? data.detail
              : Array.isArray(data.detail)
                ? data.detail.map((x) => x.msg || x).join(" ")
                : "No se pudo confirmar el pago todavía. Probá de nuevo en un momento o revisá Seguimiento.";
          throw new Error(msg);
        }
        if (!cancelled) setState({ loading: false, error: null, pedido: data });
      } catch (e) {
        if (!cancelled) {
          setState({
            loading: false,
            error: e.message || "Error al sincronizar",
            pedido: null,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <div className="pedido-page">
      <Navbar />
      <main className="container py-4 py-lg-5">
        <div className="pedido-mp-result">
          <h1 className="display-6 display-font lbv-page-title mb-3 pedido-mp-result__title">
            Pago — Mercado Pago
          </h1>

          {state.loading && <p className="lbv-page-subtitle">Confirmando con el servidor…</p>}

          {!state.loading && state.error && (
            <div className="alert alert-warning border-0" role="status">
              <p className="mb-2">{state.error}</p>
              <Link to="/seguimiento" className="alert-link">
                Ir a seguimiento
              </Link>
            </div>
          )}

          {!state.loading && state.pedido && (
            <div className="alert lbv-alert-success border-0" role="status">
              <p className="mb-2">
                Pedido <strong>#{state.pedido.id_pedido}</strong> · Estado:{" "}
                <strong>{state.pedido.estado}</strong>
              </p>
              {(state.pedido.mercadopago_payment_id ||
                state.pedido.mercadopago_referencia ||
                state.pedido.mercadopago_receipt_url) && (
                <p className="small mb-2 d-flex flex-wrap align-items-center gap-2">
                  {(state.pedido.mercadopago_payment_id || state.pedido.mercadopago_referencia) && (
                    <MercadoPagoComprobanteLink
                      paymentId={state.pedido.mercadopago_payment_id}
                      referencia={state.pedido.mercadopago_referencia}
                    />
                  )}
                  {state.pedido.mercadopago_receipt_url &&
                    !(state.pedido.mercadopago_payment_id || state.pedido.mercadopago_referencia) && (
                      <a
                        href={state.pedido.mercadopago_receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ver comprobante (PDF)
                      </a>
                    )}
                </p>
              )}
              <p className="small mb-0">
                <Link to={`/seguimiento/${encodeURIComponent(state.pedido.token_seguimiento)}`}>
                  Ver seguimiento del pedido
                </Link>
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
