from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import crud.pedido as crud_pedido
import crud.staff as crud_staff
from database import get_db
from deps.auth import require_admin
from schemas import PedidoEstadoPatch, PedidoOut, RepartidorListOut

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_admin)],
)


@router.get("/repartidores", response_model=List[RepartidorListOut])
def listar_repartidores(db: Session = Depends(get_db)):
    reps = crud_staff.listar_repartidores_activos(db)
    return [RepartidorListOut.model_validate(r) for r in reps]


@router.get("/pedidos", response_model=List[PedidoOut])
def listar_todos_los_pedidos(db: Session = Depends(get_db)):
    return crud_pedido.listar_pedidos_para_staff(db, None, None)


@router.patch("/pedidos/{id_pedido}", response_model=PedidoOut)
def actualizar_estado(
    id_pedido: int,
    body: PedidoEstadoPatch,
    db: Session = Depends(get_db),
):
    out = crud_pedido.actualizar_estado_pedido(
        db,
        id_pedido,
        body.estado,
        body.id_repartidor,
    )
    if not out:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado",
        )
    return out
