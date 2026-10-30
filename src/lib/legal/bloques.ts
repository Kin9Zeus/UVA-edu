import { z } from "zod";

/**
 * Formato del contenido de un texto legal (`textos_legales.contenido`): una
 * lista de bloques, no HTML ni Markdown.
 *
 * Por qué bloques y no HTML/Markdown
 * ----------------------------------
 * Un texto legal lo escribe un humano y lo publica otro, y una vez publicado
 * no se toca. HTML en la base obligaría a inyectarlo con
 * `dangerouslySetInnerHTML` (y con la CSP de `strict-dynamic` cualquier
 * descuido es un XSS persistente en la página más visitada del sitio);
 * Markdown pediría una librería nueva y dejaría sin resolver cómo se ve una
 * tabla en un celular de 320 px. Con bloques tipados el componente
 * (components/legal/TextoLegal.tsx) decide cómo se dibuja cada cosa y lo que
 * no está en esta lista simplemente no existe: un enlace `javascript:` o una
 * etiqueta `<script>` no tienen dónde entrar.
 *
 * La base solo exige que `contenido` sea una lista (CHECK en
 * supabase/sql/130); la forma de cada bloque se valida aquí, al leer y antes
 * de publicar. Los límites de tamaño no son decoración: zod 4.4 se quedaba sin
 * memoria al validar colecciones enormes (GHSA-mrhx-c7xc-m3w5), y esto se
 * valida con datos que vienen de la base.
 */

const MAX_BLOQUES = 1_000;
const MAX_ITEMS = 200;
const MAX_FILAS = 100;
const MAX_COLUMNAS = 6;
const MAX_TEXTO = 20_000;

// Solo https, rutas del propio sitio (una sola barra: `//otro-dominio` es un
// enlace externo disfrazado, ver lib/redirect-seguro.ts) y correo.
const ENLACE_PERMITIDO = /^(https:\/\/[^\s]+|\/(?!\/)[^\s]*|mailto:[^\s]+)$/;

const segmento = z.object({
  texto: z.string().min(1).max(MAX_TEXTO),
  negrita: z.boolean().optional(),
  cursiva: z.boolean().optional(),
  enlace: z
    .string()
    .max(2_000)
    .regex(ENLACE_PERMITIDO, "Solo se permiten enlaces https, del propio sitio o mailto.")
    .optional(),
});

/** Un texto en línea: una cadena simple o una lista de tramos con formato. */
const enLinea = z.union([
  z.string().min(1).max(MAX_TEXTO),
  z.array(segmento).min(1).max(MAX_ITEMS),
]);

const titulo = z.object({
  tipo: z.literal("titulo"),
  nivel: z.union([z.literal(2), z.literal(3)]),
  texto: z.string().min(1).max(300),
});

const parrafo = z.object({
  tipo: z.literal("parrafo"),
  contenido: enLinea,
});

const lista = z.object({
  tipo: z.literal("lista"),
  ordenada: z.boolean(),
  items: z.array(enLinea).min(1).max(MAX_ITEMS),
});

const tabla = z
  .object({
    tipo: z.literal("tabla"),
    columnas: z.array(z.string().min(1).max(200)).min(2).max(MAX_COLUMNAS),
    filas: z.array(z.array(enLinea).min(2).max(MAX_COLUMNAS)).min(1).max(MAX_FILAS),
  })
  .superRefine((valor, ctx) => {
    valor.filas.forEach((fila, indice) => {
      if (fila.length !== valor.columnas.length) {
        ctx.addIssue({
          code: "custom",
          message: `La fila ${indice + 1} tiene ${fila.length} celdas y la tabla ${valor.columnas.length} columnas.`,
          path: ["filas", indice],
        });
      }
    });
  });

/** Un recuadro aparte (advertencia o decisión): se distingue del párrafo. */
const nota = z.object({
  tipo: z.literal("nota"),
  contenido: enLinea,
});

const bloque = z.discriminatedUnion("tipo", [titulo, parrafo, lista, tabla, nota]);

export const esquemaBloques = z.array(bloque).min(1).max(MAX_BLOQUES);

export type Segmento = z.infer<typeof segmento>;
export type EnLinea = z.infer<typeof enLinea>;
export type Bloque = z.infer<typeof bloque>;

/**
 * Valida el `contenido` leído de la base. Lanza si no cumple: un texto legal
 * corrupto no se muestra a medias ni se reemplaza por una página vacía, falla
 * a la vista (error.tsx + Sentry), igual que el resto de las lecturas.
 */
export function parsearBloques(valor: unknown): Bloque[] {
  const resultado = esquemaBloques.safeParse(valor);
  if (!resultado.success) {
    const primero = resultado.error.issues[0];
    throw new Error(
      `El contenido del texto legal no es válido: ${primero?.message ?? "formato desconocido"} (en ${primero?.path.join(".") || "la raíz"})`,
    );
  }
  return resultado.data;
}

/** Un texto en línea siempre como lista de tramos, para dibujarlo de una forma. */
export function aSegmentos(contenido: EnLinea): Segmento[] {
  return typeof contenido === "string" ? [{ texto: contenido }] : contenido;
}

export function textoPlano(contenido: EnLinea): string {
  return aSegmentos(contenido)
    .map((s) => s.texto)
    .join("");
}

/**
 * Identificador de ancla de un título: minúsculas, sin tildes y con guiones
 * ("1. Quiénes somos y aceptación" -> "1-quienes-somos-y-aceptacion").
 */
export function anclaDeTitulo(texto: string): string {
  const ancla = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ancla || "seccion";
}

export type EntradaIndice = { id: string; texto: string; nivel: 2 | 3 };

/**
 * Los títulos del texto con su ancla, en orden. Dos títulos iguales no pueden
 * compartir `id` (el segundo salta al primero y el índice miente): el
 * repetido lleva un sufijo numérico. El componente y el índice usan ESTA
 * función, así que sus anclas coinciden siempre.
 */
export function indiceDeBloques(bloques: Bloque[]): EntradaIndice[] {
  const usados = new Map<string, number>();
  const entradas: EntradaIndice[] = [];
  for (const b of bloques) {
    if (b.tipo !== "titulo") continue;
    const base = anclaDeTitulo(b.texto);
    const veces = usados.get(base) ?? 0;
    usados.set(base, veces + 1);
    entradas.push({ id: veces === 0 ? base : `${base}-${veces + 1}`, texto: b.texto, nivel: b.nivel });
  }
  return entradas;
}

/** Todo el texto visible de los bloques, para revisarlo de una pasada. */
function textosDeBloques(bloques: Bloque[]): string[] {
  const salida: string[] = [];
  for (const b of bloques) {
    switch (b.tipo) {
      case "titulo":
        salida.push(b.texto);
        break;
      case "parrafo":
      case "nota":
        salida.push(textoPlano(b.contenido));
        break;
      case "lista":
        for (const item of b.items) salida.push(textoPlano(item));
        break;
      case "tabla":
        salida.push(...b.columnas);
        for (const fila of b.filas) for (const celda of fila) salida.push(textoPlano(celda));
        break;
    }
  }
  return salida;
}

/**
 * Marcadores sin resolver: todo lo que esté entre corchetes ("[RAZÓN
 * SOCIAL]", "[NIT]", "[30]"). El documento de origen dice que lo que va entre
 * corchetes es un dato que solo UVA puede completar y que "debe
 * reemplazarse". El script de publicación se niega a publicar mientras quede
 * alguno: así un texto con "[NIT]" no llega nunca a un visitante.
 */
export function corchetesSinResolver(bloques: Bloque[], titulo = ""): string[] {
  const encontrados = new Set<string>();
  for (const texto of [titulo, ...textosDeBloques(bloques)]) {
    for (const coincidencia of texto.matchAll(/\[[^\]\n]*\]/g)) {
      encontrados.add(coincidencia[0]);
    }
  }
  return [...encontrados];
}
