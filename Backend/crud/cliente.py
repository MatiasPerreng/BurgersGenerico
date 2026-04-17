from sqlalchemy.orm import Session

from models import Cliente
from schemas import ClienteCreate


def obtener_o_crear_cliente(db: Session, datos: ClienteCreate) -> Cliente:
    cliente = db.query(Cliente).filter(Cliente.telefono == datos.telefono).first()
    if cliente:
        if datos.nombre and cliente.nombre != datos.nombre:
            cliente.nombre = datos.nombre
        if datos.apellido and cliente.apellido != datos.apellido:
            cliente.apellido = datos.apellido
        if datos.email and cliente.email != datos.email:
            cliente.email = datos.email
        db.commit()
        db.refresh(cliente)
        return cliente

    cliente = Cliente(
        nombre=datos.nombre,
        apellido=datos.apellido,
        telefono=datos.telefono,
        email=datos.email,
    )
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente
