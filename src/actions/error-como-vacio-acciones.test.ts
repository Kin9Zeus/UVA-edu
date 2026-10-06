import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearCliente, servidorFalso } from "@/test/servidor-falso";

/**
 * Cuarto bloque de "error mostrado como vacío": acciones que LEEN antes de
 * decidir o de hacer algo irreversible. Un fallo de esa lectura no puede
 * contar como "no existe" / "no hay nada": o se aborta antes de tocar nada, o
 * se avisa con un mensaje que no afirme algo falso.
 *
 * Los tests importantes de este archivo son los de "no hizo nada irreversible":
 * borrar una lección sin leer su asset de Mux deja el video huérfano, y
 * anonimizar sin listar los adjuntos deja archivos de la persona en Storage.
 */
vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("@/lib/resend/client", () => import("@/test/servidor-falso").then((m) => m.moduloResendCliente()));
vi.mock("@/lib/mux/client", () => import("@/test/servidor-falso").then((m) => m.moduloMuxCliente()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("next/headers", () => import("@/test/servidor-falso").then((m) => m.moduloNextHeaders()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/admin/requireAdmin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/admin/bitacora", () => ({ registrarBitacora: vi.fn() }));
vi.mock("@/lib/supabase/guardia-sesion", () => ({ olvidarGuardiaSesion: vi.fn() }));
vi.mock("@/lib/comunidad-adjuntos", () => ({ borrarAdjuntoComunidad: vi.fn() }));
vi.mock("@/lib/perfil", () => ({
  getPerfilActual: async () => ({ user: { id: "u1" }, perfil: { nombre: "Ana", rol: "ESTUDIANTE" } }),
  getUsuarioActual: async () => ({ id: "u1", email: "ana@uva.co" }),
}));

const { requireAdmin } = await import("@/lib/admin/requireAdmin");
const { registrarBitacora } = await import("@/lib/admin/bitacora");
const { logError } = await import("@/lib/log");
const { eliminarLeccion, eliminarRecursoLeccion, moverModulo, crearModulo } = await import("@/actions/admin/cursos");
const { anonimizarUsuario } = await import("@/actions/admin/usuarios");
const { eliminarFotoPerfil } = await import("@/actions/perfil/foto");
const { obtenerUrlRecurso } = await import("@/actions/cursos/recurso");
const { validarCodigoCupon } = await import("@/actions/cupones/validar");
const { congelarPreguntas } = await import("@/lib/examenes/congelar");
const { puedeGenerarExamenCurso } = await import("@/lib/examenes/generacion/trabajo");

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USUARIO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CURSO = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MODULO = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const LECCION = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const RECURSO = "99999999-9999-4999-8999-999999999999";
const PLAN = "88888888-8888-4888-8888-888888888888";

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };
const FALLO = { data: null, error: ERROR_PG };

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(requireAdmin).mockResolvedValue({ supabase: crearCliente("sesion") as never, adminId: ADMIN });
  vi.mocked(registrarBitacora).mockReset();
  vi.mocked(logError).mockClear();
});

describe("Admin: si falla la lectura previa, NO se hace nada irreversible", () => {
  it("eliminarLeccion: no borra la lección (su video quedaría huérfano en Mux) y no escribe bitácora", async () => {
    servidorFalso.responder("from:lecciones", FALLO);

    expect(await eliminarLeccion(LECCION, CURSO)).toEqual({
      error: "No pudimos eliminar la lección. Intenta de nuevo.",
    });
    const borrados = servidorFalso
      .llamadasA("from:lecciones")
      .filter((l) => l.cadena.some((c) => c.metodo === "delete"));
    expect(borrados).toHaveLength(0);
    expect(servidorFalso.llamadasA("from:mux_assets_pendientes_eliminacion")).toHaveLength(0);
    expect(registrarBitacora).not.toHaveBeenCalled();
  });

  it("eliminarRecursoLeccion: no borra la fila (el archivo quedaría huérfano en Storage)", async () => {
    servidorFalso.responder("from:recursos_descargables", FALLO);

    expect(await eliminarRecursoLeccion(RECURSO)).toEqual({ error: "No pudimos eliminar el material." });
    const borrados = servidorFalso
      .llamadasA("from:recursos_descargables")
      .filter((l) => l.cadena.some((c) => c.metodo === "delete"));
    expect(borrados).toHaveLength(0);
  });

  // Los vecinos con órdenes ADYACENTES (1 y 2) no dejan espacio en medio, así que
  // ordenEntre devuelve null y la acción tiene que leer el resto para reespaciar.
  const VECINO_A = "11111111-1111-4111-8111-111111111111";
  const VECINO_B = "22222222-2222-4222-8222-222222222222";
  const vecinosSinEspacio = {
    data: [
      { id: VECINO_A, orden: 1 },
      { id: VECINO_B, orden: 2 },
    ],
    error: null,
  };
  const esLecturaDelResto = (l: { cadena: Array<{ metodo: string }> }) => l.cadena.some((c) => c.metodo === "neq");

  it("moverModulo: si falla la lectura del resto NO reespacia (dejaría solo este módulo ordenado)", async () => {
    servidorFalso.responderSegun("from:modulos", (l) => (esLecturaDelResto(l) ? FALLO : vecinosSinEspacio));

    expect(await moverModulo(CURSO, MODULO, VECINO_A, VECINO_B)).toEqual({
      error: "No pudimos guardar el nuevo orden de los módulos.",
    });
    expect(servidorFalso.llamadasA("rpc:reespaciar_orden_modulos")).toHaveLength(0);
  });

  it("moverModulo: control, con el resto leído sí reespacia (la prueba anterior ejerce esa ruta)", async () => {
    servidorFalso.responderSegun("from:modulos", (l) =>
      esLecturaDelResto(l) ? { data: [{ id: VECINO_A }, { id: VECINO_B }], error: null } : vecinosSinEspacio,
    );
    servidorFalso.responder("rpc:reespaciar_orden_modulos", { data: null, error: null });

    expect(await moverModulo(CURSO, MODULO, VECINO_A, VECINO_B)).toEqual({ success: true });
    expect(servidorFalso.llamadasA("rpc:reespaciar_orden_modulos")).toHaveLength(1);
  });

  it("moverModulo: si fallan los vecinos tampoco calcula un orden a ciegas", async () => {
    servidorFalso.responder("from:modulos", FALLO);

    expect(await moverModulo(CURSO, MODULO, VECINO_A, VECINO_B)).toEqual({
      error: "No pudimos guardar el nuevo orden de los módulos.",
    });
    const updates = servidorFalso.llamadasA("from:modulos").filter((l) => l.cadena.some((c) => c.metodo === "update"));
    expect(updates).toHaveLength(0);
  });

  it("crearModulo: si falla leer el último orden no inserta (quedaría el 1.º en vez del último)", async () => {
    servidorFalso.responder("from:modulos", FALLO);

    expect(await crearModulo(CURSO, "Módulo nuevo")).toEqual({ error: "No pudimos crear el módulo." });
    const inserts = servidorFalso
      .llamadasA("from:modulos")
      .filter((l) => l.cadena.some((c) => c.metodo === "insert"));
    expect(inserts).toHaveLength(0);
  });

  it("anonimizarUsuario: si no puede listar los adjuntos NO suprime (dejaría sus archivos huérfanos)", async () => {
    servidorFalso.responder("from:comunidad_adjuntos", FALLO);

    expect(await anonimizarUsuario(USUARIO)).toEqual({ error: "No pudimos suprimir los datos de esta cuenta." });
    expect(servidorFalso.llamadasA("rpc:anonimizar_usuario")).toHaveLength(0);
    expect(servidorFalso.llamadasA("auth.admin:signOut")).toHaveLength(0);
    expect(registrarBitacora).not.toHaveBeenCalled();
  });

  it("anonimizarUsuario: si no puede leer la foto NO suprime", async () => {
    servidorFalso.responder("from:comunidad_adjuntos", { data: [], error: null });
    servidorFalso.responder("from:perfiles", FALLO);

    expect(await anonimizarUsuario(USUARIO)).toEqual({ error: "No pudimos suprimir los datos de esta cuenta." });
    expect(servidorFalso.llamadasA("rpc:anonimizar_usuario")).toHaveLength(0);
  });
});

describe("Estudiante: un fallo no se dice como 'no existe' ni como 'quitaste'", () => {
  it("eliminarFotoPerfil: si falla leerla NO dice que se quitó (success) ni toca nada", async () => {
    servidorFalso.conUsuario({ id: "u1", email: "ana@uva.co" });
    servidorFalso.responder("from:perfiles", FALLO);

    expect(await eliminarFotoPerfil()).toEqual({ error: "No pudimos quitar la foto." });
    expect(servidorFalso.llamadas.some((l) => l.operacion.startsWith("storage:"))).toBe(false);
  });

  it("eliminarFotoPerfil: sin foto (y sin error) sigue siendo success", async () => {
    servidorFalso.conUsuario({ id: "u1", email: "ana@uva.co" });
    servidorFalso.responder("from:perfiles", { data: { foto_url: null }, error: null });

    expect(await eliminarFotoPerfil()).toEqual({ success: true });
  });

  it("obtenerUrlRecurso: un fallo no dice 'no tienes acceso a este material'", async () => {
    servidorFalso.conUsuario({ id: "u1", email: "ana@uva.co" });
    servidorFalso.responder("from:recursos_descargables", FALLO);

    expect(await obtenerUrlRecurso(RECURSO)).toEqual({ error: "No pudimos abrir el material. Intenta de nuevo." });
  });

  it("validarCodigoCupon: un fallo no dice 'ese plan ya no está disponible'", async () => {
    servidorFalso.conUsuario({ id: "u1", email: "ana@uva.co" });
    servidorFalso.responder("from:planes", FALLO);

    expect(await validarCodigoCupon(PLAN, "VERANO")).toEqual({
      ok: false,
      error: "No pudimos validar el cupón. Intenta de nuevo.",
    });
  });
});

describe("Exámenes: un fallo no puede crear un intento vacío ni saltarse la guarda de 'ya generado'", () => {
  it("congelarPreguntas: si falla la lectura lanza (antes devolvía [] → 'El examen todavía no tiene preguntas')", async () => {
    servidorFalso.responder("from:preguntas_examen", FALLO);

    await expect(congelarPreguntas("e1", false, false)).rejects.toThrow(/congelar:preguntas del examen falló.*57014/);
  });

  it("congelarPreguntas: sin error y sin preguntas devuelve [] (eso sí es 'no tiene preguntas')", async () => {
    servidorFalso.responder("from:preguntas_examen", { data: [], error: null });

    await expect(congelarPreguntas("e1", false, false)).resolves.toEqual([]);
  });

  it("puedeGenerarExamenCurso: si falla leer el examen LANZA, no responde 'procede' (regeneraría uno ya validado)", async () => {
    servidorFalso.responder("from:examenes", FALLO);

    await expect(puedeGenerarExamenCurso("c1", "CRON" as never)).rejects.toThrow(/trabajo:examen del curso falló/);
  });

  it("puedeGenerarExamenCurso: lo manual no consulta nada y procede", async () => {
    await expect(puedeGenerarExamenCurso("c1", "ADMIN_MANUAL")).resolves.toEqual({ procede: true });
    expect(servidorFalso.llamadas).toHaveLength(0);
  });
});
