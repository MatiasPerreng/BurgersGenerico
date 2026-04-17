-- Alternativa al ENUM: cualquier estado nuevo (p. ej. PENDIENTE_CONFIRMACION_MP) sin listar valores.
-- Ejecutar en la base `burgers` si preferís no usar add_estado_pendiente_confirmacion_mp.sql

USE `burgers`;

ALTER TABLE `pedido`
  MODIFY COLUMN `estado` VARCHAR(32) NOT NULL DEFAULT 'PENDIENTE';
