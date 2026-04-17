-- Repartidor asignado al pedido (estado EN_CAMINO). Requiere tabla `staff`.
USE `burgers`;

ALTER TABLE `pedido`
  ADD COLUMN `id_repartidor` int unsigned DEFAULT NULL
    AFTER `id_cliente`;

ALTER TABLE `pedido`
  ADD KEY `fk_pedido_repartidor` (`id_repartidor`),
  ADD CONSTRAINT `fk_pedido_repartidor`
    FOREIGN KEY (`id_repartidor`) REFERENCES `staff` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
