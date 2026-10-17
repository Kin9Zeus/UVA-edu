import type { Metadata } from "next";
import { getPerfilActual } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { registrarSiFalla } from "@/lib/supabase/registrar";
import { siteUrl } from "@/lib/site-url";
import { duracionCertificadoTexto } from "@/lib/certificados/duracion";
import { CertificadosContent, type CertificadoItem } from "@/components/dashboard/CertificadosContent";

export const metadata: Metadata = { title: "U.V.A. — Certificados" };

export default async function CertificadosPage() {
  const { user } = await getPerfilActual();
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("certificados")
    .select("id, id_curso, fecha_emision, codigo_verificacion, nombre_curso, nombre_estudiante")
    .eq("id_usuario", user!.id)
    .order("fecha_emision", { ascending: false });
  // Un fallo no es "no tienes certificados": sin esto el estudiante cree que
  // perdió su trabajo. Lanza para que lo atrape error.tsx (con Reintentar).
  lanzarSiFalla(error, "certificados:lista");

  // Horas de cada curso con la misma regla que imprime el PDF (clases con
  // video listo). Es un dato secundario: si falla, las filas salen sin la
  // línea de horas y se registra, nunca con un "0 horas" falso.
  const idsCurso = [...new Set((rows ?? []).map((fila) => fila.id_curso as string))];
  const segundosPorCurso = new Map<string, number>();
  if (idsCurso.length > 0) {
    const { data: lecciones, error: errorLecciones } = await supabase
      .from("lecciones")
      .select("duracion, modulo:modulos!inner(id_curso)")
      .in("modulo.id_curso", idsCurso)
      .eq("estado_procesamiento", "LISTO");
    if (!registrarSiFalla(errorLecciones, "certificados:duracion", "no se pudo leer la duración de los cursos")) {
      for (const leccion of lecciones ?? []) {
        const modulo = Array.isArray(leccion.modulo) ? leccion.modulo[0] : leccion.modulo;
        if (!modulo) continue;
        const id = modulo.id_curso as string;
        segundosPorCurso.set(id, (segundosPorCurso.get(id) ?? 0) + ((leccion.duracion as number | null) ?? 0));
      }
    }
  }

  const origen = siteUrl();
  // `nombre_curso` y `nombre_estudiante` son los datos congelados al emitir
  // (Deteccion.md) — los mismos que imprime el PDF, no los vigentes.
  const certificados: CertificadoItem[] = (rows ?? []).map((fila) => {
    const segundos = segundosPorCurso.get(fila.id_curso as string) ?? 0;
    return {
      id: fila.id,
      cursoTitulo: fila.nombre_curso,
      nombreEstudiante: fila.nombre_estudiante,
      fechaEmision: fila.fecha_emision,
      codigoVerificacion: fila.codigo_verificacion,
      duracionTexto: duracionCertificadoTexto(segundos),
      horas: Math.round(segundos / 3600),
      urlVerificacion: `${origen}/verificar-certificado/${fila.codigo_verificacion}`,
    };
  });

  return <CertificadosContent certificados={certificados} />;
}
