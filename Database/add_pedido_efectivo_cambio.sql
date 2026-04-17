-- Efectivo: ¿necesita cambio? ¿con cuánto paga? (para preparar vuelto)
-- Ejecutar sobre la base `burgers` si la tabla `pedido` ya existe.

ALTER TABLE `pedido`
  ADD COLUMN `efectivo_necesita_cambio` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = el cliente necesita vuelto' AFTER `medio_pago`,
  ADD COLUMN `efectivo_pago_con` DECIMAL(10,2) DEFAULT NULL
    COMMENT 'Monto con el que paga (>= total) si necesita cambio' AFTER `efectivo_necesita_cambio`;
