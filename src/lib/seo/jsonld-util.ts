/**
 * Utilidades comunes a todos los generadores de JSON-LD de `src/lib/seo`.
 *
 * Por qué existe `sinVacios`
 * --------------------------
 * Un campo vacío en datos estructurados no es "un campo sin valor": es un
 * dato inválido. `"description": ""`, `"jobTitle": null` o `"sameAs": []`
 * hacen que el validador avise y que el lector (Google, Bing, un asistente de
 * IA) reciba una afirmación vacía. Cada generador ya evita los suyos con
 * condicionales, pero eso depende de que nadie olvide uno al agregar un campo.
 *
 * Esta función es la red de seguridad: todo generador devuelve su objeto
 * pasado por aquí, y la regla "no se emiten campos vacíos" se prueba una sola
 * vez para todos. `0` y `false` se conservan: son valores, no ausencias.
 */

type ValorJsonLd = unknown;

function esVacio(valor: ValorJsonLd): boolean {
  if (valor === undefined || valor === null) return true;
  if (typeof valor === "string") return valor.trim() === "";
  if (Array.isArray(valor)) return valor.length === 0;
  if (typeof valor === "object") return Object.keys(valor).length === 0;
  return false;
}

function limpiar(valor: ValorJsonLd): ValorJsonLd {
  if (Array.isArray(valor)) {
    return valor.map(limpiar).filter((v) => !esVacio(v));
  }

  if (valor !== null && typeof valor === "object") {
    const resultado: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor)) {
      const limpio = limpiar(v);
      if (!esVacio(limpio)) resultado[clave] = limpio;
    }
    return resultado;
  }

  return valor;
}

/**
 * Copia profunda sin `undefined`, `null`, cadenas en blanco ni arreglos u
 * objetos vacíos (también los que quedan vacíos tras limpiar a sus hijos).
 */
export function sinVacios<T extends Record<string, unknown>>(objeto: T): Record<string, unknown> {
  return limpiar(objeto) as Record<string, unknown>;
}

/**
 * Lista de comprobación para las pruebas: rutas de los campos vacíos que
 * queden en un objeto. Vacía significa que el objeto está limpio.
 */
export function camposVacios(valor: ValorJsonLd, ruta = "$"): string[] {
  if (esVacio(valor)) return [ruta];
  if (Array.isArray(valor)) return valor.flatMap((v, i) => camposVacios(v, `${ruta}[${i}]`));
  if (typeof valor === "object" && valor !== null) {
    return Object.entries(valor).flatMap(([clave, v]) => camposVacios(v, `${ruta}.${clave}`));
  }
  return [];
}
