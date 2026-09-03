import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PerfilAdminForm } from "@/components/admin/configuracion/PerfilAdminForm";
import { getPerfilActual } from "@/lib/perfil";

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
          {/* `truncate`: a `text-base` (16px, el tamaño que usan los inputs
              por debajo de `sm` para que iOS no haga zoom al enfocar) este
              nombre no cabe en un teléfono angosto. Al estar deshabilitado
              nadie puede enfocarlo para desplazarse y ver el resto, así que
              sin esto la cola del texto queda invisible en vez de solo
              recortada con puntos suspensivos. */}
          <Input
            id="plataforma-nombre"
            defaultValue="U.V.A — Unidad Vectorial de Arquitectura"
            disabled
            className="truncate"
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
    </div>
  );
}
