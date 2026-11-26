const form = document.getElementById("form-prestamo");
const inputEquipo = document.getElementById("equipo");
const inputResponsable = document.getElementById("responsable");
const inputFecha = document.getElementById("fecha");
const inputBuscar = document.getElementById("buscar");
const tablaBody = document.getElementById("tabla-body");
const mensaje = document.getElementById("mensaje");

const CLASES_EXITO = ["bg-frosted-mint-50", "border-frosted-mint-300", "text-frosted-mint-800"];
const CLASES_ERROR = ["bg-red-50", "border-red-200", "text-red-700"];
let temporizadorMensaje = null;
let temporizadorBusqueda = null;

function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function formatearFecha(iso) {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

function mostrarMensaje(texto, tipo) {
  clearTimeout(temporizadorMensaje);
  mensaje.classList.remove("hidden", ...CLASES_EXITO, ...CLASES_ERROR);
  mensaje.classList.add(...(tipo === "exito" ? CLASES_EXITO : CLASES_ERROR));
  mensaje.textContent = texto;
  temporizadorMensaje = setTimeout(ocultarMensaje, 4000);
}

function ocultarMensaje() {
  mensaje.classList.add("hidden");
  mensaje.textContent = "";
}

async function extraerError(respuesta) {
  try {
    const datos = await respuesta.json();
    if (typeof datos.detail === "string") return datos.detail;
    if (Array.isArray(datos.detail)) {
      return datos.detail
        .map((e) => `${e.loc[e.loc.length - 1]}: ${e.msg}`)
        .join(". ");
    }
  } catch (_) {
    /* respuesta sin JSON */
  }
  return `Error ${respuesta.status}`;
}

async function cargarResumen() {
  try {
    const r = await fetch("/api/resumen");
    if (!r.ok) return;
    const datos = await r.json();
    document.getElementById("total").textContent = datos.total;
    document.getElementById("activos").textContent = datos.activos;
    document.getElementById("devueltos").textContent = datos.devueltos;
  } catch (_) {
    /* se reintentará en la siguiente acción */
  }
}

function crearCelda(texto, clases = "") {
  const td = document.createElement("td");
  td.className = `px-4 py-3 ${clases}`;
  td.textContent = texto;
  return td;
}

function crearFila(p) {
  const tr = document.createElement("tr");
  tr.className = "hover:bg-sky-reflection-50";

  tr.appendChild(crearCelda(p.equipo, "font-medium"));
  tr.appendChild(crearCelda(p.responsable));
  tr.appendChild(crearCelda(formatearFecha(p.fecha_prestamo), "whitespace-nowrap"));

  const tdEstado = document.createElement("td");
  tdEstado.className = "px-4 py-3";
  const insignia = document.createElement("span");
  insignia.className = "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " +
    (p.devuelto ? "bg-light-green-100 text-light-green-800" : "bg-sky-reflection-100 text-sky-reflection-800");
  insignia.textContent = p.devuelto ? "Devuelto" : "Activo";
  tdEstado.appendChild(insignia);
  tr.appendChild(tdEstado);

  const tdAccion = document.createElement("td");
  tdAccion.className = "px-4 py-3 whitespace-nowrap";
  if (p.devuelto) {
    tdAccion.textContent = p.fecha_devolucion ? `el ${formatearFecha(p.fecha_devolucion)}` : "";
    tdAccion.classList.add("text-charcoal-blue-500");
  } else {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors bg-frosted-mint-500 hover:bg-frosted-mint-600 text-white focus:outline-none focus:ring-2 focus:ring-sky-reflection-400";
    boton.textContent = "Marcar devuelto";
    boton.addEventListener("click", () => marcarDevuelto(p.id, boton));
    tdAccion.appendChild(boton);
  }
  tr.appendChild(tdAccion);

  return tr;
}

function filaVacia(texto) {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 5;
  td.className = "px-4 py-8 text-center text-charcoal-blue-500";
  td.textContent = texto;
  tr.appendChild(td);
  return tr;
}

async function cargarPrestamos() {
  const q = inputBuscar.value.trim();
  const url = q ? `/api/prestamos?q=${encodeURIComponent(q)}` : "/api/prestamos";
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(await extraerError(r));
    const prestamos = await r.json();
    tablaBody.replaceChildren();
    if (prestamos.length === 0) {
      tablaBody.appendChild(filaVacia(q ? "No hay préstamos que coincidan con la búsqueda" : "No hay préstamos registrados"));
      return;
    }
    prestamos.forEach((p) => tablaBody.appendChild(crearFila(p)));
  } catch (e) {
    tablaBody.replaceChildren(filaVacia("No se pudieron cargar los préstamos"));
  }
}

async function marcarDevuelto(id, boton) {
  boton.disabled = true;
  try {
    const r = await fetch(`/api/prestamos/${id}/devolver`, { method: "PATCH" });
    if (!r.ok) throw new Error(await extraerError(r));
    mostrarMensaje("Préstamo marcado como devuelto", "exito");
  } catch (e) {
    mostrarMensaje(e.message, "error");
  }
  await Promise.all([cargarPrestamos(), cargarResumen()]);
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  ocultarMensaje();

  const datos = {
    equipo: inputEquipo.value.trim(),
    responsable: inputResponsable.value.trim(),
    fecha_prestamo: inputFecha.value || hoyISO(),
  };

  if (!datos.equipo || !datos.responsable) {
    mostrarMensaje("Equipo y responsable son obligatorios", "error");
    return;
  }

  try {
    const r = await fetch("/api/prestamos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    if (!r.ok) throw new Error(await extraerError(r));
    form.reset();
    inputFecha.value = hoyISO();
    mostrarMensaje("Préstamo registrado correctamente", "exito");
    await Promise.all([cargarPrestamos(), cargarResumen()]);
  } catch (e) {
    mostrarMensaje(e.message, "error");
  }
});

inputBuscar.addEventListener("input", () => {
  clearTimeout(temporizadorBusqueda);
  temporizadorBusqueda = setTimeout(cargarPrestamos, 300);
});

inputFecha.value = hoyISO();
cargarPrestamos();
cargarResumen();
