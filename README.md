# LabPresta

Aplicación web para registrar y consultar los préstamos de equipos del laboratorio de informática.
Cada préstamo guarda el **equipo**, la **persona responsable** y la **fecha del préstamo**. Además se
puede buscar, marcar un préstamo como devuelto y ver contadores (total, activos, devueltos).

El objetivo del laboratorio es practicar **Docker Compose**: la aplicación y la base de datos corren en
**dos contenedores separados**, se comunican por la red interna de Compose, la app publica un puerto
al host y los datos se guardan en un **volumen** que sobrevive a la eliminación del contenedor de la BD.

## Arquitectura

```
 Navegador
     │  http://localhost:8000
     ▼
┌───────────────────────────┐        red interna de Compose        ┌──────────────────────────┐
│ app (FastAPI + estáticos) │ ───────────────────────────────────▶ │ db (PostgreSQL 16)       │
│ puerto publicado 8000     │   postgresql+psycopg://…@db:5432     │ sin puertos publicados   │
└───────────────────────────┘                                      └────────────┬─────────────┘
                                                                                │
                                                                   volumen pgdata
                                                                   /var/lib/postgresql/data
```

| Capa | Tecnología |
|---|---|
| API | Python 3.12, FastAPI, Uvicorn |
| ORM | SQLAlchemy 2.x + psycopg 3 |
| Base de datos | PostgreSQL 16 (`postgres:16-alpine`) |
| Frontend | HTML + JavaScript (fetch) + Tailwind CSS por CDN |

## Cómo clonar y ejecutar

### Requisitos
- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto (o Docker Engine con el plugin Compose)

No hace falta instalar Python ni PostgreSQL: todo corre dentro de los contenedores.

### 1. Clonar el repositorio

```bash
git clone https://github.com/carrillo-isaac/labpresta.git
cd labpresta
```

### 2. Crear el archivo de variables de entorno

Linux, macOS o Git Bash:
```bash
cp .env.example .env
```

Windows (PowerShell):
```powershell
Copy-Item .env.example .env
```

Opcionalmente se puede cambiar la contraseña en `.env`.

### 3. Construir y levantar los contenedores

```bash
docker compose up -d --build
docker compose ps             # db debe aparecer como "healthy" y app como "Up"
```

La primera vez tarda uno o dos minutos mientras descarga las imágenes.

### 4. Abrir la aplicación

Abrir **http://localhost:8000**. La documentación interactiva de la API está en http://localhost:8000/docs.

> Si el puerto 8000 ya está ocupado en tu máquina, cambia `APP_PORT` en `.env` (por ejemplo
> `APP_PORT=8088`) y usa ese puerto en el navegador.

Para detener todo: `docker compose down` (los datos se conservan en el volumen).

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Comprueba que la API responde |
| GET | `/api/prestamos?q=texto` | Lista préstamos (más recientes primero); `q` filtra por equipo o responsable |
| POST | `/api/prestamos` | Registra un préstamo (`equipo`, `responsable`, `fecha_prestamo` opcional) |
| PATCH | `/api/prestamos/{id}/devolver` | Marca como devuelto (404 si no existe, 409 si ya estaba devuelto) |
| GET | `/api/resumen` | Contadores: total, activos, devueltos |

Validación en el servidor: equipo y responsable no vacíos y de máximo 100 caracteres; fecha válida (422 si falla).

## Prueba de persistencia

Demuestra que los datos viven en el volumen y no en el contenedor:

```bash
# 1. Registrar un préstamo desde el navegador (por ejemplo "Laptop Dell 01" - "María Pérez")

# 2. Eliminar SOLO el contenedor de la base de datos
docker compose rm -sf db
docker ps -a                 # labpresta-db-1 ya no existe
docker volume ls             # labpresta_pgdata sigue existiendo

# 3. Recrear el contenedor de la base de datos con el mismo volumen
docker compose up -d db

# 4. Recargar el navegador: el préstamo sigue ahí
```

Resultado obtenido al ejecutarla:

```
== 1. Registrar
{"id":1,"equipo":"Laptop Dell 01","responsable":"María Pérez","fecha_prestamo":"2026-11-25","devuelto":false,"fecha_devolucion":null}
== 2. Eliminar contenedor db
 Container labpresta-db-1  Removing
 Container labpresta-db-1  Removed
$ docker volume ls
local     labpresta_pgdata
== 3. Recrear db
 Container labpresta-db-1  Started
== 4. Verificar
[{"id":1,"equipo":"Laptop Dell 01","responsable":"María Pérez","fecha_prestamo":"2026-11-25","devuelto":false,"fecha_devolucion":null}]
```

No hace falta reiniciar `app`: SQLAlchemy usa `pool_pre_ping` y reconecta solo. Si la página mostrara
un error, basta con `docker compose restart app`.

Prueba contraria (opcional): `docker compose down -v` elimina también el volumen y, al volver a
levantar, la tabla aparece vacía. **Cuidado: esto borra los datos.**

## Elementos de Docker utilizados

| Elemento | Dónde | Para qué |
|---|---|---|
| **Imagen** | `app/Dockerfile` (base `python:3.12-slim`) y `postgres:16-alpine` | Plantilla inmutable de cada contenedor. El Dockerfile copia primero `requirements.txt` para aprovechar la caché de capas. |
| **Contenedor** | servicios `app` y `db` | Instancias en ejecución de las imágenes; uno por responsabilidad. |
| **Red** | red por defecto `labpresta_default` | Compose la crea sola; `app` encuentra a la base de datos por el nombre del servicio (`db`). |
| **Puerto publicado** | `app`: `${APP_PORT:-8000}:8000` | Expone la web al host. `db` **no** publica puertos: sólo es accesible desde `app`. |
| **Volumen** | `pgdata` → `/var/lib/postgresql/data` | Guarda los datos de PostgreSQL fuera del contenedor; sobreviven si el contenedor se elimina. |
| **Healthcheck** | `db`: `pg_isready` | `app` arranca sólo cuando la BD acepta conexiones (`depends_on: condition: service_healthy`). |
| **Variables de entorno** | `.env` (plantilla en `.env.example`) | Credenciales, puerto y zona horaria fuera del código. `.env` no se sube al repositorio. |

## Estructura

```
├── docker-compose.yml
├── .env.example
└── app/
    ├── Dockerfile
    ├── requirements.txt
    ├── main.py          # rutas de la API, arranque (reintento + creación de tablas) y estáticos
    ├── database.py      # conexión SQLAlchemy
    ├── models.py        # tabla prestamos
    ├── schemas.py       # validación Pydantic
    └── static/          # index.html + app.js
```
