import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearCliente, servidorFalso } from "@/test/servidor-falso";

/**
 * El tope de generaciones con IA (107) se consulta y se gasta con la SESIÓN
 * del administrador, no con la llave maestra: desde
 * 132_admin_rpc_con_sesion.sql la base solo le deja tocar su propio cupo y le
 * exige el segundo factor. Si alguien vuelve a pasarlo por la llave maestra,
 * estas pruebas fallan.
 */
vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/admin/requireAdmin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/admin/bitacora", () => ({ registrarBitacora: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/examenes/generacion/trabajo", () => ({
  reclamarGeneracionExamenCurso: vi.fn(),
  completarGeneracionExamenCurso: vi.fn(),
  obtenerUltimoTrabajoGeneracion: vi.fn(),
}));
vi.mock("@/lib/examenes/generacion/transcripciones", () => ({ revisarTranscripcionesCurso: vi.fn() }));
vi.mock("@/lib/examenes/generacion/generar", () => ({ AREA_LOG: "examenes-ia" }));

const { requireAdmin } = await import("@/lib/admin/requireAdmin");
const { reclamarGeneracionExamenCurso } = await import("@/lib/examenes/generacion/trabajo");
const { generarExamenDelCurso } = await import("@/actions/admin/generacionExamen");

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CURSO = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(requireAdmin).mockResolvedValue({ supabase: crearCliente("sesion") as never, adminId: ADMIN });
  vi.mocked(reclamarGeneracionExamenCurso).mockReset();
});

describe("generarExamenDelCurso: el tope de la hora va con la sesión del administrador (132)", () => {
  it("consulta el límite con su sesión y con su propio id", async () => {
    servidorFalso.responder("rpc:verificar_limite_generar_examen", {
      data: { permitido: false, segundos_espera: 600 },
      error: null,
    });

    const resultado = await generarExamenDelCurso(CURSO, 20);

    expect(resultado.error).toMatch(/Espera 10 minutos/);
    const [llamada] = servidorFalso.llamadasA("rpc:verificar_limite_generar_examen");
    expect(llamada.cliente).toBe("sesion");
    expect(llamada.argumentos).toContainEqual({ p_usuario_id: ADMIN });
    expect(reclamarGeneracionExamenCurso).not.toHaveBeenCalled();
  });

  it("si la consulta falla, no genera (falla cerrado)", async () => {
    servidorFalso.responder("rpc:verificar_limite_generar_examen", { data: null, error: { message: "42501" } });

    expect(await generarExamenDelCurso(CURSO, 20)).toEqual({
      error: "No pudimos verificar el límite de generaciones. Intenta de nuevo.",
    });
    expect(reclamarGeneracionExamenCurso).not.toHaveBeenCalled();
  });

  it("gasta el cupo con su sesión, una vez ganado el turno", async () => {
    servidorFalso.responder("rpc:verificar_limite_generar_examen", {
      data: { permitido: true, segundos_espera: 0 },
      error: null,
    });
    servidorFalso.responder("rpc:registrar_generacion_examen", { data: null, error: null });
    vi.mocked(reclamarGeneracionExamenCurso).mockResolvedValue({ estado: "reclamado", trabajoId: "t1" });

    expect(await generarExamenDelCurso(CURSO, 20)).toEqual({ success: true, trabajoId: "t1" });
    const [llamada] = servidorFalso.llamadasA("rpc:registrar_generacion_examen");
    expect(llamada.cliente).toBe("sesion");
    expect(llamada.argumentos).toContainEqual({ p_usuario_id: ADMIN });
  });
});
