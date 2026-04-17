-- Usuarios staff tras ejecutar burgers_schema.sql
-- Contraseñas: admin → admin123 | jose y juan → 123
USE `burgers`;

INSERT INTO `staff` (`nombre`, `usuario`, `email`, `password_hash`, `role`, `is_active`) VALUES
(
  'Administrador',
  'admin',
  NULL,
  'pbkdf2_sha256$100000$0ae76ff0287afbc819757cf520faaac1$223afaa3c0a6b26a61cbe5b15da8fc054793156eece9a9ca7499d8fee018c571',
  'admin',
  1
),
(
  'Jose',
  'jose',
  NULL,
  'pbkdf2_sha256$100000$3ed12b8aa58ea108b401f815d78fc870$bab486ac7d97e0d2f042044ba7930f5d8e2a673674fae7102c4955355de72099',
  'repartidor',
  1
),
(
  'Juan',
  'juan',
  NULL,
  'pbkdf2_sha256$100000$3ed12b8aa58ea108b401f815d78fc870$bab486ac7d97e0d2f042044ba7930f5d8e2a673674fae7102c4955355de72099',
  'repartidor',
  1
);
