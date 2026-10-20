"use client";

import { useState } from "react";
import { AvisoErrorCarga } from "@/components/errores/AvisoErrorCarga";

/** Cliente: la página del catálogo es de servidor y no puede pasar funciones. */
export function DemoErrorCarga() {
  const [intentos, setIntentos] = useState(0);
  return (
    <AvisoErrorCarga
      texto={`No pudimos cargar tus notas. Tus notas siguen guardadas.${intentos ? ` (reintentos: ${intentos})` : ""}`}
      onReintentar={() => setIntentos((n) => n + 1)}
    />
  );
}
