import time
from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Prestamo
from schemas import PrestamoCreate, PrestamoOut, Resumen


def esperar_bd(intentos: int = 10, espera: float = 2.0) -> None:
    for i in range(1, intentos + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except OperationalError:
            print(f"BD no disponible (intento {i}/{intentos}), reintentando en {espera}s...")
            time.sleep(espera)
    raise RuntimeError("No se pudo conectar a la base de datos")


@asynccontextmanager
async def lifespan(app: FastAPI):
    esperar_bd()
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="LabPresta", lifespan=lifespan)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/prestamos", response_model=list[PrestamoOut])
def listar_prestamos(q: str | None = None, db: Session = Depends(get_db)):
    consulta = select(Prestamo).order_by(Prestamo.fecha_prestamo.desc(), Prestamo.id.desc())
    if q and q.strip():
        patron = f"%{q.strip()}%"
        consulta = consulta.where(
            or_(Prestamo.equipo.ilike(patron), Prestamo.responsable.ilike(patron))
        )
    return db.scalars(consulta).all()


@app.post("/api/prestamos", response_model=PrestamoOut, status_code=status.HTTP_201_CREATED)
def crear_prestamo(datos: PrestamoCreate, db: Session = Depends(get_db)):
    prestamo = Prestamo(**datos.model_dump())
    db.add(prestamo)
    db.commit()
    db.refresh(prestamo)
    return prestamo


@app.patch("/api/prestamos/{prestamo_id}/devolver", response_model=PrestamoOut)
def devolver_prestamo(prestamo_id: int, db: Session = Depends(get_db)):
    prestamo = db.get(Prestamo, prestamo_id)
    if prestamo is None:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    if prestamo.devuelto:
        raise HTTPException(status_code=409, detail="El préstamo ya fue devuelto")
    prestamo.devuelto = True
    prestamo.fecha_devolucion = date.today()
    db.commit()
    db.refresh(prestamo)
    return prestamo


@app.get("/api/resumen", response_model=Resumen)
def resumen(db: Session = Depends(get_db)):
    total = db.scalar(select(func.count(Prestamo.id))) or 0
    devueltos = db.scalar(select(func.count(Prestamo.id)).where(Prestamo.devuelto.is_(True))) or 0
    return Resumen(total=total, activos=total - devueltos, devueltos=devueltos)


# Montar los estáticos al final para que no tapen las rutas /api.
app.mount("/", StaticFiles(directory="static", html=True), name="static")
