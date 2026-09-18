"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { borrarFotoPerfil } from "@/lib/perfil/avatar";
import { logError } from "@/lib/log";

export type EliminarCuentaState = { error: string } | null;

function mensajeEspera(segundos: number): string {
  const minutos = Math.ceil(segundos / 60);
  return `Demasiados intentos. Espera ${minutos} minuto${minutos === 1 ? "" : "s"} e intenta de nuevo.`;
}

/**
 * Autoservicio de supresión de datos personales (P2-11, AUDIT-2026-09-15.md).
 * Cierra la brecha que dejaba `anonimizarUsuario`
 * (src/actions/admin/usuarios.ts): esa solo la puede disparar un
 * administrador, y la Ley 1581/GDPR exigen que el propio titular pueda
 * pedirlo sin depender de que alguien más lo atienda.
 *
 * Doble confirmación antes de una acción irreversible:
 *
 *   1. Escribir el correo de la propia cuenta — funciona para CUALQUIER
 *      cuenta, tenga o no contraseña (alguien que entró solo con "Continuar
 *      con Google" nunca creó una).
 *   2. Reautenticación con la contraseña actual, SOLO si la cuenta tiene una
 *      identidad `email` — mismo patrón y mismo rate limit que
 *      cambiarPassword() (src/actions/perfil/cambiar-password.ts), reutiliza
 *      verificar_intentos_login/registrar_login_fallido en vez de crear un
 *      límite nuevo: es la misma amenaza, adivinar una contraseña.
 *
 * `solicitar_supresion_propia()` (supabase/sql/109) nunca recibe un id del
 * cliente: opera siempre sobre `auth.uid()` del lado de la base, así que no
 * hay forma de que esta Server Action —ni nadie con una sesión robada de
 * otro usuario cuyo uuid conozca— anonimice a alguien más.
 */
export async function eliminarMiCuenta(
  _prevState: EliminarCuentaState,
  formData: FormData,
): Promise<EliminarCuentaState> {
  const correoConfirmacion = String(formData.get("correo_confirmacion") ?? "").trim();
  const passwordActual = String(formData.get("password_actual") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  if (correoConfirmacion.toLowerCase() !== user.email.toLowerCase()) {
    return { error: "El correo no coincide con el de tu cuenta." };
  }

  const admin = createAdminClient();
  const tienePassword = (user.identities ?? []).some((identidad) => identidad.provider === "email");

  if (tienePassword) {
    if (!passwordActual) {
      return { error: "Ingresa tu contraseña actual." };
    }

    const { data: chequeo, error: errorChequeo } = await admin
      .rpc("verificar_intentos_login", { p_correo: user.email })
      .single();

    if (errorChequeo) {
      logError("eliminarMiCuenta", "verificar_intentos_login rpc falló", errorChequeo);
    } else {
      const { permitido, segundos_espera } = chequeo as {
        permitido: boolean;
        segundos_espera: number;
      };
      if (!permitido) {
        return { error: mensajeEspera(segundos_espera) };
      }
    }

    const { error: errorReauth } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: passwordActual,
    });

    if (errorReauth) {
      const { error: errorRegistro } = await admin.rpc("registrar_login_fallido", { p_correo: user.email });
      if (errorRegistro) {
        logError("eliminarMiCuenta", "registrar_login_fallido rpc falló", errorRegistro);
      }
      return { error: "Tu contraseña actual no es correcta." };
    }

    const { error: errorLimpieza } = await admin.rpc("limpiar_intentos_login", { p_correo: user.email });
    if (errorLimpieza) {
      logError("eliminarMiCuenta", "limpiar_intentos_login rpc falló", errorLimpieza);
    }
  }

  // La foto se borra ANTES de la RPC y desde acá, no desde SQL — mismo
  // motivo que en el flujo de admin (108_anonimizar_usuario_foto.sql): la
  // función de base deja `foto_url = null`, pero no puede llamar a la API
  // de Storage.
  const { data: perfil } = await supabase.from("perfiles").select("foto_url").eq("id", user.id).single();
  await borrarFotoPerfil(supabase, perfil?.foto_url ?? null);

  const { error: errorSupresion } = await supabase.rpc("solicitar_supresion_propia");

  if (errorSupresion) {
    // 42501 es el código que la propia RPC levanta a propósito (sesión sin
    // perfil, o cuenta ADMINISTRADOR) — ese mensaje ya está escrito para que
    // lo lea el usuario. Cualquier otro código es un fallo real de la base:
    // no se debe mostrar tal cual.
    if (errorSupresion.code === "42501") {
      return { error: errorSupresion.message };
    }
    logError("eliminarMiCuenta", "No se pudo suprimir la cuenta propia", errorSupresion, {
      area: "cuenta",
    });
    return { error: "No pudimos eliminar tu cuenta. Intenta de nuevo o contacta soporte." };
  }

  // Igual que suspenderActivarUsuario/anonimizarUsuario: las sesiones ya se
  // borraron dentro de la transacción de la RPC (auth.sessions), pero el
  // access token de ESTA request sigue siendo válido hasta que expire. Este
  // signOut corta además la cookie local de inmediato.
  await supabase.auth.signOut();

  redirect("/cuenta-eliminada");
}
