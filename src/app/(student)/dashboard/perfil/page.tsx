import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/perfil";
import { getSuscripcionActual } from "@/lib/suscripcion";
import { PerfilForm } from "@/components/dashboard/PerfilForm";

export const metadata: Metadata = {
  title: "U.V.A. — Mi perfil",
};

export default async function PerfilPage() {
  const { user, perfil } = await getPerfilActual();
  const supabase = await createClient();

  const [{ data: certificadosRows }, suscripcion] = await Promise.all([
    supabase
      .from("certificados")
      .select("id, fecha_emision, cursos(titulo)")
      .eq("id_usuario", user!.id)
      .order("fecha_emision", { ascending: false })
      .limit(2),
    getSuscripcionActual(user!.id),
  ]);

  const certificados = (certificadosRows ?? []).map((fila) => {
    const curso = Array.isArray(fila.cursos) ? fila.cursos[0] : fila.cursos;
    return {
      id: fila.id as string,
      titulo: (curso as { titulo?: string } | null)?.titulo ?? "Curso",
      fecha: new Date(fila.fecha_emision as string).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
    };
  });

  const planNombre =
    suscripcion && (suscripcion.estado === "ACTIVA" || suscripcion.estado === "PAST_DUE")
      ? suscripcion.planNombre
      : null;

  return (
    <div className="px-[clamp(20px,3vw,44px)] py-8">
      <PerfilForm
        nombre={perfil?.nombre ?? "Estudiante"}
        correo={perfil?.correo ?? user!.email ?? ""}
        planNombre={planNombre}
        certificados={certificados}
      />
    </div>
  );
}
