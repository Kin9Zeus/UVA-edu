import type { Metadata } from "next";
import { getUsuarios } from "@/lib/admin/usuarios";
import { UsuariosTable } from "@/components/admin/usuarios/UsuariosTable";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Usuarios",
};

export default async function AdminUsuariosPage() {
  const usuarios = await getUsuarios();

  return (
    <div className="flex flex-col gap-6">
      <UsuariosTable usuarios={usuarios} />
    </div>
  );
}
