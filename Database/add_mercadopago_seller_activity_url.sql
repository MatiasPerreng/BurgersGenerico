-- URL de Actividades (detalle del cobro para el vendedor en mercadopago.com.uy), derivada del JSON del pago al sincronizar.
-- OBLIGATORIO si usás el backend con el modelo que incluye esta columna: sin ALTER, fallan SELECT/UPDATE de pedidos.
ALTER TABLE `pedido`
  ADD COLUMN `mercadopago_seller_activity_url` varchar(512) DEFAULT NULL
  COMMENT 'URL Actividades MP vendedor (checkout_merchant_order-…)' AFTER `mercadopago_receipt_url`;
