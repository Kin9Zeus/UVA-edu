import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/perfil";
import { getSuscripcionActual } from "@/lib/suscripcion";
import { calcularEstadoAcceso } from "@/lib/estadoAcceso";
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
      .select("id, fecha_emision, nombre_curso")
      .eq("id_usuario", user!.id)
      .order("fecha_emision", { ascending: false })
      .limit(2),
    getSuscripcionActual(user!.id),
  ]);

  // `nombre_curso` es el título congelado al momento de la emisión
  // (Deteccion.md), no el título vigente de `cursos`.
  const certificados = (certificadosRows ?? []).map((fila) => ({
    id: fila.id as string,
    titulo: fila.nombre_curso as string,
    fecha: new Date(fila.fecha_emision as string).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      timeZone: "America/Bogota",
    }),
  }));

  // Tipo de acceso, fecha de vigencia y aviso, resueltos de una sola vez:
  // devuelve null para las suscripciones de pago, que tienen su propia
  // pantalla con historial en /dashboard/suscripcion.
  const estadoAcceso = calcularEstadoAcceso(suscripcion);

  const suscripcionVigente =
    suscripcion && (suscripcion.estado === "ACTIVA" || suscripcion.estado === "PAST_DUE");

  // El acceso gratuito manda sobre el nombre del plan en la insignia de la
  // cabecera: a quien recibió una invitación no se le anuncia "Anual" —
  // nunca compró un plan, aunque `otorgarMembresia` guarde uno para calcular
  // la duración.
  const insignia = estadoAcceso
    ? {
        texto: estadoAcceso.vigencia === "VENCIDO" ? "Acceso finalizado" : "Acceso gratuito",
        atenuada: estadoAcceso.vigencia === "VENCIDO",
      }
    : suscripcionVigente
      ? { texto: suscripcion.planNombre, atenuada: false }
      : null;

  return (
    <div className="px-[clamp(20px,3vw,44px)] py-8">
      <PerfilForm
        nombre={perfil?.nombre ?? "Estudiante"}
        correo={perfil?.correo ?? user!.email ?? ""}
        celular={perfil?.celular ?? null}
        insignia={insignia}
        certificados={certificados}
        estadoAcceso={estadoAcceso}
      />
    </div>
  );
}
