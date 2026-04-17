-- Smash Burgers - esquema inicial (MySQL 8+)
-- Basado en la idea de ProyectoBarberia: clientes reutilizables + catálogo + pedidos

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `burgers`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `burgers`;

-- ---------------------------------------------------------------------------
-- Cliente (mismo concepto que barbería: identificación por teléfono)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cliente` (
  `id_cliente` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) NOT NULL,
  `telefono` varchar(20) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_cliente`),
  UNIQUE KEY `uq_cliente_telefono` (`telefono`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Productos del menú (antes "servicio")
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `producto` (
  `id_producto` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  `descripcion` varchar(500) DEFAULT NULL,
  `precio` decimal(10,2) NOT NULL,
  `categoria` varchar(50) NOT NULL DEFAULT 'hamburguesa',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `imagen` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_producto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Staff (admin / repartidor — debe existir antes de `pedido.id_repartidor`)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `staff` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `usuario` varchar(64) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'repartidor',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_staff_usuario` (`usuario`),
  UNIQUE KEY `ux_staff_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Pedido (reemplaza "visita" / turno)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pedido` (
  `id_pedido` int unsigned NOT NULL AUTO_INCREMENT,
  `id_cliente` int unsigned NOT NULL,
  `id_repartidor` int unsigned DEFAULT NULL,
  `estado` enum('PENDIENTE_CONFIRMACION_MP','PENDIENTE','EN_PREPARACION','LISTO','EN_CAMINO','ENTREGADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
  `total` decimal(10,2) NOT NULL,
  `direccion` varchar(255) NOT NULL,
  `referencia` varchar(255) DEFAULT NULL,
  `notas` varchar(500) DEFAULT NULL,
  `medio_pago` varchar(32) NOT NULL DEFAULT 'efectivo',
  `efectivo_necesita_cambio` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = necesita vuelto',
  `efectivo_pago_con` decimal(10,2) DEFAULT NULL COMMENT 'Paga con (monto) para preparar cambio',
  `mercadopago_referencia` varchar(128) DEFAULT NULL,
  `mercadopago_payment_id` varchar(64) DEFAULT NULL,
  `comprobante_archivo` varchar(255) DEFAULT NULL,
  `token_seguimiento` varchar(43) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_pedido`),
  UNIQUE KEY `uq_pedido_token` (`token_seguimiento`),
  KEY `fk_pedido_cliente` (`id_cliente`),
  KEY `fk_pedido_repartidor` (`id_repartidor`),
  CONSTRAINT `fk_pedido_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `cliente` (`id_cliente`),
  CONSTRAINT `fk_pedido_repartidor` FOREIGN KEY (`id_repartidor`) REFERENCES `staff` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Ítems del pedido
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pedido_item` (
  `id_item` int unsigned NOT NULL AUTO_INCREMENT,
  `id_pedido` int unsigned NOT NULL,
  `id_producto` int unsigned NOT NULL,
  `cantidad` int unsigned NOT NULL,
  `precio_unitario` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id_item`),
  KEY `fk_item_pedido` (`id_pedido`),
  KEY `fk_item_producto` (`id_producto`),
  CONSTRAINT `fk_item_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedido` (`id_pedido`) ON DELETE CASCADE,
  CONSTRAINT `fk_item_producto` FOREIGN KEY (`id_producto`) REFERENCES `producto` (`id_producto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Menú: burgers, bebidas, acompañamientos y combos (promos LBV)
INSERT INTO `producto` (`nombre`, `descripcion`, `precio`, `categoria`, `activo`, `imagen`) VALUES
('Mega Combo', 'Dos Buena Vida Dobles, Cheese Burger Simple y papas fritas.', 1140.00, 'combos', 1, NULL),
('Super Combo 2.3', 'Dos Buena Vida Triples y papas fritas.', 940.00, 'combos', 1, NULL),
('Super Combo 2.2', 'Dos Buena Vida Dobles y papas fritas.', 840.00, 'combos', 1, NULL),
('Smash Classic', 'Doble carne smash, queso cheddar, pepinillos y salsa house.', 420.00, 'hamburguesa', 1, NULL),
('Smash Bacon', 'Doble smash, bacon crispy, cheddar y cebolla caramelizada.', 480.00, 'hamburguesa', 1, NULL),
('Smash Spicy', 'Jalapeños, mayo picante y queso pepper jack.', 460.00, 'hamburguesa', 1, NULL),
('Papas Smash', 'Papas cortadas a mano con sal parrillera.', 180.00, 'acompañamiento', 1, NULL),
('Gaseosa 500ml', 'Bebida fría.', 90.00, 'bebida', 1, NULL);

-- Opcional: insertar staff con hash bcrypt generado en tu entorno (ver Backend/scripts/generar_hash_staff.py)
