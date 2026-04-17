-- Si la BD ya existía: agrega los combos solo si no están (MySQL 8+)
USE `burgers`;

INSERT INTO `producto` (`nombre`, `descripcion`, `precio`, `categoria`, `activo`, `imagen`)
SELECT 'Mega Combo', 'Dos Buena Vida Dobles, Cheese Burger Simple y papas fritas.', 1140.00, 'combos', 1, NULL
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `producto` WHERE `nombre` = 'Mega Combo' LIMIT 1);

INSERT INTO `producto` (`nombre`, `descripcion`, `precio`, `categoria`, `activo`, `imagen`)
SELECT 'Super Combo 2.3', 'Dos Buena Vida Triples y papas fritas.', 940.00, 'combos', 1, NULL
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `producto` WHERE `nombre` = 'Super Combo 2.3' LIMIT 1);

INSERT INTO `producto` (`nombre`, `descripcion`, `precio`, `categoria`, `activo`, `imagen`)
SELECT 'Super Combo 2.2', 'Dos Buena Vida Dobles y papas fritas.', 840.00, 'combos', 1, NULL
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `producto` WHERE `nombre` = 'Super Combo 2.2' LIMIT 1);
