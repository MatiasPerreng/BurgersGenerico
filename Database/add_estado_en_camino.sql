-- Agrega estado EN_CAMINO (pedido salió / lo ve el repartidor).
USE `burgers`;

ALTER TABLE `pedido`
  MODIFY COLUMN `estado` ENUM(
    'PENDIENTE',
    'EN_PREPARACION',
    'LISTO',
    'EN_CAMINO',
    'ENTREGADO',
    'CANCELADO'
  ) NOT NULL DEFAULT 'PENDIENTE';
