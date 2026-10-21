import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AccesoMarco } from "@/components/auth/AccesoMarco";
import { CanjearFlujo } from "@/components/auth/CanjearFlujo";
import { formatFecha } from "@/lib/admin/format";
import { suscripcionDaAcceso } from "@/lib/estadoAcceso";
import { getUsuarioActual } from "@/lib/perfil";
import { getSuscripcionActual } from "@/lib/suscripcion";

export const metadata: Metadata = {
  title: "U.V.A. — Canjea tu invitación",
  robots: { index: false, follow: false },
};

export default async function CanjearPage() {
  // Depende de la sesión: nunca se prerenderiza (mismo motivo que /recuperar).
  await connection();

  // Sin sesión se pasa por el acceso y se vuelve aquí: es el destino del
  // botón «Tengo un código» de la portada.
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login?redirect=%2Fcanjear");

  const suscripcion = await getSuscripcionActual(usuario.id);
  const tieneAcceso = suscripcion !== null && suscripcionDaAcceso(suscripcion);
  const vigencia = !tieneAcceso
    ? null
    : suscripcion?.fechaRenovacion
      ? `Tu acceso está activo hasta el ${formatFecha(suscripcion.fechaRenovacion)}.`
      : "Tu acceso no tiene fecha de cierre.";

  return (
    <AccesoMarco>
      <CanjearFlujo vigencia={vigencia} />
    </AccesoMarco>
  );
}
