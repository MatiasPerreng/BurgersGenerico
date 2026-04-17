from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from crud import producto as crud_producto
from database import get_db
from schemas import ProductoOut

router = APIRouter(prefix="/productos", tags=["Productos"])


@router.get("/", response_model=List[ProductoOut])
def listar_menu(db: Session = Depends(get_db)):
    return crud_producto.listar_productos_activos(db)
