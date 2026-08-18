import type { Metadata } from "next";
import { Proximamente } from "@/components/dashboard/Proximamente";

export const metadata: Metadata = { title: "U.V.A. — Certificados" };

export default function CertificadosPage() {
  return (
    <Proximamente
      titulo="Certificados"
      descripcion="El listado completo de tus certificados todavía no está disponible."
    />
  );
}
