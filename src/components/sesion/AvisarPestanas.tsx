"use client";

import { useEffect } from "react";
import { avisarPestanas, type AvisoPestanas } from "@/lib/sesion/pestanas";

/**
 * Envía un aviso a las otras pestañas al cargar la página. Para pantallas de
 * servidor que cierran un paso que otra pestaña está esperando (por ejemplo,
 * "¡Correo confirmado!"). No dibuja nada.
 */
export function AvisarPestanas({ aviso }: { aviso: AvisoPestanas }) {
  const clave = JSON.stringify(aviso);
  useEffect(() => {
    avisarPestanas(JSON.parse(clave) as AvisoPestanas);
  }, [clave]);
  return null;
}
