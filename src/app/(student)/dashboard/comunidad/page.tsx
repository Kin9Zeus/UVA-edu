import type { Metadata } from "next";
import { getPerfilActual } from "@/lib/perfil";
import { createClient } from "@/lib/supabase/server";
import { ComunidadPausada } from "@/components/dashboard/ComunidadPausada";
import { Proximamente } from "@/components/dashboard/Proximamente";

export const metadata: Metadata = { title: "U.V.A. — Comunidad" };

export default async function ComunidadPage() {
  const { user } = await getPerfilActual();
  const supabase = await createClient();

  const { data: suscripcion } = await supabase
    .from("suscripciones")
    .select("estado")
    .eq("id_usuario", user!.id)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!suscripcion) {
    return <ComunidadPausada motivo="SIN_SUSCRIPCION" />;
  }
  if (suscripcion.estado === "VENCIDA") {
    return <ComunidadPausada motivo="VENCIDA" />;
  }
  if (suscripcion.estado === "CANCELADA") {
    return <ComunidadPausada motivo="CANCELADA" />;
  }

  return (
    <Proximamente
      titulo="Comunidad"
      descripcion="El espacio de preguntas y respuestas del gremio todavía no está disponible."
    />
  );
}
