import { urlMercadoPagoReceiptViewPorOperacion } from "../../services/mercadopagoSync";
import "./MercadoPagoComprobanteLink.css";

/**
 * Enlace al comprobante web MP (/tools/receipt-view/{operación}).
 * Logo + texto "Ver comprobante" (el n° de operación no se muestra; queda en el title del enlace).
 */
export default function MercadoPagoComprobanteLink({ paymentId, referencia, className = "" }) {
  const raw = String(paymentId || referencia || "").trim();
  if (!raw) return null;
  const href = urlMercadoPagoReceiptViewPorOperacion(raw);
  if (!href) {
    return (
      <span className={`mp-comprobante-link mp-comprobante-link--fallback ${className}`.trim()}>
        {raw}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`mp-comprobante-link mp-comprobante-link--chip ${className}`.trim()}
      title={`Ver comprobante en Mercado Pago (operación ${raw})`}
      aria-label={`Ver comprobante Mercado Pago, operación ${raw}`}
    >
      <img
        className="mp-comprobante-link__logo"
        src="/img/mercadopago-logo.png"
        alt=""
        width={100}
        height={28}
        loading="lazy"
      />
      <span className="mp-comprobante-link__text">Ver comprobante</span>
    </a>
  );
}
