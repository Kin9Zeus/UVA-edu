"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Carga un módulo solo cuando hay intención de usarlo: quien lo usa llama a
 * `pedir()` al pasar el puntero, enfocar o tocar (antes del clic, para que
 * casi siempre llegue a tiempo). Para las piezas del header que no hacen
 * falta para pintar — el autocompletado del buscador y los paneles del menú
 * y la lupa móviles —, cuyo JavaScript (base-ui y floating-ui) era lo que más
 * pesaba en el LCP de la portada en Lighthouse móvil (2026-10-20).
 *
 * No se precarga "cuando el navegador queda libre": se probó y la carga caía
 * dentro de la ventana que mide Lighthouse, con 331 ms de TBT y rendimiento
 * de 90 a 77.
 *
 * `cargar` debe guardar su promesa a nivel de módulo, para no pedir el chunk
 * otra vez en cada montaje, y olvidarla si falla, para poder reintentar.
 * Si falla, `modulo` se queda en `null`: quien lo usa conserva su versión
 * simple.
 */
export function useModuloDiferido<T>(cargar: () => Promise<T>) {
  const [modulo, setModulo] = useState<T | null>(null);
  const [pedido, setPedido] = useState(0);

  useEffect(() => {
    if (!pedido) return;
    let activo = true;
    cargar()
      .then((m) => {
        if (activo) setModulo(() => m);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [cargar, pedido]);

  // Cada pedido mientras no haya módulo reintenta (si el anterior falló);
  // con el módulo ya cargado no hace nada.
  const pedir = useCallback(() => {
    if (!modulo) setPedido((n) => n + 1);
  }, [modulo]);
  return { modulo, pedir };
}
