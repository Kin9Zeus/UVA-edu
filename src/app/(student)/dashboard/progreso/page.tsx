import type { Metadata } from "next";
import { Proximamente } from "@/components/dashboard/Proximamente";

export const metadata: Metadata = { title: "U.V.A. — Progreso" };

export default function ProgresoPage() {
  return (
    <Proximamente
      titulo="Progreso"
      descripcion="El resumen detallado de tu progreso todavía no está disponible."
    />
  );
}
