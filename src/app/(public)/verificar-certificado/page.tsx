import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerificacionCertificado } from "@/components/certificados/VerificacionCertificado";
import { normalizarCodigoCertificado } from "@/lib/certificados/codigo";

/** Sin datos de nadie, pero `robots.ts` bloquea todo el prefijo: se mantiene coherente. */
export const metadata: Metadata = {
  title: "U.V.A. — Verificar certificado",
  description: "Escribe el código de un certificado U.V.A. para comprobar que es auténtico.",
  robots: { index: false, follow: false },
};

/**
 * "Verificar otro código": el formulario sin código. También recibe el GET
 * del formulario cuando no hay JavaScript (?codigo=…) y lo manda a la ruta
 * del código.
 */
export default async function BuscarCertificadoPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string | string[] }>;
}) {
  const { codigo } = await searchParams;
  const limpio = normalizarCodigoCertificado(typeof codigo === "string" ? codigo : "");
  if (limpio) redirect(`/verificar-certificado/${encodeURIComponent(limpio)}`);

  return <VerificacionCertificado resultado={{ estado: "buscar" }} />;
}
