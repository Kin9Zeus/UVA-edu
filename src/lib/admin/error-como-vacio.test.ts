import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

/**
 * Panel de administración: un fallo de la base no puede verse como "0
 * usuarios", "0 cursos" o una métrica en cero. El admin tomaría decisiones
 * (suspender, despublicar, dar por muerto un curso) sobre un dato que en
 * realidad no leyó. Los loaders lanzan y `(admin)/admin/error.tsx` ofrece
 * Reintentar. Ver CLAUDE.md, sección 3.2.
 */
vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("@/lib/supabase/public", () => import("@/test/servidor-falso").then((m) => m.moduloSupabasePublic()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/resend/client", () => import("@/test/servidor-falso").then((m) => m.moduloResendCliente()));
vi.mock("@/lib/mux/client", () => import("@/test/servidor-falso").then((m) => m.moduloMuxCliente()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));

const { getMetricasPanel, getAvanceCursos, getAbandonoLecciones } = await import("@/lib/admin/metricas");
const { getPlanesAdmin } = await import("@/lib/admin/planes");
const { getCuponesAdmin } = await import("@/lib/admin/cupones");
const { getCodigosInvitacion } = await import("@/lib/admin/codigosInvitacion");
const { getLotesCodigosInvitacion } = await import("@/lib/admin/lotesCodigosInvitacion");
const { getCategorias } = await import("@/lib/admin/categorias");
const { getCursosListado } = await import("@/lib/admin/cursos");
const { getDashboardData } = await import("@/lib/admin/dashboard");
const { getUsuarios } = await import("@/lib/admin/usuarios");
const { getReportesComunidadPendientes } = await import("@/lib/admin/comunidadReportes");
const { getCursoDetalle, resolverCursoAdmin } = await import("@/lib/admin/cursoDetalle");
const { getUsuarioDetalle, resolverUsuarioAdmin } = await import("@/lib/admin/usuarioDetalle");

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };
const FALLO = { data: null, error: ERROR_PG };

beforeEach(() => {
  servidorFalso.reiniciar();
});

const loaders: Array<[string, () => Promise<unknown>, string]> = [
  ["getMetricasPanel", () => getMetricasPanel(), "from:metricas_panel_usuarios"],
  ["getAvanceCursos", () => getAvanceCursos(), "from:avance_cursos"],
  ["getAbandonoLecciones", () => getAbandonoLecciones(), "from:abandono_lecciones"],
  ["getPlanesAdmin", () => getPlanesAdmin(), "from:planes"],
  ["getCuponesAdmin", () => getCuponesAdmin(), "from:cupones"],
  ["getCodigosInvitacion", () => getCodigosInvitacion(), "from:codigos_invitacion"],
  ["getLotesCodigosInvitacion", () => getLotesCodigosInvitacion(), "from:lotes_codigos_invitacion"],
  ["getCategorias", () => getCategorias(), "from:categorias"],
  ["getCursosListado", () => getCursosListado(), "from:cursos"],
  ["getDashboardData", () => getDashboardData(), "from:cursos"],
  ["getUsuarios", () => getUsuarios(), "rpc:admin_listar_usuarios"],
  ["getReportesComunidadPendientes", () => getReportesComunidadPendientes(), "from:comunidad_reportes"],
];

describe("loaders del panel: un error de la base lanza", () => {
  it.each(loaders)("%s", async (_nombre, cargar, operacion) => {
    servidorFalso.responder(operacion, FALLO);
    await expect(cargar()).rejects.toThrow(/falló.*57014/);
  });
});

describe("detalle de curso y de usuario: 'no existe' sigue siendo null (404), un fallo lanza", () => {
  it("getCursoDetalle: curso inexistente → null, y la consulta usa maybeSingle (single daría PGRST116 → 500)", async () => {
    servidorFalso.responder("from:cursos", { data: null, error: null });

    await expect(getCursoDetalle("c1")).resolves.toBeNull();

    const metodos = servidorFalso.llamadasA("from:cursos")[0].cadena.map((c) => c.metodo);
    expect(metodos).toContain("maybeSingle");
    expect(metodos).not.toContain("single");
  });

  it("getCursoDetalle: un fallo lanza (no es 'curso no existe')", async () => {
    servidorFalso.responder("from:cursos", FALLO);
    await expect(getCursoDetalle("c1")).rejects.toThrow(/cursoDetalle:cursos falló.*57014/);
  });

  it("getUsuarioDetalle: usuario inexistente → null, y la consulta usa maybeSingle", async () => {
    servidorFalso.responder("from:perfiles", { data: null, error: null });

    await expect(getUsuarioDetalle("u1")).resolves.toBeNull();

    const metodos = servidorFalso.llamadasA("from:perfiles")[0].cadena.map((c) => c.metodo);
    expect(metodos).toContain("maybeSingle");
    expect(metodos).not.toContain("single");
  });

  it("getUsuarioDetalle: un fallo lanza", async () => {
    servidorFalso.responder("from:perfiles", FALLO);
    await expect(getUsuarioDetalle("u1")).rejects.toThrow(/usuarioDetalle:perfiles falló.*57014/);
  });

  it("resolverCursoAdmin y resolverUsuarioAdmin: un fallo lanza en vez de dar 'no existe'", async () => {
    servidorFalso.responder("from:cursos", FALLO);
    servidorFalso.responder("from:perfiles", FALLO);

    await expect(resolverCursoAdmin("revit")).rejects.toThrow(/falló.*57014/);
    await expect(resolverUsuarioAdmin("ana")).rejects.toThrow(/falló.*57014/);
  });
});
