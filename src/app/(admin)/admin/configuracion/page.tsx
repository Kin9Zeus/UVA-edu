import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { PerfilAdminForm } from "@/components/admin/configuracion/PerfilAdminForm";
import { getPerfilActual } from "@/lib/perfil";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Configuración",
};

function TituloTarjeta({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-uva-cuerpo font-bold tracking-[-0.02em] text-uva-text">
      {children}
    </h2>
  );
}

export default async function AdminConfiguracionPage() {
  const { user, perfil } = await getPerfilActual();
  if (!user) redirect("/login?redirect=/admin/configuracion");

  const nombre = perfil?.nombre ?? user.email?.split("@")[0] ?? "Administrador";
  const correo = perfil?.correo ?? user.email ?? "";

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo="Perfil" descripcion="Tu nombre y tu foto, tal como aparecen en el panel." />
      <AdminCard className="max-w-[640px]">
        <TituloTarjeta>Perfil del administrador</TituloTarjeta>
        <PerfilAdminForm nombre={nombre} correo={correo} fotoUrl={perfil?.foto_url ?? null} />
      </AdminCard>
    </div>
  );
}
