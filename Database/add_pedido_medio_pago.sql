-- Ejecutar en MySQL si la BD ya existe (agrega pago y comprobante al pedido).
USE `burgers`;

ALTER TABLE `pedido`
  ADD COLUMN `medio_pago` varchar(32) NOT NULL DEFAULT 'efectivo' AFTER `notas`,
  ADD COLUMN `mercadopago_referencia` varchar(128) DEFAULT NULL COMMENT 'N° de operación que pega el cliente (opcional)' AFTER `medio_pago`,
  ADD COLUMN `mercadopago_payment_id` varchar(64) DEFAULT NULL COMMENT 'ID de pago MP (webhook o return URL; futuro)' AFTER `mercadopago_referencia`,
  ADD COLUMN `comprobante_archivo` varchar(255) DEFAULT NULL COMMENT 'Nombre archivo guardado en static/comprobantes/' AFTER `mercadopago_payment_id`;
