import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class ClienteBase(BaseModel):
    nombre: str
    apellido: str
    telefono: str
    email: Optional[EmailStr] = None


class ClienteCreate(ClienteBase):
    pass


class ClienteOut(ClienteBase):
    id_cliente: int
    created_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True
