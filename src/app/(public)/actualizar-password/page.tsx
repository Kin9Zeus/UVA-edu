import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccesoMarco } from "@/components/auth/AccesoMarco";
import { NuevaContrasenaFlujo } from "@/components/auth/NuevaContrasenaFlujo";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { nivelFalloEnlace } from "@/lib/enlace-auth";

export const metadata: Metadata = {
  title: "U.V.A. — Nueva contraseña",
};

export default async function ActualizarPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  // Camino normal: el enlace del correo pasa por /auth/confirm, que ya
  // canjea el token_hash y llega aquí con la sesión de recuperación puesta
  // en cookies (ver src/actions/auth/confirmar-enlace.ts).
  //
  // Camino de respaldo: si Supabase envía el correo con su plantilla propia
  // (p. ej. el "Send Email" hook no está configurado o no es alcanzable,
  // como al probar contra localhost), el enlace apunta directo aquí con
  // `?code=` (PKCE) en vez de pasar por /auth/confirm. Sin este canje, la
  // página carga igual pero no hay sesión y el guardado falla con "Tu
  // enlace expiró o no es válido" — por eso se cubre también este caso.
  const { code } = await searchParams;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logError("actualizar-password", "exchangeCodeForSession falló", error, {
        nivel: nivelFalloEnlace(error),
      });
      redirect("/login?error=enlace_invalido");
    }

    redirect("/actualizar-password");
  }

  // Solo para el gestor de contraseñas (el usuario del formulario). Sin sesión
  // no es un fallo de esta pantalla: el guardado responde «Tu enlace expiró».
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AccesoMarco>
      <NuevaContrasenaFlujo correo={user?.email ?? ""} />
    </AccesoMarco>
  );
}
