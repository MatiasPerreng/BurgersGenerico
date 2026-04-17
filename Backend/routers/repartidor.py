from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import crud.pedido as crud_pedido
from database import get_db
from deps.auth import require_repartidor
from models import Staff
from schemas import PedidoOut

router = APIRouter(prefix="/repartidor", tags=["Repartidor"])


@router.get("/pedidos", response_model=List[PedidoOut])
def pedidos_en_la_calle(
    db: Session = Depends(get_db),
    staff: Staff = Depends(require_repartidor),
):
    """Pedidos EN_CAMINO asignados a este repartidor."""
    return crud_pedido.listar_pedidos_para_staff(db, "EN_CAMINO", staff.id)


@router.post("/pedidos/{id_pedido}/entregado", response_model=PedidoOut)
def marcar_como_entregado(
    id_pedido: int,
    db: Session = Depends(get_db),
    staff: Staff = Depends(require_repartidor),
):
    out = crud_pedido.marcar_entregado_repartidor(db, id_pedido, staff.id)
    if not out:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado",
        )
    return out
