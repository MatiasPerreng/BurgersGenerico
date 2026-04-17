import API_URL from "./api";

/**
 * Público: mismo criterio que al volver de Checkout Pro con payment_id, pero usando solo
 * external_reference (= id_pedido en la preferencia) para encontrar el pago en la API de MP.
 */
export function pedidoDebeSincronizarMp(p) {
  if (!p || p.medio_pago !== "mercadopago") return false;
  if (p.mercadopago_payment_id || p.mercadopago_referencia) return false;
  if (p.estado === "CANCELADO" || p.estado === "ENTREGADO") return false;
  return true;
}

export async function sincronizarPagoMercadoPagoPorPedido(idPedido) {
  const base = String(API_URL).replace(/\/+$/, "");
  const res = await fetch(`${base}/pedidos/mercadopago/sincronizar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ external_reference: String(idPedido) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.detail;
    const errMsg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((x) => (x && typeof x === "object" && "msg" in x ? x.msg : String(x))).join(" ")
          : "No se pudo sincronizar con Mercado Pago.";
    return { ok: false, data: null, error: errMsg };
  }
  return { ok: true, data, error: null };
}

/** Reintenta: la API de MP a veces tarda unos segundos en indexar el pago tras acreditarse. */
export async function sincronizarPagoMercadoPagoPorPedidoConReintentos(idPedido) {
  const delays = [0, 2500, 5000];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
    const r = await sincronizarPagoMercadoPagoPorPedido(idPedido);
    if (r.ok && r.data?.mercadopago_payment_id) return r;
  }
  return sincronizarPagoMercadoPagoPorPedido(idPedido);
}

/** Devuelve solo dígitos del id de pago (p. ej. "Operación #154…" → "154…"). */
export function mercadoPagoPaymentIdDesdeTexto(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return s;
  const digits = s.replace(/\D/g, "");
  return digits.length >= 4 ? digits : null;
}

const DEFAULT_MP_RECEIPT_VIEW_HOST = "www.mercadopago.com.uy";

function mercadoPagoReceiptViewHost() {
  const v = import.meta.env.VITE_MERCADOPAGO_RECEIPT_VIEW_HOST;
  const s = v != null && String(v).trim() ? String(v).trim() : DEFAULT_MP_RECEIPT_VIEW_HOST;
  return s.replace(/^https?:\/\//, "").split("/")[0];
}

/**
 * Comprobante web en mercadopago.com.uy (número de operación en la ruta).
 * Ej.: https://www.mercadopago.com.uy/tools/receipt-view/154813837622
 */
export function urlMercadoPagoReceiptViewPorOperacion(raw) {
  const id = mercadoPagoPaymentIdDesdeTexto(raw);
  if (!id) return null;
  const host = mercadoPagoReceiptViewHost();
  return `https://${host}/tools/receipt-view/${encodeURIComponent(id)}`;
}

/** Misma cadena en `PedidoPage` (polling) y `PedidoPagoResultado` (aviso al otro tab). */
export const MP_BROADCAST_NAME = "lbv-mp-pedido";

const MP_SESSION_KEY = "lbv_mp_pending_v1";
/** No restaurar sesiones de checkout más viejas (evita banners fantasma). */
const MP_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function mpPendingCheckoutSave(pedidoSnapshot, idPedido) {
  try {
    sessionStorage.setItem(
      MP_SESSION_KEY,
      JSON.stringify({
        pedidoSnapshot,
        idPedido,
        phase: "polling",
        startedAt: Date.now(),
      }),
    );
  } catch {
    /* modo privado / cuota */
  }
}

export function mpPendingCheckoutClear() {
  try {
    sessionStorage.removeItem(MP_SESSION_KEY);
  } catch {
    /* */
  }
}

/**
 * Tras agotar reintentos de sync: el usuario puede seguir el pedido por Seguimiento.
 * Conserva `startedAt` para el TTL de 24 h.
 */
export function mpPendingCheckoutMarkExhausted(pedidoSnapshot, idPedido) {
  let startedAt = Date.now();
  try {
    const cur = sessionStorage.getItem(MP_SESSION_KEY);
    if (cur) {
      const j = JSON.parse(cur);
      if (typeof j.startedAt === "number") startedAt = j.startedAt;
    }
  } catch {
    /* */
  }
  try {
    sessionStorage.setItem(
      MP_SESSION_KEY,
      JSON.stringify({
        pedidoSnapshot,
        idPedido,
        phase: "exhausted",
        startedAt,
        exhaustedAt: Date.now(),
      }),
    );
  } catch {
    /* */
  }
}

/** { pedidoSnapshot, idPedido, phase, startedAt } | null */
export function mpPendingCheckoutLoad() {
  try {
    const raw = sessionStorage.getItem(MP_SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    const start = typeof p.startedAt === "number" ? p.startedAt : 0;
    if (!start || Date.now() - start > MP_SESSION_MAX_AGE_MS) {
      sessionStorage.removeItem(MP_SESSION_KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}
