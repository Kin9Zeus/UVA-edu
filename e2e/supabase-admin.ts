import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con Service Role Key para preparar y limpiar datos desechables
 * en los specs de Playwright — mismo patrón que scripts/rls-test.ts y
 * scripts/webhook-test.ts: nada de esto pasa por RLS, y todo se borra al
 * final del spec pase o falle. Corre contra el proyecto REAL de Supabase
 * (no hay staging separado, ver Ground Truth de AUDIT-2026-08-24.md).
 */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Crea un usuario desechable con el correo ya confirmado (sin pasar por bandeja real). */
export async function crearUsuarioConfirmado(
  admin: ReturnType<typeof adminClient>,
  params: { email: string; password: string; nombre?: string },
) {
  const { data, error } = await admin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: params.nombre ? { nombre: params.nombre } : undefined,
  });
  if (error || !data.user) {
    throw new Error(`No pude crear el usuario de prueba: ${error?.message}`);
  }
  return data.user;
}

/**
 * Promueve un usuario recién creado a ADMINISTRADOR. Permitido porque
 * private.perfiles_bloquea_autopromocion() (013) trae un bypass explícito
 * para service_role — ver el comentario de ese archivo.
 */
export async function promoverAAdministrador(admin: ReturnType<typeof adminClient>, userId: string) {
  const { error } = await admin.from("perfiles").update({ rol: "ADMINISTRADOR" }).eq("id", userId);
  if (error) throw new Error(`No pude promover el usuario a ADMINISTRADOR: ${error.message}`);
}

/**
 * Promueve un usuario a PROFESOR — el rol que hace falta para que aparezca en
 * el selector de instructores de un curso. Desde la migración
 * `20260903000000_multi_instructores`, instructor y profesor son la misma
 * entidad: no hay forma de fabricar un instructor sin una cuenta real.
 * Mismo bypass de service_role que promoverAAdministrador.
 */
export async function promoverAProfesor(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  especialidad?: string,
) {
  const { error } = await admin
    .from("perfiles")
    .update({ rol: "PROFESOR", especialidad: especialidad ?? null })
    .eq("id", userId);
  if (error) throw new Error(`No pude promover el usuario a PROFESOR: ${error.message}`);
}

/**
 * Genera el enlace de confirmación real que Supabase mandaría por correo,
 * sin depender de una bandeja de entrada.
 *
 * OJO: `properties.action_link` (flujo implícito, tokens en el fragmento
 * `#` de la URL) NO sirve aquí — apunta directo al `redirectTo` sin pasar
 * por `/auth/confirm`, que es la ruta que este recorrido necesita
 * ejercitar. Se usa en cambio `properties.hashed_token` para construir la
 * URL a mano, exactamente como lo hace el propio webhook de
 * supabase-auth (src/app/api/webhooks/supabase-auth/route.ts): así el
 * enlace SÍ llega a `/auth/confirm?token_hash=...&type=...`, que es lo
 * que un correo real de este proyecto manda.
 */
export async function generarEnlaceConfirmacion(
  admin: ReturnType<typeof adminClient>,
  params: { email: string; password: string; origin: string; next: string },
) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: params.email,
    password: params.password,
  });
  if (error || !data.properties?.hashed_token) {
    throw new Error(`No pude generar el enlace de confirmación: ${error?.message}`);
  }
  const { hashed_token, verification_type } = data.properties;
  return `${params.origin}/auth/confirm?token_hash=${hashed_token}&type=${verification_type}&next=${encodeURIComponent(params.next)}`;
}

export async function borrarUsuarioPorEmail(admin: ReturnType<typeof adminClient>, email: string) {
  // listUsers no tiene filtro por email en este SDK; se pagina hasta
  // encontrarlo. El volumen de usuarios reales es bajo hoy, así que una
  // sola página (1000) alcanza sin problema.
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return;
  const user = data.users.find((u) => u.email === email);
  if (!user) return;
  const { error: errDelete } = await admin.auth.admin.deleteUser(user.id); // cascada a perfiles (010)
  if (errDelete) {
    // No silenciar: un usuario desechable que no se borra ensucia el
    // proyecto real de Supabase (no hay staging separado).
    console.error(`No pude borrar el usuario de prueba ${email}: ${errDelete.message}`);
  }
}
