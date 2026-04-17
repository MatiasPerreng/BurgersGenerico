/** Clases CSS compartidas (`pedidoEstadoColores.css`) para badges admin/seguimiento. */
const ESTADOS_CON_TONO = new Set([
  "pendiente_confirmacion_mp",
  "pendiente",
  "en_preparacion",
  "listo",
  "en_camino",
  "entregado",
  "cancelado",
]);

/**
 * @param {string} [estado] valor API (ej. LISTO)
 * @returns {string} clases `estado-pedido-tone estado-pedido-tone--…`
 */
export function claseEstadoPedidoTone(estado) {
  const k = String(estado ?? "").toLowerCase();
  const suffix = ESTADOS_CON_TONO.has(k) ? k : "otro";
  return `estado-pedido-tone estado-pedido-tone--${suffix}`;
}

/** Etiquetas para UI (cliente, admin, repartidor). */
export const ESTADO_PEDIDO_LABEL = {
  PENDIENTE_CONFIRMACION_MP: "Mercado Pago — confirmar pago",
  PENDIENTE: "Recibido",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo",
  EN_CAMINO: "En la calle",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

/** Opciones para select admin (valor API → valor formulario).
 *  No incluye PENDIENTE_CONFIRMACION_MP: ese estado solo se asigna al crear el pedido y se resuelve con los botones del panel.
 */
export const ESTADOS_ADMIN_OPCIONES = [
  { value: "PENDIENTE", label: "Recibido" },
  { value: "EN_PREPARACION", label: "En preparación" },
  { value: "LISTO", label: "Listo" },
  { value: "EN_CAMINO", label: "En la calle" },
  { value: "ENTREGADO", label: "Entregado" },
  { value: "CANCELADO", label: "Cancelado" },
];
