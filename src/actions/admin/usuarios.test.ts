import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearCliente, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/admin/requireAdmin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/admin/bitacora", () => ({ registrarBitacora: vi.fn() }));
vi.mock("@/lib/supabase/guardia-sesion", () => ({ olvidarGuardiaSesion: vi.fn() }));
vi.mock("@/lib/comunidad-adjuntos", () => ({ borrarAdjuntoComunidad: vi.fn() }));
vi.mock("@/lib/examenes/congelar", () => ({ congelarPreguntas: vi.fn() }));

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { olvidarGuardiaSesion } from "@/lib/supabase/guardia-sesion";
import { borrarAdjuntoComunidad } from "@/lib/comunidad-adjuntos";
import { congelarPreguntas } from "@/lib/examenes/congelar";
import { anonimizarUsuario, quitarCortesia, suspenderActivarUsuario } from "@/actions/admin/usuarios";
import { otorgarIntentoExtra } from "@/actions/admin/examenes";

/**
 * Acciones de administrador con efecto fuerte sobre una cuenta ajena —
 * P2-6 Fase 2 (AUDIT-2026-09-22.md). El guard de rol ya lo cubre
 * autorizacion.test.ts para TODAS; acá, qué hace cada una ya autorizada:
 * el orden de lo irreversible, la bitácora y el corte de sesión.
 */

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USUARIO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EXAMEN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CURSO = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const FOTO = "https://proyecto.supabase.co/storage/v1/object/public/avatares/usuario/foto.webp";

const bitacora = vi.mocked(registrarBitacora);

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(requireAdmin).mockResolvedValue({ supabase: crearCliente("sesion") as never, adminId: ADMIN });
  bitacora.mockReset();
  vi.mocked(olvidarGuardiaSesion).mockReset();
  vi.mocked(borrarAdjuntoComunidad).mockReset();
  vi.mocked(congelarPreguntas).mockReset();
});

describe("anonimizarUsuario (Habeas Data, irreversible)", () => {
  beforeEach(() => {
    servidorFalso.responder("from:comunidad_adjuntos", {
      data: [
        { id: "adj-1", ruta_storage: "u/a.png" },
        { id: "adj-2", ruta_storage: "u/b.pdf" },
      ],
    });
    servidorFalso.responder("from:perfiles", { data: { foto_url: FOTO } });
  });

  it("un admin no puede anonimizarse a sí mismo: no toca nada", async () => {
    expect(await anonimizarUsuario(ADMIN)).toEqual({ error: "No puedes anonimizar tu propia cuenta." });
    expect(servidorFalso.llamadas).toHaveLength(0);
    expect(bitacora).not.toHaveBeenCalled();
  });

  it("borra archivos → suprime con la SESIÓN del admin → corta sesiones → bitácora, en ese orden", async () => {
    expect(await anonimizarUsuario(USUARIO)).toEqual({ success: true });

    expect(vi.mocked(borrarAdjuntoComunidad).mock.calls.map(([, id, ruta]) => [id, ruta])).toEqual([
      ["adj-1", "u/a.png"],
      ["adj-2", "u/b.pdf"],
    ]);
    expect(servidorFalso.encadenado("storage:avatares", "remove")).toEqual([[["usuario/foto.webp"]]]);

    const orden = servidorFalso.operaciones();
    expect(orden.indexOf("storage:avatares")).toBeLessThan(orden.indexOf("rpc:anonimizar_usuario"));
    // La RPC con el cliente de SESIÓN: así la base vuelve a comprobar el rol
    // y el "no a ti mismo" por auth.uid(). Con Service Role no lo haría.
    const [rpc] = servidorFalso.llamadasA("rpc:anonimizar_usuario");
    expect(rpc.cliente).toBe("sesion");
    expect(rpc.argumentos[0]).toEqual({ p_id_usuario: USUARIO });

    const [signOut] = servidorFalso.llamadasA("auth.admin:signOut");
    expect(signOut.argumentos).toEqual([USUARIO, "global"]);
    expect(orden.indexOf("rpc:anonimizar_usuario")).toBeLessThan(orden.indexOf("auth.admin:signOut"));
    expect(olvidarGuardiaSesion).toHaveBeenCalledWith(USUARIO);
    expect(bitacora).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ idEntidadAfectada: USUARIO }));
  });

  it("si la supresión falla: error, sin cortar sesiones ni escribir en la bitácora", async () => {
    servidorFalso.responder("rpc:anonimizar_usuario", { error: { code: "57014", message: "timeout" } });

    expect(await anonimizarUsuario(USUARIO)).toEqual({ error: "No pudimos suprimir los datos de esta cuenta." });
    expect(servidorFalso.llamadasA("auth.admin:signOut")).toHaveLength(0);
    expect(bitacora).not.toHaveBeenCalled();
  });

  it("si el corte de sesión falla, la supresión ya hecha se reporta como éxito (y queda en bitácora)", async () => {
    servidorFalso.responder("auth.admin:signOut", { error: { message: "auth caído" } });

    expect(await anonimizarUsuario(USUARIO)).toEqual({ success: true });
    expect(bitacora).toHaveBeenCalledTimes(1);
  });
});

describe("suspenderActivarUsuario", () => {
  it("suspender: cambia el estado, corta TODAS las sesiones, olvida la caché del proxy y deja bitácora", async () => {
    expect(await suspenderActivarUsuario(USUARIO, "SUSPENDIDO")).toEqual({ success: true });

    expect(servidorFalso.encadenado("from:perfiles", "update")).toEqual([[{ estado: "SUSPENDIDO" }]]);
    expect(servidorFalso.encadenado("from:perfiles", "eq")).toEqual([["id", USUARIO]]);
    expect(servidorFalso.llamadasA("auth.admin:signOut")[0].argumentos).toEqual([USUARIO, "global"]);
    expect(olvidarGuardiaSesion).toHaveBeenCalledWith(USUARIO);
    expect(bitacora).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ accion: "Suspendió una cuenta" }));
  });

  it("reactivar no corta sesiones pero sí olvida la caché (si no, seguiría bloqueado 30 s)", async () => {
    await suspenderActivarUsuario(USUARIO, "ACTIVO");

    expect(servidorFalso.llamadasA("auth.admin:signOut")).toHaveLength(0);
    expect(olvidarGuardiaSesion).toHaveBeenCalledWith(USUARIO);
  });

  it("si el UPDATE falla no hay corte de sesión ni bitácora", async () => {
    servidorFalso.responder("from:perfiles", { error: { message: "rls" } });

    expect(await suspenderActivarUsuario(USUARIO, "SUSPENDIDO")).toEqual({
      error: "No pudimos actualizar el estado del usuario.",
    });
    expect(servidorFalso.llamadasA("auth.admin:signOut")).toHaveLength(0);
    expect(bitacora).not.toHaveBeenCalled();
  });
});

describe("quitarCortesia", () => {
  it("revoca sin borrar, solo si la inscripción es de ESE usuario y es cortesía", async () => {
    servidorFalso.responder("from:inscripciones", { count: 1 });

    expect(await quitarCortesia("insc-1", USUARIO, "  terminó el convenio ")).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:inscripciones", "update")[0][0]).toMatchObject({
      activo: false,
      motivo_revocacion: "terminó el convenio",
      revocado_por: ADMIN,
    });
    expect(servidorFalso.encadenado("from:inscripciones", "eq")).toEqual([
      ["id", "insc-1"],
      ["id_usuario", USUARIO],
      ["tipo_acceso", "CORTESIA"],
    ]);
    expect(bitacora).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idEntidadAfectada: USUARIO, detalles: "terminó el convenio" }),
    );
  });

  it("0 filas (de otro usuario, no es cortesía o no existe): error y sin bitácora", async () => {
    servidorFalso.responder("from:inscripciones", { count: 0 });

    expect(await quitarCortesia("insc-1", USUARIO, "motivo")).toEqual({
      error: "No encontramos esa cortesía para este usuario.",
    });
    expect(bitacora).not.toHaveBeenCalled();
  });

  it("sin motivo no escribe", async () => {
    expect(await quitarCortesia("insc-1", USUARIO, "   ")).toEqual({ error: "Escribe el motivo de la revocación." });
    expect(servidorFalso.llamadas).toHaveLength(0);
  });
});

describe("otorgarIntentoExtra", () => {
  beforeEach(() => {
    servidorFalso.responder("from:examenes", {
      data: { nota_aprobatoria: 80, minutos_limite: null, aleatorizar_preguntas: false, aleatorizar_opciones: false },
    });
    servidorFalso.responder("from:intentos_examen", { data: [{ estado: "REPROBADO" }] });
    vi.mocked(congelarPreguntas).mockResolvedValue([{ id: "p1" }, { id: "p2" }] as never);
  });

  it("crea el intento con Service Role para ESE estudiante, con la cola inicial, y lo deja en bitácora", async () => {
    expect(await otorgarIntentoExtra(EXAMEN, CURSO, USUARIO)).toEqual({ success: true });

    const insercion = servidorFalso.llamadasA("from:intentos_examen").find((l) =>
      l.cadena.some((c) => c.metodo === "insert"),
    )!;
    expect(insercion.cliente).toBe("admin");
    expect(insercion.cadena.find((c) => c.metodo === "insert")!.argumentos[0]).toMatchObject({
      id_examen: EXAMEN,
      id_usuario: USUARIO,
      respuestas: { resueltas: {}, fallos: 0, cola: ["p1", "p2"] },
      expira_en: null,
    });
    expect(bitacora).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["ya aprobó", [{ estado: "REPROBADO" }, { estado: "APROBADO" }], "Este estudiante ya aprobó el examen."],
    ["tiene uno en curso", [{ estado: "EN_CURSO" }], "Este estudiante ya tiene un intento en curso."],
  ])("si %s, no crea nada", async (_caso, previos, mensaje) => {
    servidorFalso.responder("from:intentos_examen", { data: previos });

    expect(await otorgarIntentoExtra(EXAMEN, CURSO, USUARIO)).toEqual({ error: mensaje });
    expect(servidorFalso.encadenado("from:intentos_examen", "insert")).toEqual([]);
  });

  it("si no puede leer los intentos previos, NO crea el intento (falla cerrado)", async () => {
    servidorFalso.responder("from:intentos_examen", { data: null, error: { message: "timeout" } });

    expect((await otorgarIntentoExtra(EXAMEN, CURSO, USUARIO)).error).toMatch(/No pudimos comprobar/);
    expect(servidorFalso.encadenado("from:intentos_examen", "insert")).toEqual([]);
    expect(congelarPreguntas).not.toHaveBeenCalled();
  });

  it("ids inválidos no llegan a la base", async () => {
    expect(await otorgarIntentoExtra("x", CURSO, USUARIO)).toEqual({ error: "Examen inválido." });
    expect(await otorgarIntentoExtra(EXAMEN, CURSO, "x")).toEqual({ error: "Estudiante inválido." });
    expect(servidorFalso.llamadas).toHaveLength(0);
  });
});
