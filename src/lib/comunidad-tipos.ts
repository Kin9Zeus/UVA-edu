/**
 * Tipos y constantes de Comunidad, separados de `src/lib/comunidad.ts` a
 * propósito: ese archivo importa `createClient` de `@/lib/supabase/server`
 * (que depende de `next/headers`, server-only). Los componentes cliente de
 * `src/components/dashboard/comunidad/*` necesitan `CATEGORIA_LABEL` y los
 * tipos de acá, y un import de valor desde un archivo que también tiene
 * código server-only arrastra ESE archivo completo al bundle del cliente
 * (Next.js no lo tree-shakea) — mismo motivo por el que `src/lib/editor/`
 * separa `tipos.ts` de la lógica de servidor.
 */

/**
 * Arma el `FormData` que esperan crearPostComunidad/responderPostComunidad/
 * editarPostComunidad a partir del mapa que devuelve
 * `EditorTextoEnriquecidoHandle.obtenerAdjuntosPendientes()` — dos campos
 * repetidos ("token"/"archivo") en el mismo orden. Un `File` pasado como
 * argumento normal de Server Action, aunque sea uno solo, no siempre
 * sobrevive si viene anidado dentro de un objeto/array (se comprobó en
 * vivo); `FormData` en el nivel superior es el único camino probado en el
 * proyecto para subir archivos (ver el comentario de
 * `extraerAdjuntosPendientes` en comunidad-adjuntos.ts).
 */
export function armarFormDataAdjuntos(pendientes: Map<string, File>): FormData {
  const formData = new FormData();
  for (const [token, archivo] of pendientes) {
    formData.append("token", token);
    formData.append("archivo", archivo);
  }
  return formData;
}

export const CATEGORIAS_COMUNIDAD = ["ANUNCIOS", "PROYECTOS", "PREGUNTAS", "EMPLEO"] as const;
export type CategoriaComunidad = (typeof CATEGORIAS_COMUNIDAD)[number];

export const CATEGORIA_LABEL: Record<CategoriaComunidad, string> = {
  ANUNCIOS: "Anuncios",
  PROYECTOS: "Muestra tu proyecto",
  PREGUNTAS: "Preguntas generales",
  EMPLEO: "Empleo",
};

/** Clases del badge de categoría, una por categoría, para que se distingan
 * de un vistazo en el feed — reusa los 4 tokens `--uva-badge-*` que ya
 * existen en globals.css exactamente para esto (no son colores nuevos). */
export const CATEGORIA_ESTILO: Record<CategoriaComunidad, string> = {
  ANUNCIOS: "bg-uva-badge-danger-bg text-uva-badge-danger-fg",
  EMPLEO: "bg-uva-badge-success-bg text-uva-badge-success-fg",
  PROYECTOS: "bg-uva-badge-warn-bg text-uva-badge-warn-fg",
  PREGUNTAS: "bg-uva-badge-neutral-bg text-uva-badge-neutral-fg",
};

/** Viven acá (no en comunidad-adjuntos.ts, que importa `sharp`/`file-type`,
 * paquetes de Node) para que el composer — un componente cliente — pueda
 * validar el tamaño/cantidad antes de subir sin arrastrar esas librerías al
 * bundle del navegador. `procesarAdjuntoComunidad` importa el mismo valor. */
export const TAMANO_MAXIMO_ADJUNTO_COMUNIDAD = 10 * 1024 * 1024;
/** Tope práctico por publicación/respuesta — no hay límite a nivel de base
 * (ver 086_comunidad_adjuntos.sql), esto es solo para no dejar que un post
 * se convierta en un álbum de 40 fotos. */
export const MAX_ADJUNTOS_COMUNIDAD = 6;

export type MotivoBloqueoComunidad = "SIN_SUSCRIPCION" | "VENCIDA" | "CANCELADA";

/** Un adjunto de post/respuesta — uno por cada marcador `[[adjunto:<id>]]`
 * dentro de `contenido` (src/lib/formato-texto.tsx), en el punto exacto
 * donde el autor lo insertó al escribir. `id` es el que aparece en ese
 * marcador, así el renderer puede resolver cada uno contra su lugar real en
 * el texto. `imagen` ya trae la URL firmada (resuelta en el servidor al
 * armar el feed/detalle, ver enriquecer() en comunidad.ts) y sus
 * dimensiones reales, para que el feed reserve el espacio antes de que la
 * imagen cargue. `archivo` no trae URL: se firma bajo demanda al hacer clic
 * en "Descargar" (obtenerUrlAdjuntoComunidad), para no firmar de más
 * documentos que nadie va a descargar. Ambas variantes llevan `nombre`: la
 * de imagen lo necesita para poblar el editor al editar una publicación
 * (el chip dentro del texto necesita una etiqueta legible). */
export type ComunidadAdjunto =
  | { tipo: "imagen"; id: string; nombre: string; url: string; ancho: number; alto: number }
  | { tipo: "archivo"; id: string; nombre: string; tamanoBytes: number; extension: string };

export type AccesoComunidad =
  | { acceso: true; usuarioId: string; esAdmin: boolean }
  | { acceso: false; motivo: MotivoBloqueoComunidad };

export type ComunidadPostResumen = {
  id: string;
  /** URL del hilo (/dashboard/comunidad/<slug>); fijo aunque se edite el título. */
  slug: string;
  categoria: CategoriaComunidad;
  titulo: string;
  contenido: string;
  fijado: boolean;
  eliminado: boolean;
  tiempo: string;
  autorId: string;
  autorNombre: string;
  totalRespuestas: number;
  totalReacciones: number;
  meReaccione: boolean;
  adjuntos: ComunidadAdjunto[];
};

export type ComunidadRespuesta = {
  id: string;
  contenido: string;
  eliminado: boolean;
  tiempo: string;
  autorId: string;
  autorNombre: string;
  totalReacciones: number;
  meReaccione: boolean;
  adjuntos: ComunidadAdjunto[];
};

export type ComunidadPostDetalle = ComunidadPostResumen & {
  respuestas: ComunidadRespuesta[];
};

/** Una entrada del riel "Publicaciones recientes" — solo publicaciones
 * nuevas (no respuestas: cualquier respuesta, hasta un "gracias" de una
 * palabra, calificaba como "actividad" y volvía la lista ruidosa). */
export type ComunidadActividadItem = {
  id: string;
  slug: string;
  titulo: string;
  autorNombre: string;
  tiempo: string;
};

/** Una entrada del riel "Más respondidas esta semana". */
export type ComunidadDestacadoItem = {
  id: string;
  slug: string;
  titulo: string;
  totalRespuestas: number;
};
