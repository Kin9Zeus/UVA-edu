import type { Metadata } from "next";
import { getPerfilActual } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { CertificadosContent, type CertificadoItem } from "@/components/dashboard/CertificadosContent";

export const metadata: Metadata = { title: "U.V.A. — Certificados" };

export default async function CertificadosPage() {
  const { user } = await getPerfilActual();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("certificados")
    .select("id, fecha_emision, codigo_verificacion, curso:cursos(titulo)")
    .eq("id_usuario", user!.id)
    .order("fecha_emision", { ascending: false });

  const certificados: CertificadoItem[] = (rows ?? []).map((fila) => {
    const curso = Array.isArray(fila.curso) ? fila.curso[0] : fila.curso;
    return {
      id: fila.id,
      cursoTitulo: curso?.titulo ?? "Curso",
      fechaEmision: fila.fecha_emision,
      codigoVerificacion: fila.codigo_verificacion,
    };
  });

  return <CertificadosContent certificados={certificados} />;
}
