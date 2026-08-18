import type { Metadata } from "next";
import { Proximamente } from "@/components/dashboard/Proximamente";

export const metadata: Metadata = { title: "U.V.A. — Suscripción" };

export default function SuscripcionPage() {
  return (
    <Proximamente
      titulo="Suscripción"
      descripcion="La gestión de tu suscripción todavía no está disponible."
    />
  );
}
