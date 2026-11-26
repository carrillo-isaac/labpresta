from datetime import date

from sqlalchemy import Boolean, Date, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Prestamo(Base):
    __tablename__ = "prestamos"

    id: Mapped[int] = mapped_column(primary_key=True)
    equipo: Mapped[str] = mapped_column(String(100), nullable=False)
    responsable: Mapped[str] = mapped_column(String(100), nullable=False)
    fecha_prestamo: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    devuelto: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    fecha_devolucion: Mapped[date | None] = mapped_column(Date, nullable=True)
