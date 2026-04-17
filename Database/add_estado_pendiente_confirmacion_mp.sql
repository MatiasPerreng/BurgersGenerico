-- Mercado Pago: estado hasta que cocina/admin confirme el comprobante.
-- Ejecutar sobre la base `burgers` si `pedido.estado` es ENUM.
-- Si en tu instalación `estado` ya es VARCHAR(30), no hace falta este script.

USE `burgers`;

ALTER TABLE `pedido`
  MODIFY COLUMN `estado` ENUM(
    'PENDIENTE_CONFIRMACION_MP',
    'PENDIENTE',
    'EN_PREPARACION',
    'LISTO',
    'EN_CAMINO',
    'ENTREGADO',
    'CANCELADO'
  ) NOT NULL DEFAULT 'PENDIENTE';
