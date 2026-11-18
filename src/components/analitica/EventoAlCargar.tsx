"use client";

import { useEffect } from "react";
import { registrarEvento, type EventoAnalitica } from "@/lib/analitica";

/**
 * Registra un evento al mostrar una página que se pinta en el servidor (p. ej.,
 * el resultado de verificar un certificado). Sin GA cargado no hace nada.
 */
export function EventoAlCargar({ nombre, parametros }: { nombre: EventoAnalitica; parametros?: Record<string, string> }) {
  const clave = JSON.stringify(parametros ?? {});
  useEffect(() => {
    registrarEvento(nombre, JSON.parse(clave) as Record<string, string>);
  }, [nombre, clave]);
  return null;
}
