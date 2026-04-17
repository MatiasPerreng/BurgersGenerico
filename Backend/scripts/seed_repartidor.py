"""
Crea un staff repartidor (usuario repartidor / repa123) si no existe.
Reutiliza el mismo ajuste de esquema que seed_admin.py.

Uso (desde la carpeta Backend):
  py -3 scripts/seed_repartidor.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError

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


def main():
    usuario = "repartidor"
    clave = "repa123"

    with engine.begin() as conn:
        ensure_staff_schema(conn)

    db = SessionLocal()
    try:
        if db.query(Staff).filter(Staff.usuario == usuario).first():
            print(f'Ya existe un staff con usuario "{usuario}". No se hizo nada.')
            return 0
        staff = Staff(
            nombre="Repartidor",
            usuario=usuario,
            email=None,
            password_hash=hash_password(clave),
            role="repartidor",
            is_active=True,
        )
        db.add(staff)
        db.commit()
        print(f'Listo: usuario "{usuario}" creado con rol repartidor (contraseña: {clave}).')
        return 0
    except IntegrityError as e:
        db.rollback()
        print(f"Error de integridad (¿usuario duplicado?): {e}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
