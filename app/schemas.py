from datetime import date
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class PrestamoCreate(BaseModel):
    equipo: Texto
    responsable: Texto
    fecha_prestamo: date = Field(default_factory=date.today)


class PrestamoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    equipo: str
    responsable: str
    fecha_prestamo: date
    devuelto: bool
    fecha_devolucion: date | None


class Resumen(BaseModel):
    total: int
    activos: int
    devueltos: int
