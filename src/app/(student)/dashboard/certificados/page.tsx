import type { Metadata } from "next";
import { getPerfilActual } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { CertificadosContent, type CertificadoItem } from "@/components/dashboard/CertificadosContent";

export const metadata: Metadata = { title: "U.V.A. — Certificados" };

export default async function CertificadosPage() {
  const { user } = await getPerfilActual();
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("certificados")
    .select("id, fecha_emision, codigo_verificacion, nombre_curso")
    .eq("id_usuario", user!.id)
    .order("fecha_emision", { ascending: false });
  // Un fallo no es "no tienes certificados": sin esto el estudiante cree que
  // perdió su trabajo. Lanza para que lo atrape error.tsx (con Reintentar).
  lanzarSiFalla(error, "certificados:lista");

  // `nombre_curso` es el título congelado al momento de la emisión
  // (Deteccion.md) — no el título vigente de `cursos`, que puede haber
  // cambiado desde entonces.
  const certificados: CertificadoItem[] = (rows ?? []).map((fila) => ({
    id: fila.id,
    cursoTitulo: fila.nombre_curso,
    fechaEmision: fila.fecha_emision,
    codigoVerificacion: fila.codigo_verificacion,
  }));

  return <CertificadosContent certificados={certificados} />;
}
