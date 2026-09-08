import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { DiagnosticoRed } from "@/components/admin/configuracion/DiagnosticoRed";
import { PerfilAdminForm } from "@/components/admin/configuracion/PerfilAdminForm";
import { getPerfilActual } from "@/lib/perfil";
import { diagnosticoIp } from "@/lib/clientIp";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Configuración",
};

function TituloTarjeta({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-[15px] font-bold tracking-[-0.02em] text-uva-text">
      {children}
    </h2>
  );
}

export default async function AdminConfiguracionPage() {
  const { user, perfil } = await getPerfilActual();
  if (!user) redirect("/login?redirect=/admin/configuracion");

  const nombre = perfil?.nombre ?? user.email?.split("@")[0] ?? "Administrador";
  const correo = perfil?.correo ?? user.email ?? "";
  const diagnostico = await diagnosticoIp();

  return (
    <div className="flex max-w-[640px] flex-col gap-5">
      <AdminCard>
        <TituloTarjeta>Perfil del administrador</TituloTarjeta>
        <PerfilAdminForm nombre={nombre} correo={correo} />
      </AdminCard>

      <AdminCard>
        <TituloTarjeta>Diagnóstico de red</TituloTarjeta>
        <DiagnosticoRed diagnostico={diagnostico} />
      </AdminCard>
    </div>
  );
}
