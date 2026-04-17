-- Seguimiento sin login: enlace secreto por pedido (MySQL 8+)
USE `burgers`;

ALTER TABLE `pedido`
  ADD COLUMN `token_seguimiento` varchar(43) NULL DEFAULT NULL AFTER `notas`,
  ADD UNIQUE KEY `uq_pedido_token` (`token_seguimiento`);

-- Pedidos ya creados sin token: generá uno por fila (enlace válido para seguimiento)
UPDATE `pedido`
SET `token_seguimiento` = REPLACE(UUID(), '-', '')
WHERE `token_seguimiento` IS NULL;

-- Opcional: acortar a 32 chars hex (único)
-- Si el UPDATE anterior duplicara en teoría, no debería; si falla el UNIQUE, ejecutar fila a fila.

ALTER TABLE `pedido`
  MODIFY `token_seguimiento` varchar(43) NOT NULL;
