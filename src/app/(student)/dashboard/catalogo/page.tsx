import type { Metadata } from "next";
import { Proximamente } from "@/components/dashboard/Proximamente";

export const metadata: Metadata = { title: "U.V.A. — Catálogo" };

export default function CatalogoPage() {
  return (
    <Proximamente
      titulo="Catálogo"
      descripcion="El catálogo de cursos y rutas todavía no está disponible."
    />
  );
}
