"use client";

import { useState, type ReactNode } from "react";

/**
 * Miniatura firmada de Mux (image.mux.com) con respaldo si no carga.
 *
 * Si el asset ya no existe en Mux, la miniatura responde 404 y el navegador
 * pintaba una imagen rota en la tarjeta (P2-7, AUDIT-2026-09-22.md: visto en
 * /dashboard/progreso). Con `onError` se muestra `respaldo` (la portada del
 * curso, por ejemplo) o nada, y queda a la vista el fondo del contenedor.
 */
export function MiniaturaMux({
  src,
  className,
  loading,
  respaldo = null,
}: {
  src: string;
  className?: string;
  loading?: "lazy" | "eager";
  respaldo?: ReactNode;
}) {
  const [fallo, setFallo] = useState(false);
  if (fallo) return <>{respaldo}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Mux, de vida corta
    <img src={src} alt="" loading={loading} className={className} onError={() => setFallo(true)} />
  );
}
