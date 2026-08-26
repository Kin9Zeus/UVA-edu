const UNIDADES: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

export function tiempoRelativo(fechaIso: string) {
  const segundos = (new Date(fechaIso).getTime() - Date.now()) / 1000;

  for (const [unidad, segundosPorUnidad] of UNIDADES) {
    if (Math.abs(segundos) >= segundosPorUnidad) {
      return rtf.format(Math.round(segundos / segundosPorUnidad), unidad);
    }
  }
  return rtf.format(Math.round(segundos), "second");
}

export function formatFecha(fechaIso: string) {
  return new Date(fechaIso).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatMoneda(centavos: number, moneda: string) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(centavos / 100);
}

/**
 * Duración de una lección en el formato del mockup del panel admin: `08:12`.
 * El esquema la guarda en segundos (`lecciones.duracion`, nullable).
 */
export function formatDuracion(segundos: number | null) {
  if (segundos === null || segundos <= 0) return "—";
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

/** Duración total de un curso, p.ej. `3 h 20 m` o `45 min`. */
export function formatHoras(segundos: number) {
  if (segundos <= 0) return "—";
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.round((segundos % 3600) / 60);
  if (horas === 0) return `${minutos} min`;
  if (minutos === 0) return `${horas} h`;
  return `${horas} h ${minutos} m`;
}

/** Tamaño de un recurso descargable, p.ej. `1.4 MB`. */
export function formatTamanoArchivo(bytes: number | null) {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Etiqueta corta de un recurso descargable, p.ej. `PDF`, a partir de su
 * nombre de archivo — nunca de `recursos_descargables.tipo_archivo`, que
 * guarda el MIME type completo que declaró el navegador al subirlo
 * (`subirRecursoLeccion`, `src/actions/admin/cursos.ts`). Mostrar ese MIME
 * tal cual ("APPLICATION/PDF", "TEXT/PLAIN") se leía como una ruta por la
 * barra — el usuario lo reportó viendo el reproductor. La extensión del
 * nombre es lo que el mockup y el seed ya mostraban ("PDF", "RTE").
 */
export function extensionArchivo(nombre: string): string {
  const punto = nombre.lastIndexOf(".");
  if (punto <= 0 || punto === nombre.length - 1) return "ARCHIVO";
  return nombre.slice(punto + 1).toUpperCase();
}
