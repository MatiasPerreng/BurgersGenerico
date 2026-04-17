-- Comprobante oficial (URL) devuelto por la API de Mercado Pago al consultar el pago.
ALTER TABLE `pedido`
  ADD COLUMN `mercadopago_receipt_url` varchar(512) DEFAULT NULL
  COMMENT 'URL comprobante MP (API payments)' AFTER `mercadopago_payment_id`;
