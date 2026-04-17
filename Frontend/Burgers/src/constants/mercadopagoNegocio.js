/**
 * Link de cobro del negocio (logo MP en Home y pedido).
 * Por defecto: link de pago La Buena Vida. Sobrescribí con VITE_MERCADOPAGO_LINK en .env si cambia.
 */
const MP_LINK_DEFAULT = "https://link.mercadopago.com.uy/labuenvida";

export const MERCADOPAGO_LINK_NEGOCIO =
  (import.meta.env.VITE_MERCADOPAGO_LINK && String(import.meta.env.VITE_MERCADOPAGO_LINK).trim()) ||
  MP_LINK_DEFAULT;

/** Public Key de MP (APP_USR-...) para Wallet/Bricks; opcional. Definí VITE_MERCADOPAGO_PUBLIC_KEY en .env */
export const MERCADOPAGO_PUBLIC_KEY =
  (import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY &&
    String(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY).trim()) ||
  "";
