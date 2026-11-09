import { expect, type Browser, type BrowserContextOptions } from "@playwright/test";
import {
  adminClient,
  borrarUsuarioPorEmail,
  crearUsuarioConfirmado,
  CURSO_FIXTURE,
  limpiarDatosDeUsuario,
  promoverAAdministrador,
} from "./supabase-admin";
import { esperarTurnstile } from "./turnstile";

/**
 * Preparación común de los barridos de accesibilidad (a11y-barrido,
 * a11y-baja-vision): un estudiante con acceso y un admin de prueba, su
 * sesión iniciada y las pantallas que ve cada rol.
 */

export type Rol = "anonimo" | "estudiante" | "admin";
export const TODOS_LOS_ROLES: Rol[] = ["anonimo", "estudiante", "admin"];

const admin = adminClient();
const sufijo = Date.now();
const password = "Abcdefg1!x";
const emails = {
  estudiante: `e2e-a11y-estudiante-${sufijo}@uva.test`,
  admin: `e2e-a11y-admin-${sufijo}@uva.test`,
};
const ids: Partial<Record<Rol, string>> = {};
export const sesiones: Partial<Record<Rol, BrowserContextOptions["storageState"]>> = {};
export const rutas: Record<Rol, string[]> = { anonimo: [], estudiante: [], admin: [] };

async function iniciarSesion(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.fill("#auth-email", email);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator("#login-pass")).toBeVisible({ timeout: 30_000 });
  await page.fill("#login-pass", password);
  await esperarTurnstile(page);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
  const estado = await context.storageState();
  await context.close();
  return estado;
}

export async function prepararUsuariosYRutas(browser: Browser) {
  for (const rol of ["estudiante", "admin"] as const) {
    const user = await crearUsuarioConfirmado(admin, { email: emails[rol], password, nombre: `E2E A11y ${rol}` });
    ids[rol] = user.id;
  }
  await promoverAAdministrador(admin, ids.admin!);

  const { data: plan, error: errPlan } = await admin.from("planes").select("id").limit(1).single();
  if (errPlan || !plan) throw new Error(`No hay plan para otorgar acceso de prueba: ${errPlan?.message}`);
  const { error: errSuscripcion } = await admin.from("suscripciones").insert({
    id_usuario: ids.estudiante,
    id_plan: plan.id,
    fecha_inicio: new Date().toISOString(),
    fecha_renovacion: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    estado: "ACTIVA",
    proveedor: "manual",
    monto_centavos: 0,
    moneda: "COP",
    acceso_manual: true,
  });
  if (errSuscripcion) throw new Error(`No pude crear la suscripción de prueba: ${errSuscripcion.message}`);

  for (const rol of ["estudiante", "admin"] as const) sesiones[rol] = await iniciarSesion(browser, emails[rol]);

  // Staging no tiene las lecciones exactas de CURSO_FIXTURE ni videos listos:
  // basta el curso semilla con una lección introductoria y una con acceso.
  const { data: curso, error: errCurso } = await admin
    .from("cursos")
    .select("slug, modulos(lecciones(slug, orden, es_introductoria))")
    .eq("id", CURSO_FIXTURE.id)
    .single();
  if (errCurso || !curso) throw new Error(`No encontré el curso semilla: ${errCurso?.message}`);
  const cursoSlug = curso.slug as string;
  const lecciones = curso.modulos.flatMap((m) => m.lecciones);
  const introductoria = lecciones.find((l) => l.es_introductoria)!.slug;
  const conAcceso = lecciones.find((l) => !l.es_introductoria)!.slug;
  const { data: post } = await admin.from("comunidad_posts").select("slug").eq("eliminado", false).limit(1).maybeSingle();
  const { data: perfil } = await admin.from("perfiles").select("slug").eq("id", ids.estudiante!).single();
  const { data: certificado } = await admin.from("certificados").select("codigo_verificacion").limit(1).maybeSingle();
  const cat = CURSO_FIXTURE.categoriaSlug;

  rutas.anonimo = [
    "/",
    "/catalogo",
    `/catalogo/${cat}`,
    `/cursos/${cursoSlug}`,
    `/cursos/${cursoSlug}/${introductoria}`,
    "/login",
    "/registro",
    "/recuperar",
    "/canjear",
    "/soporte",
    "/verificar-correo",
    "/actualizar-password",
    "/cuenta-eliminada",
    "/verificar-certificado",
    ...(certificado ? [`/verificar-certificado/${certificado.codigo_verificacion}`] : []),
    "/ruta-que-no-existe",
  ];
  rutas.estudiante = [
    "/dashboard",
    "/dashboard/catalogo",
    `/dashboard/catalogo/${cat}`,
    "/dashboard/progreso",
    "/dashboard/certificados",
    "/dashboard/notas",
    "/dashboard/comunidad",
    ...(post ? [`/dashboard/comunidad/${post.slug}`] : []),
    "/dashboard/perfil",
    "/dashboard/suscripcion",
    "/dashboard/soporte",
    `/cursos/${cursoSlug}/${conAcceso}`,
    `/cursos/${cursoSlug}/examen`,
    "/acceso-denegado",
  ];
  rutas.admin = [
    "/admin",
    "/admin/bitacora",
    "/admin/categorias",
    "/admin/codigos",
    "/admin/comunidad",
    "/admin/configuracion",
    "/admin/cupones",
    "/admin/cursos",
    "/admin/cursos/nuevo",
    `/admin/cursos/${cursoSlug}`,
    "/admin/planes",
    "/admin/usuarios",
    `/admin/usuarios/${perfil!.slug}`,
  ];
}

export async function borrarUsuarios() {
  for (const rol of ["estudiante", "admin"] as const) {
    if (ids[rol]) await limpiarDatosDeUsuario(admin, ids[rol]!);
    await borrarUsuarioPorEmail(admin, emails[rol]);
  }
}
