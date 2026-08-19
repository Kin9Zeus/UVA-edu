import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ActualizarPasswordForm } from "@/components/auth/ActualizarPasswordForm";
import { PerfilAdminForm } from "@/components/admin/configuracion/PerfilAdminForm";
import { getPerfilActual } from "@/lib/perfil";
import { logout } from "@/actions/auth/logout";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Configuración",
};

export default async function AdminConfiguracionPage() {
  const { user, perfil } = await getPerfilActual();
  if (!user) redirect("/login?redirect=/admin/configuracion");

  const nombre = perfil?.nombre ?? user.email?.split("@")[0] ?? "Administrador";
  const correo = perfil?.correo ?? user.email ?? "";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl text-uva-text">Configuración</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Perfil del administrador</CardTitle>
          </CardHeader>
          <CardContent>
            <PerfilAdminForm nombre={nombre} correo={correo} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos de la plataforma</CardTitle>
            <CardDescription>
              Todavía no hay una tabla de configuración global en el esquema — estos campos son informativos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <Label htmlFor="plataforma-nombre">Nombre</Label>
              <Input id="plataforma-nombre" defaultValue="U.V.A — Unidad Vectorial de Arquitectura" disabled />
            </div>
            <div>
              <Label htmlFor="plataforma-descripcion">Descripción</Label>
              <Input
                id="plataforma-descripcion"
                defaultValue="Plataforma de formación para el gremio de la construcción en LATAM"
                disabled
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Seguridad</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="max-w-[420px]">
              <ActualizarPasswordForm />
            </div>
            <Separator />
            <div>
              <p className="mb-2 text-sm text-uva-text-muted">Cerrar la sesión actual en este dispositivo.</p>
              <form action={logout}>
                <Button type="submit" variant="outline" className="w-auto">
                  Cerrar sesión
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
