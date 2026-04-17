"""
Agrega la columna pedido.id_repartidor y la FK a staff (misma migración que
Database/add_pedido_id_repartidor.sql). Idempotente: si ya existe, no falla.

Uso (desde la carpeta Backend, con .venv activado):
  py -3 scripts/add_pedido_id_repartidor.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from database import engine


def _mysql_err(e: OperationalError) -> str:
    orig = getattr(e, "orig", None)
    return str(orig) if orig else str(e)


def main() -> int:
    stmts = [
        (
            "add_column",
            text(
                "ALTER TABLE pedido ADD COLUMN id_repartidor INT UNSIGNED NULL DEFAULT NULL "
                "AFTER id_cliente"
            ),
        ),
        (
            "add_fk",
            text(
                "ALTER TABLE pedido "
                "ADD KEY fk_pedido_repartidor (id_repartidor), "
                "ADD CONSTRAINT fk_pedido_repartidor "
                "FOREIGN KEY (id_repartidor) REFERENCES staff (id) "
                "ON DELETE SET NULL ON UPDATE CASCADE"
            ),
        ),
    ]

    with engine.begin() as conn:
        for name, stmt in stmts:
            try:
                conn.execute(stmt)
                print(f"OK: {name}")
            except OperationalError as e:
                err = _mysql_err(e)
                if "Duplicate column" in err or "1060" in err:
                    print(f"Omitido ({name}): columna ya existe.")
                elif "Duplicate key name" in err or "1061" in err:
                    print(f"Omitido ({name}): índice ya existe.")
                elif "Duplicate foreign key" in err or "1826" in err or "1022" in err:
                    print(f"Omitido ({name}): FK ya existe.")
                else:
                    raise

    print("Listo: pedido.id_repartidor aplicado. Reiniciá uvicorn si estaba en marcha.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
