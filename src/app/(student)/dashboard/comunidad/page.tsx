import type { Metadata } from "next";
import { Proximamente } from "@/components/dashboard/Proximamente";

export const metadata: Metadata = { title: "U.V.A. — Comunidad" };

export default function ComunidadPage() {
  return (
    <Proximamente
      titulo="Comunidad"
      descripcion="El espacio de preguntas y respuestas del gremio todavía no está disponible."
    />
  );
}
