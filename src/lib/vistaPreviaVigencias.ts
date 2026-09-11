/**
 * Vigencias de los enlaces de vista previa. Nada más.
 *
 * Existe separado de `src/lib/vistaPrevia.ts` por una razón de empaquetado,
 * no de diseño: aquel módulo abre con `import { createHash, randomBytes,
 * timingSafeEqual } from "node:crypto"`, y `EnlacesVistaPrevia.tsx` —que es
 * "use client"— importaba de él estas dos constantes.
 *
 * Un `import` de valor desde un componente de cliente arrastra el módulo
 * ENTERO al paquete del navegador, y con él el polyfill de `crypto` de Node
 * que Next enchufa automáticamente (node_modules/next/dist/compiled/
 * crypto-browserify). Eso tenía dos consecuencias medidas en producción:
 *
 *  1. ~415 KB de criptografía muerta en el chunk de /admin/cursos/[cursoSlug].
 *  2. Una violación de CSP `script-src 'eval'` (UVA-EDU-1S), porque el
 *     polyfill arrastra a su vez `vm-browserify`, cuyo
 *     `Script.prototype.runInThisContext` es literalmente `eval(this.code)`.
 *
 * La (2) es la que importaba: era el ÚNICO obstáculo real para pasar la CSP
 * de `Report-Only` a forzada, porque `'unsafe-eval'` solo está permitido en
 * desarrollo (ver src/lib/csp.ts). El comentario de aquel archivo daba por
 * hecho que "en producción ni React ni Next lo usan" — cierto para React y
 * Next, pero no para lo que nosotros les hacíamos empaquetar.
 *
 * Regla práctica: lo que un componente de cliente necesite importar como
 * VALOR vive aquí; lo que toque `node:crypto` se queda en vistaPrevia.ts.
 * Un `import type` no cuenta — se borra al compilar y no arrastra nada.
 */

/**
 * Vigencias que se pueden elegir al generar un enlace, en minutos.
 *
 * El caso normal —y el que pide Revcurso— es que el administrador repase su
 * propio trabajo antes de publicar: eso dura minutos, no días, y siempre
 * puede generar otro enlace con un clic. Por eso el valor por defecto es el
 * más corto: cada minuto extra es ventana de exposición de contenido sin
 * publicar a cambio de nada.
 *
 * Las opciones largas existen para el otro caso, que es compartirlo con un
 * cliente o un instructor sin cuenta. Ahí la espera no la controla el
 * administrador, así que tiene sentido — pero es una decisión explícita, no
 * lo que sale por defecto.
 */
export const VIGENCIAS_VISTA_PREVIA = [
  { minutos: 15, etiqueta: "15 minutos" },
  { minutos: 60 * 24, etiqueta: "24 horas" },
  { minutos: 60 * 24 * 7, etiqueta: "7 días" },
] as const;

export const MINUTOS_VIGENCIA_VISTA_PREVIA = VIGENCIAS_VISTA_PREVIA[0].minutos;

/** Minutos aceptados por el Server Action; el valor llega del cliente. */
export const MINUTOS_VIGENCIA_VALIDOS: readonly number[] = VIGENCIAS_VISTA_PREVIA.map(
  (opcion) => opcion.minutos,
);
