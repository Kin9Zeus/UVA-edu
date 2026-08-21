import type { Metadata } from "next";
import { getPerfilActual } from "@/lib/perfil";
import { getSuscripcionActual } from "@/lib/suscripcion";
import { SuscripcionContent } from "@/components/dashboard/SuscripcionContent";

export const metadata: Metadata = { title: "U.V.A. — Suscripción" };

export default async function SuscripcionPage() {
  const { user } = await getPerfilActual();
  const suscripcion = await getSuscripcionActual(user!.id);

  return <SuscripcionContent suscripcion={suscripcion} />;
}
