"""
Borra todas las filas de `staff` y vuelve a crear admin y repartidor con columnas
correctas (usuario, password_hash, role, is_active).

Usá esto si en la BD el hash quedó en `role`, el login en `email`, etc.

Uso (desde Backend):
  .\\.venv\\Scripts\\python.exe scripts\\resync_staff_users.py

Los pedidos con id_repartidor apuntando a staff borrado quedan con repartidor NULL (FK ON DELETE SET NULL).
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from database import SessionLocal, engine
from models import Staff
from utils.passwords import hash_password


def ensure_staff_schema(conn):
    try:
        conn.execute(
            text("ALTER TABLE staff ADD COLUMN usuario varchar(64) NULL AFTER nombre")
        )
    except OperationalError as e:
        err = str(e.orig) if hasattr(e, "orig") else str(e)
        if "Duplicate column" not in err and "1060" not in err:
            raise
    try:
        conn.execute(text("ALTER TABLE staff MODIFY email varchar(100) NULL"))
    except OperationalError:
        pass
    try:
        conn.execute(text("CREATE UNIQUE INDEX ux_staff_usuario ON staff (usuario)"))
    except OperationalError as e:
        err = str(e.orig) if hasattr(e, "orig") else str(e)
        if "Duplicate key name" not in err and "1061" not in err:
            raise


def main() -> int:
    with engine.begin() as conn:
        ensure_staff_schema(conn)
        conn.execute(text("DELETE FROM staff"))
        conn.execute(text("ALTER TABLE staff AUTO_INCREMENT = 1"))

    db = SessionLocal()
    try:
        db.add_all(
            [
                Staff(
                    nombre="Administrador",
                    usuario="admin",
                    email=None,
                    password_hash=hash_password("admin123"),
                    role="admin",
                    is_active=True,
                ),
                Staff(
                    nombre="Repartidor",
                    usuario="repartidor",
                    email=None,
                    password_hash=hash_password("repa123"),
                    role="repartidor",
                    is_active=True,
                ),
            ]
        )
        db.commit()
        print(
            "Listo: staff limpiado y recreado.\n"
            "  admin / admin123\n"
            "  repartidor / repa123"
        )
        return 0
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
