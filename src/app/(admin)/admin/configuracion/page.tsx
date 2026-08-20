import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ActualizarPasswordForm } from "@/components/auth/ActualizarPasswordForm";
import { PerfilAdminForm } from "@/components/admin/configuracion/PerfilAdminForm";
import { getPerfilActual } from "@/lib/perfil";
import { logout } from "@/actions/auth/logout";

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

  return (
    // El mockup apila las tres tarjetas en una sola columna de 640px.
    <div className="flex max-w-[640px] flex-col gap-5">
      <AdminCard>
        <TituloTarjeta>Perfil del administrador</TituloTarjeta>
        <PerfilAdminForm nombre={nombre} correo={correo} />
      </AdminCard>

      <AdminCard>
        <TituloTarjeta>Plataforma</TituloTarjeta>
        {/* Los campos quedan deshabilitados a propósito: el esquema todavía no
            tiene una tabla de configuración global donde guardarlos. */}
        <div>
          <Label htmlFor="plataforma-nombre">Nombre de la plataforma</Label>
          <Input
            id="plataforma-nombre"
            defaultValue="U.V.A — Unidad Vectorial de Arquitectura"
            disabled
          />
        </div>
        <div>
          <Label htmlFor="plataforma-descripcion">Descripción</Label>
          <Textarea
            id="plataforma-descripcion"
            defaultValue="Plataforma de formación para el gremio de la construcción en LATAM"
            className="min-h-[70px]"
            disabled
          />
        </div>
        <p className="text-xs text-uva-muted-2">
          Informativo por ahora: no existe una tabla de configuración global en el esquema.
        </p>
      </AdminCard>

      <AdminCard>
        <TituloTarjeta>Seguridad</TituloTarjeta>
        <ActualizarPasswordForm />

        <div className="h-px bg-uva-divider" />

        <form action={logout}>
          <Button type="submit" variant="destructive" size="sm">
            Cerrar sesión
          </Button>
        </form>
      </AdminCard>
    </div>
  );
}
