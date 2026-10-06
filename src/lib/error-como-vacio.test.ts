import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

/**
 * Un fallo de la base de datos no puede mostrarse como un estado vacío.
 *
 * Antes, certificados, notas, progreso, perfil y suscripción ignoraban el
 * `error` de la consulta y caían a `[]` / `null`: el estudiante leía "Todavía
 * no tienes certificados" y creía haber perdido su trabajo. Ahora lanzan, y
 * `error.tsx` ofrece Reintentar. Lo que se degrada a propósito (el chrome del
 * dashboard y la miniatura de reanudar) se registra en vez de callarse.
 */
vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/resend/client", () => import("@/test/servidor-falso").then((m) => m.moduloResendCliente()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("@/lib/perfil", () => ({
  getPerfilActual: async () => ({ user: { id: "u1" }, perfil: { rol: "ESTUDIANTE" } }),
}));
vi.mock("@/lib/notificaciones", () => ({
  getNotificaciones: async () => [],
  contarNotificacionesNoLeidas: async () => 0,
}));

const { logError } = await import("@/lib/log");
const { getMisNotas } = await import("@/lib/notas");
const { getSuscripcionActual } = await import("@/lib/suscripcion");
const { getProgresoData } = await import("@/lib/progreso");
const { getDashboardChromeData } = await import("@/lib/dashboard-chrome");
const { default: CertificadosPage } = await import("@/app/(student)/dashboard/certificados/page");
const { default: PerfilPage } = await import("@/app/(student)/dashboard/perfil/page");

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };
const FALLO = { data: null, error: ERROR_PG };

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(logError).mockClear();
});

describe("un error de la base lanza en vez de mostrarse como vacío", () => {
  it("Notas: getMisNotas", async () => {
    servidorFalso.responder("from:notas_leccion", FALLO);
    await expect(getMisNotas("u1")).rejects.toThrow(/notas:mis-notas falló.*57014/);
  });

  it("Suscripción: getSuscripcionActual", async () => {
    servidorFalso.responder("from:suscripciones", FALLO);
    await expect(getSuscripcionActual("u1")).rejects.toThrow(/suscripcion:actual falló.*57014/);
  });

  it("Suscripción: sin fila y sin error sigue siendo null (sin suscripción)", async () => {
    servidorFalso.responder("from:suscripciones", { data: null, error: null });
    await expect(getSuscripcionActual("u1")).resolves.toBeNull();
  });

  it("Progreso: getProgresoData", async () => {
    servidorFalso.responder("from:progreso_cursos_estudiante", FALLO);
    await expect(getProgresoData()).rejects.toThrow(/progreso:cursos falló.*57014/);
  });

  it("Progreso: sin cursos y sin error devuelve la lista vacía", async () => {
    servidorFalso.responder("from:progreso_cursos_estudiante", { data: [], error: null });
    await expect(getProgresoData()).resolves.toEqual({ cursos: [] });
  });

  it("Certificados: la página", async () => {
    servidorFalso.responder("from:certificados", FALLO);
    await expect(CertificadosPage()).rejects.toThrow(/certificados:lista falló.*57014/);
  });

  it("Perfil: falla la consulta de certificados", async () => {
    servidorFalso.responder("from:certificados", FALLO);
    servidorFalso.responder("from:suscripciones", { data: null, error: null });
    servidorFalso.responder("auth:getUser", { data: { user: { identities: [] } }, error: null });
    await expect(PerfilPage()).rejects.toThrow(/perfil:certificados falló/);
  });

  it("Perfil: falla auth.getUser (no puede decidir 'sin contraseña')", async () => {
    servidorFalso.responder("from:certificados", { data: [], error: null });
    servidorFalso.responder("from:suscripciones", { data: null, error: null });
    servidorFalso.responder("auth:getUser", { data: { user: null }, error: ERROR_PG });
    await expect(PerfilPage()).rejects.toThrow(/perfil:auth-getUser falló/);
  });

  it("Perfil: falla la suscripción", async () => {
    servidorFalso.responder("from:certificados", { data: [], error: null });
    servidorFalso.responder("from:suscripciones", FALLO);
    servidorFalso.responder("auth:getUser", { data: { user: { identities: [] } }, error: null });
    await expect(PerfilPage()).rejects.toThrow(/suscripcion:actual falló/);
  });
});

describe("lo que se degrada a propósito se registra", () => {
  it("el chrome del dashboard no se cae si falla la suscripción ni el contador de certificados", async () => {
    servidorFalso.responder("from:suscripciones", FALLO);
    servidorFalso.responder("from:certificados", { data: null, error: ERROR_PG, count: null });

    const chrome = await getDashboardChromeData({
      user: { id: "u1", email: "a@b.co" } as never,
      perfil: { nombre: "Ana", foto_url: null, rol: "ESTUDIANTE" } as never,
    });

    expect(chrome.certificadosCount).toBe(0);
    expect(chrome.diasGracia).toBeNull();
    expect(logError).toHaveBeenCalledTimes(2);
  });

  it("la miniatura de reanudar cae a la portada y deja registro", async () => {
    servidorFalso.responder("from:progreso_cursos_estudiante", {
      data: [
        {
          curso_id: "c1",
          curso_slug: "revit",
          titulo: "Revit",
          imagen_portada: "/p.jpg",
          lecciones_completadas: 1,
          lecciones_total: 4,
          examen_requerido: false,
          examen_aprobado: false,
        },
      ],
      error: null,
    });
    servidorFalso.responder("from:progreso", FALLO);

    const { cursos } = await getProgresoData();

    expect(cursos).toHaveLength(1);
    expect(cursos[0].reanudarEn).toBeNull();
    expect(logError).toHaveBeenCalledWith(
      "progreso:reanudacion",
      expect.any(String),
      ERROR_PG,
      expect.anything(),
    );
  });
});
