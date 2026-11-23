import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccesoMarco } from "@/components/auth/AccesoMarco";
import { NuevaContrasenaFlujo } from "@/components/auth/NuevaContrasenaFlujo";
import { createClient } from "@/lib/supabase/server";
import { RUTA_CAMBIO_CONTRASENA } from "@/lib/auth/recuperacion";
import { faltaCodigoParaCambiarContrasena, rutaSegundoFactor } from "@/lib/auth/aal";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  robots: { index: false, follow: false },
};

export default async function ActualizarPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  // Camino normal: el enlace del correo pasa por /auth/confirm, que canjea
  // el token_hash, marca la sesión como de recuperación
  // (lib/auth/recuperacion.ts) y llega aquí con ella en cookies.
  //
  // Camino de respaldo: si Supabase envía el correo con su plantilla propia
  // (el "Send Email" hook apagado, como en staging), un enlace viejo puede
  // llegar directo aquí con `?code=` (PKCE). Se manda a /auth/confirm para
  // que lo canjee y lo marque igual: esta página no puede escribir cookies.
  const { code } = await searchParams;

  if (code) {
    redirect(`/auth/confirm?code=${encodeURIComponent(code)}&next=${encodeURIComponent(RUTA_CAMBIO_CONTRASENA)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Con segundo factor, Supabase no deja cambiar la contraseña desde la
  // sesión del enlace (aal1): primero el código, y de vuelta aquí en aal2.
  if (await faltaCodigoParaCambiarContrasena()) {
    redirect(rutaSegundoFactor("verificar", "/actualizar-password"));
  }

  // `user` es solo para el gestor de contraseñas (el usuario del formulario).
  // Sin sesión no es un fallo de esta pantalla: el guardado responde «Tu
  // enlace expiró».

  return (
    <AccesoMarco>
      <NuevaContrasenaFlujo correo={user?.email ?? ""} />
    </AccesoMarco>
  );
}
