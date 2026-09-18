import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import {
  adminClient,
  borrarUsuarioPorEmail,
  crearUsuarioConfirmado,
  CURSO_FIXTURE,
  limpiarDatosDeUsuario,
  obtenerSlugsCursoFixture,
  promoverAAdministrador,
  promoverAProfesor,
  verificarCursoFixture,
} from "./supabase-admin";

/**
 * Capa 1 de las pruebas "manipulando" antes de producción: recorre TODAS las
 * páginas de la app con cada tipo de usuario y junta en un solo informe lo que
 * se rompe, en vez de parar en el primer fallo.
 *
 * En cada visita se registra como hallazgo:
 *   - 5xx       respuesta >= 500 del propio servidor (documento, RSC o Server Action)
 *   - excepcion error de JavaScript sin capturar en el navegador
 *   - consola   console.error (incluye los avisos de hidratación de React)
 *   - pantalla  se pintó el error.tsx ("Algo salió mal de nuestro lado")
 *   - acceso    el usuario terminó donde no debía (entró a algo prohibido o lo sacaron de algo suyo)
 *   - 404       una URL inventada no respondió 404
 *   - overflow  a 390px de ancho la página se desborda en horizontal
 *   - csp       aviso de la CSP en modo Report-Only (se informa, no hace fallar)
 *
 * Corre contra el proyecto real de Supabase (no hay staging): los usuarios
 * se crean al empezar y se borran al terminar, pase o falle. El informe queda
 * en test-results/capa1/hallazgos.json.
 *
 * Conviene correrlo contra un build de producción y no contra `next dev`: en
 * un equipo de 6 GB, compilar ~60 rutas on-demand agotó la memoria y el
 * servidor empezó a devolver 500 que no eran de la app. Playwright reusa el
 * servidor que ya esté escuchando en :3000:
 *
 *   npm run build && npm run start      (en otra terminal)
 *   npx playwright test e2e/capa1-recorrido-por-rol.spec.ts
 */

type Rol = "anonimo" | "sinAcceso" | "conAcceso" | "profesor" | "admin" | "suspendido";
const TODOS_LOS_ROLES: Rol[] = ["anonimo", "sinAcceso", "conAcceso", "profesor", "admin", "suspendido"];
// CAPA1_ROLES=conAcceso,admin repite solo esos roles (p. ej. tras una corrida interrumpida).
const ROLES = process.env.CAPA1_ROLES
  ? TODOS_LOS_ROLES.filter((r) => process.env.CAPA1_ROLES!.split(",").includes(r))
  : TODOS_LOS_ROLES;

type TipoHallazgo = "5xx" | "excepcion" | "consola" | "pantalla" | "acceso" | "404" | "overflow" | "timeout" | "csp";

interface Hallazgo {
  rol: Rol;
  ruta: string;
  tipo: TipoHallazgo;
  detalle: string;
}

interface Ruta {
  path: string;
  /** La URL no existe a propósito: si no redirige a otro lado, debe dar 404. */
  inventada?: boolean;
  /** Dónde debe terminar cada rol. Sin entrada = no se comprueba el destino. */
  destino?: Partial<Record<Rol, RegExp>>;
}

const admin = adminClient();
const sufijo = Date.now();
const password = "Abcdefg1!x";
const emails: Record<Exclude<Rol, "anonimo">, string> = {
  sinAcceso: `e2e-capa1-sinacceso-${sufijo}@uva.test`,
  conAcceso: `e2e-capa1-conacceso-${sufijo}@uva.test`,
  profesor: `e2e-capa1-profesor-${sufijo}@uva.test`,
  admin: `e2e-capa1-admin-${sufijo}@uva.test`,
  suspendido: `e2e-capa1-suspendido-${sufijo}@uva.test`,
};
const ids: Partial<Record<Rol, string>> = {};
const sesiones: Partial<Record<Rol, BrowserContextOptions["storageState"]>> = {};
const hallazgos: Hallazgo[] = [];
let rutas: Ruta[] = [];

const RUIDO_CONSOLA = [
  /Download the React DevTools/i,
  /\[HMR\]/,
  /\[Fast Refresh\]/,
  // Informativo de Chrome mientras la CSP sea Report-Only: la directiva
  // (src/lib/csp.ts) empieza a aplicarse sola cuando se fuerce la política.
  /'upgrade-insecure-requests' is ignored when delivered in a report-only policy/,
];
const ES_CSP = /Content Security Policy|Report Only|\[Report Only\]/i;

async function iniciarSesion(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.fill("#auth-email", email);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator("#login-pass")).toBeVisible({ timeout: 30_000 });
  await page.fill("#login-pass", password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
  const estado = await context.storageState();
  await context.close();
  return estado;
}

function construirRutas(datos: {
  categoriaSlug: string;
  cursoSlug: string;
  leccionPublica: string;
  leccionGateada: string;
  postSlug: string | null;
  usuarioSlug: string;
  codigoCertificado: string | null;
}): Ruta[] {
  const { categoriaSlug, cursoSlug, leccionPublica, leccionGateada, postSlug, usuarioSlug, codigoCertificado } = datos;

  const publicas: Ruta[] = [
    "/",
    "/catalogo",
    `/catalogo/${categoriaSlug}`,
    `/cursos/${cursoSlug}`,
    `/cursos/${cursoSlug}/${leccionPublica}`,
    "/planes",
    "/login",
    "/registro",
    "/recuperar",
    "/soporte",
    "/verificar-correo",
    "/actualizar-password",
    "/cuenta-eliminada",
    "/acceso-denegado",
    "/auth/confirm",
    "/auth/confirm?token_hash=basura&type=signup",
    ...(codigoCertificado ? [`/verificar-certificado/${codigoCertificado}`] : []),
    // Un código inexistente responde 200 A PROPÓSITO: la página es un
    // verificador y "no encontrado" es un resultado, no una ruta rota.
    "/verificar-certificado/NOEXISTE-0000",
  ].map((path) => ({ path }));

  const leccion: Ruta[] = [
    {
      path: `/cursos/${cursoSlug}/${leccionGateada}`,
      destino: {
        anonimo: /\/login\?redirect=/,
        sinAcceso: new RegExp(`/cursos/${cursoSlug}$`),
        conAcceso: new RegExp(`/cursos/${cursoSlug}/${leccionGateada}$`),
      },
    },
    { path: `/cursos/${cursoSlug}/examen`, destino: { anonimo: /\/login\?redirect=/ } },
  ];

  const estudiante: Ruta[] = [
    "/dashboard",
    "/dashboard/catalogo",
    `/dashboard/catalogo/${categoriaSlug}`,
    "/dashboard/certificados",
    "/dashboard/checkout",
    "/dashboard/comunidad",
    ...(postSlug ? [`/dashboard/comunidad/${postSlug}`] : []),
    "/dashboard/perfil",
    "/dashboard/planes",
    "/dashboard/progreso",
    "/dashboard/soporte",
    "/dashboard/suscripcion",
  ].map((path) => ({
    path,
    destino: {
      anonimo: /\/login\?redirect=/,
      suspendido: /\/login/,
      sinAcceso: /\/dashboard/,
      conAcceso: /\/dashboard/,
      profesor: /\/dashboard/,
      admin: /\/dashboard/,
    },
  }));

  const panel: Ruta[] = [
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
    `/admin/usuarios/${usuarioSlug}`,
  ].map((path) => ({
    path,
    destino: {
      anonimo: /\/login\?redirect=/,
      suspendido: /\/login/,
      sinAcceso: /\/acceso-denegado$/,
      conAcceso: /\/acceso-denegado$/,
      profesor: /\/acceso-denegado$/,
      admin: /\/admin/,
    },
  }));

  const inventadas: Ruta[] = [
    "/ruta-que-no-existe",
    "/cursos/curso-que-no-existe",
    `/cursos/${cursoSlug}/leccion-que-no-existe`,
    "/cursos/curso-que-no-existe/examen",
    "/catalogo/categoria-que-no-existe",
    "/vista-previa/token-invalido",
    "/vista-previa/token-invalido/leccion",
    "/dashboard/comunidad/post-que-no-existe",
    "/dashboard/catalogo/categoria-que-no-existe",
    "/admin/cursos/curso-que-no-existe",
    "/admin/usuarios/usuario-que-no-existe",
    // Un UUID con formato válido pero inexistente recorre otro camino
    // (esUuid() en src/lib/slug.ts) que un slug cualquiera.
    "/cursos/00000000-0000-4000-8000-000000000000",
  ].map((path) => ({ path, inventada: true }));

  // Las del panel y el dashboard van al FINAL a propósito: para el rol
  // "suspendido", la primera visita a una ruta protegida cierra la sesión
  // (src/lib/supabase/proxy.ts), y antes queremos ver cómo se comporta una
  // cuenta suspendida con la sesión todavía viva en las páginas públicas.
  return [...publicas, ...leccion, ...inventadas, ...estudiante, ...panel];
}

async function visitar(page: Page, rol: Rol, ruta: Ruta) {
  const propios: Hallazgo[] = [];
  const anotar = (tipo: TipoHallazgo, detalle: string) => propios.push({ rol, ruta: ruta.path, tipo, detalle });

  const onConsole = (msg: import("@playwright/test").ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const texto = msg.text();
    if (RUIDO_CONSOLA.some((r) => r.test(texto))) return;
    const recurso = msg.location().url;
    // El 404 del propio documento en una URL inventada es lo esperado y el
    // navegador lo repite en consola. Un 404 de cualquier otro recurso sí cuenta.
    if (ruta.inventada && /status of 404/.test(texto) && (!recurso || new URL(recurso).pathname === new URL(page.url()).pathname)) {
      return;
    }
    if (/Failed to load resource/.test(texto) && recurso) {
      anotar("consola", `${texto} — ${recurso}`.slice(0, 500));
      return;
    }
    anotar(ES_CSP.test(texto) ? "csp" : "consola", texto.slice(0, 500));
  };
  const onPageError = (err: Error) => anotar("excepcion", `${err.name}: ${err.message}`.slice(0, 500));
  const onResponse = (resp: import("@playwright/test").Response) => {
    const url = new URL(resp.url());
    if (url.origin !== "http://localhost:3000") return;
    if (resp.status() >= 500) anotar("5xx", `${resp.status()} ${resp.request().method()} ${url.pathname}${url.search}`);
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  try {
    const respuesta = await page.goto(ruta.path, { waitUntil: "load", timeout: 60_000 });
    // El reproductor de Mux y los listeners de Supabase mantienen conexiones
    // abiertas: networkidle puede no llegar nunca, así que es solo una espera
    // acotada para que termine de hidratar y disparar sus errores.
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

    const final = new URL(page.url());
    const finalPath = final.pathname + final.search;

    if (await page.getByText("Algo salió mal de nuestro lado").isVisible().catch(() => false)) {
      anotar("pantalla", `se mostró la pantalla de error 500 (final: ${finalPath})`);
    }

    const esperado = ruta.destino?.[rol];
    if (esperado && !esperado.test(finalPath)) {
      anotar("acceso", `esperaba ${esperado} y terminó en ${finalPath} (HTTP ${respuesta?.status()})`);
    }

    // Solo si no hubo redirección: una inventada bajo /dashboard para un
    // anónimo termina en /login, y eso es correcto.
    const sinRedireccion = final.pathname === new URL(ruta.path, "http://localhost:3000").pathname;
    // Dos 200 que son correctos:
    //  - Con `loading.tsx` la respuesta ya salió con 200 cuando notFound()
    //    se ejecuta, y Next no puede cambiar el estado (docs de Next,
    //    03-file-conventions/loading.md). La pantalla 404 sí se pinta.
    //  - Sin acceso a Comunidad se muestra "en pausa" antes de buscar el post.
    const respuestaAceptable =
      (await page.getByText("No encontramos esta página").isVisible().catch(() => false)) ||
      (await page.getByText("Tu acceso a la comunidad está en pausa").isVisible().catch(() => false));
    if (ruta.inventada && sinRedireccion && respuesta?.status() !== 404 && !respuestaAceptable) {
      anotar("404", `respondió HTTP ${respuesta?.status()} en vez de 404`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const desborde = await page.evaluate(() => {
      const ancho = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth <= ancho + 1) return null;
      const culpable = Array.from(document.body.querySelectorAll<HTMLElement>("*")).find((el) => {
        const r = el.getBoundingClientRect();
        return r.right > ancho + 1 && r.width > 0 && getComputedStyle(el).position !== "fixed";
      });
      const desc = culpable
        ? `${culpable.tagName.toLowerCase()}${culpable.id ? `#${culpable.id}` : ""}.${String(culpable.className).slice(0, 80)}`
        : "desconocido";
      return `scrollWidth ${document.documentElement.scrollWidth}px > ${ancho}px; primer elemento que se sale: ${desc}`;
    });
    if (desborde) anotar("overflow", desborde);
  } catch (err) {
    anotar("timeout", (err as Error).message.split("\n")[0].slice(0, 300));
  } finally {
    await page.setViewportSize({ width: 1280, height: 720 });
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("response", onResponse);
  }

  return propios;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  await verificarCursoFixture(admin);

  for (const rol of Object.keys(emails) as Exclude<Rol, "anonimo">[]) {
    const user = await crearUsuarioConfirmado(admin, { email: emails[rol], password, nombre: `E2E Capa1 ${rol}` });
    ids[rol] = user.id;
  }
  await promoverAAdministrador(admin, ids.admin!);
  await promoverAProfesor(admin, ids.profesor!, "Pruebas E2E");

  const { data: plan, error: errPlan } = await admin.from("planes").select("id").limit(1).single();
  if (errPlan || !plan) throw new Error(`No hay plan para otorgar acceso de prueba: ${errPlan?.message}`);
  const { error: errSuscripcion } = await admin.from("suscripciones").insert({
    id_usuario: ids.conAcceso,
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

  // Se inicia sesión ANTES de suspender: lo que se prueba es una cuenta
  // suspendida a mitad de sesión, porque el login ya la rechaza de entrada.
  for (const rol of Object.keys(emails) as Exclude<Rol, "anonimo">[]) {
    sesiones[rol] = await iniciarSesion(browser, emails[rol]);
  }
  const { error: errSuspender } = await admin.from("perfiles").update({ estado: "SUSPENDIDO" }).eq("id", ids.suspendido!);
  if (errSuspender) throw new Error(`No pude suspender la cuenta de prueba: ${errSuspender.message}`);

  const { cursoSlug, leccionSlugs } = await obtenerSlugsCursoFixture(admin);
  const { data: post } = await admin
    .from("comunidad_posts")
    .select("slug")
    .eq("eliminado", false)
    .limit(1)
    .maybeSingle();
  const { data: perfil } = await admin.from("perfiles").select("slug").eq("id", ids.sinAcceso!).single();
  const { data: certificado } = await admin.from("certificados").select("codigo_verificacion").limit(1).maybeSingle();

  rutas = construirRutas({
    categoriaSlug: CURSO_FIXTURE.categoriaSlug,
    cursoSlug,
    leccionPublica: leccionSlugs[CURSO_FIXTURE.lecciones[0].id],
    leccionGateada: leccionSlugs[CURSO_FIXTURE.lecciones[1].id],
    postSlug: post?.slug ?? null,
    usuarioSlug: perfil!.slug,
    codigoCertificado: certificado?.codigo_verificacion ?? null,
  });
});

test.afterAll(async () => {
  test.setTimeout(5 * 60_000);
  for (const rol of Object.keys(emails) as Exclude<Rol, "anonimo">[]) {
    if (ids[rol]) await limpiarDatosDeUsuario(admin, ids[rol]!);
    await borrarUsuarioPorEmail(admin, emails[rol]);
  }
});

for (const rol of ROLES) {
  test(`recorre todas las páginas como ${rol}`, async ({ browser }) => {
    test.setTimeout(45 * 60_000);
    const context = await browser.newContext({ storageState: rol === "anonimo" ? undefined : sesiones[rol] });
    const page = await context.newPage();

    const propios: Hallazgo[] = [];
    for (const ruta of rutas) {
      propios.push(...(await visitar(page, rol, ruta)));
    }
    await context.close();
    hallazgos.push(...propios);
    // Se guarda al terminar cada rol y no solo al final: si el equipo se
    // queda sin memoria a mitad del recorrido, lo ya recorrido no se pierde.
    mkdirSync("test-results/capa1", { recursive: true });
    writeFileSync("test-results/capa1/hallazgos.json", JSON.stringify(hallazgos, null, 2));
  });
}

// Los recorridos por rol solo recolectan: en modo serial un test fallido
// cancela los siguientes, y lo que se quiere es el informe COMPLETO de los
// seis roles. El veredicto va aquí, al final.
test("capa 1 sin hallazgos graves", async () => {
  mkdirSync("test-results/capa1", { recursive: true });
  writeFileSync("test-results/capa1/hallazgos.json", JSON.stringify(hallazgos, null, 2));

  const graves = hallazgos.filter((h) => h.tipo !== "csp");
  const conteo = new Map<string, number>();
  for (const h of hallazgos) conteo.set(h.tipo, (conteo.get(h.tipo) ?? 0) + 1);
  console.log(`\nCapa 1 — ${hallazgos.length} hallazgos (${graves.length} graves)`);
  for (const [tipo, n] of conteo) console.log(`  ${tipo}: ${n}`);
  console.log("Detalle: test-results/capa1/hallazgos.json\n");

  expect(graves, graves.map((h) => `  [${h.rol}] [${h.tipo}] ${h.ruta} — ${h.detalle}`).join("\n")).toEqual([]);
});
