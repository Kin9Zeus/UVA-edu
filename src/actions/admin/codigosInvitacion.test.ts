import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearCliente, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/admin/requireAdmin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/admin/bitacora", () => ({ registrarBitacora: vi.fn() }));
vi.mock("@/lib/admin/codigos-uso", () => ({ clasesPorUsuario: vi.fn() }));

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { clasesPorUsuario } from "@/lib/admin/codigos-uso";
import {
  actualizarCodigoInvitacion,
  crearCodigoInvitacion,
  eliminarCodigoInvitacion,
  obtenerCanjes,
  toggleActivoCodigoInvitacion,
} from "@/actions/admin/codigosInvitacion";

/**
 * Códigos de invitación: la única puerta de entrada del MVP (P2-12,
 * AUDIT-2026-11-23). El guard de rol lo cubre autorizacion.test.ts; acá, qué
 * hace cada acción ya autorizada.
 */

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CODIGO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FUTURO = "2099-01-01T00:00:00.000Z";
const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };
const DUPLICADO = { message: "duplicate key value", code: "23505" };

const bitacora = vi.mocked(registrarBitacora);

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(requireAdmin).mockResolvedValue({ supabase: crearCliente("sesion") as never, adminId: ADMIN });
  bitacora.mockReset();
  vi.mocked(clasesPorUsuario).mockReset();
});

describe("crearCodigoInvitacion", () => {
  const entrada = { duracionDias: 30, fechaVencimiento: FUTURO, limiteUsos: 1 };

  it("crea el código activo, con el admin creador, y lo anota en la bitácora", async () => {
    const resultado = await crearCodigoInvitacion(entrada);

    expect(resultado).toMatchObject({ success: true, codigo: expect.any(String) });
    const [fila] = servidorFalso.encadenado("from:codigos_invitacion", "insert")[0] as [Record<string, unknown>];
    expect(fila).toMatchObject({
      codigo: resultado.codigo,
      duracion_dias: 30,
      id_admin_creador: ADMIN,
      fecha_vencimiento: FUTURO,
      limite_usos: 1,
      activo: true,
    });
    expect(bitacora).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ accion: "Creó un código de invitación" }));
  });

  it("si el código sale repetido, genera otro y reintenta", async () => {
    servidorFalso.responderEnOrden("from:codigos_invitacion", [{ error: DUPLICADO }, { error: null }]);

    expect(await crearCodigoInvitacion(entrada)).toMatchObject({ success: true });
    expect(servidorFalso.llamadasA("from:codigos_invitacion")).toHaveLength(2);
  });

  it("se rinde tras 5 choques seguidos, sin bitácora", async () => {
    servidorFalso.responder("from:codigos_invitacion", { error: DUPLICADO });

    expect(await crearCodigoInvitacion(entrada)).toEqual({ error: "No pudimos generar un código libre. Intenta de nuevo." });
    expect(servidorFalso.llamadasA("from:codigos_invitacion")).toHaveLength(5);
    expect(bitacora).not.toHaveBeenCalled();
  });

  it("otro fallo de la base no se reintenta", async () => {
    servidorFalso.responder("from:codigos_invitacion", { error: ERROR_PG });

    expect(await crearCodigoInvitacion(entrada)).toEqual({ error: "No pudimos crear el código." });
    expect(servidorFalso.llamadasA("from:codigos_invitacion")).toHaveLength(1);
  });

  it.each([
    ["días en 0", { ...entrada, duracionDias: 0 }],
    ["fecha pasada", { ...entrada, fechaVencimiento: "2000-01-01T00:00:00.000Z" }],
    ["sin límite de usos", { ...entrada, limiteUsos: 0 }],
    ["límite con decimales", { ...entrada, limiteUsos: 1.5 }],
  ])("rechaza %s sin tocar la base", async (_caso, invalida) => {
    expect(await crearCodigoInvitacion(invalida)).toHaveProperty("error");
    expect(servidorFalso.llamadas).toHaveLength(0);
  });
});

describe("actualizarCodigoInvitacion", () => {
  const entrada = { fechaVencimiento: FUTURO, limiteUsos: 5 };

  it("cambia fecha y límite, y anota el código en la bitácora", async () => {
    servidorFalso.responderEnOrden("from:codigos_invitacion", [
      { data: { codigo: "ABCD2345", veces_usado: 2 } },
      { error: null },
    ]);

    expect(await actualizarCodigoInvitacion(CODIGO, entrada)).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:codigos_invitacion", "update")).toEqual([
      [{ fecha_vencimiento: FUTURO, limite_usos: 5 }],
    ]);
    expect(bitacora).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ detalles: "ABCD2345" }));
  });

  it("no deja bajar el límite por debajo de los canjes ya hechos", async () => {
    servidorFalso.responder("from:codigos_invitacion", { data: { codigo: "ABCD2345", veces_usado: 7 } });

    const resultado = await actualizarCodigoInvitacion(CODIGO, entrada);

    expect(resultado.error).toMatch(/ya se canjeó 7/);
    expect(servidorFalso.encadenado("from:codigos_invitacion", "update")).toEqual([]);
  });

  it("un fallo al leerlo no se confunde con «ya no existe»", async () => {
    servidorFalso.responder("from:codigos_invitacion", { data: null, error: ERROR_PG });

    expect(await actualizarCodigoInvitacion(CODIGO, entrada)).toEqual({
      error: "No pudimos comprobar el código. Intenta de nuevo.",
    });
  });

  it("si ya no existe, lo dice y no actualiza", async () => {
    servidorFalso.responder("from:codigos_invitacion", { data: null });

    expect(await actualizarCodigoInvitacion(CODIGO, entrada)).toEqual({ error: "Ese código ya no existe." });
    expect(servidorFalso.encadenado("from:codigos_invitacion", "update")).toEqual([]);
  });

  it("si el update falla, no hay bitácora", async () => {
    servidorFalso.responderEnOrden("from:codigos_invitacion", [
      { data: { codigo: "ABCD2345", veces_usado: 0 } },
      { error: ERROR_PG },
    ]);

    expect(await actualizarCodigoInvitacion(CODIGO, entrada)).toEqual({ error: "No pudimos actualizar el código." });
    expect(bitacora).not.toHaveBeenCalled();
  });
});

describe("toggleActivoCodigoInvitacion", () => {
  it("desactiva y lo anota como desactivación", async () => {
    servidorFalso.responder("from:codigos_invitacion", { data: { codigo: "ABCD2345" } });

    expect(await toggleActivoCodigoInvitacion(CODIGO, false)).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:codigos_invitacion", "update")).toEqual([[{ activo: false }]]);
    expect(bitacora).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accion: "Desactivó un código de invitación", detalles: "ABCD2345" }),
    );
  });

  it("si el código ya no existe (cero filas), no es un éxito ni va a la bitácora", async () => {
    servidorFalso.responder("from:codigos_invitacion", { data: null });

    expect(await toggleActivoCodigoInvitacion(CODIGO, true)).toEqual({ error: "Ese código ya no existe." });
    expect(bitacora).not.toHaveBeenCalled();
  });

  it("un fallo de la base devuelve error", async () => {
    servidorFalso.responder("from:codigos_invitacion", { data: null, error: ERROR_PG });

    expect(await toggleActivoCodigoInvitacion(CODIGO, true)).toEqual({ error: "No pudimos actualizar el código." });
  });
});

describe("eliminarCodigoInvitacion", () => {
  it("borra un código sin canjes y lo anota", async () => {
    servidorFalso.responderEnOrden("from:codigos_invitacion", [
      { data: { codigo: "ABCD2345", veces_usado: 0 } },
      { error: null },
    ]);

    expect(await eliminarCodigoInvitacion(CODIGO)).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:codigos_invitacion", "delete")).toHaveLength(1);
    expect(bitacora).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ detalles: "ABCD2345" }));
  });

  it("no borra un código ya canjeado: las suscripciones perderían su origen", async () => {
    servidorFalso.responder("from:codigos_invitacion", { data: { codigo: "ABCD2345", veces_usado: 1 } });

    expect((await eliminarCodigoInvitacion(CODIGO)).error).toMatch(/Desactívalo/);
    expect(servidorFalso.encadenado("from:codigos_invitacion", "delete")).toEqual([]);
  });

  it("un fallo al leerlo no se confunde con «ya no existe» y no borra", async () => {
    servidorFalso.responder("from:codigos_invitacion", { data: null, error: ERROR_PG });

    expect(await eliminarCodigoInvitacion(CODIGO)).toEqual({ error: "No pudimos comprobar el código. Intenta de nuevo." });
    expect(servidorFalso.encadenado("from:codigos_invitacion", "delete")).toEqual([]);
  });
});

describe("obtenerCanjes", () => {
  it("sin códigos no consulta nada", async () => {
    expect(await obtenerCanjes([])).toEqual({ success: true, canjes: [] });
    expect(servidorFalso.llamadas).toHaveLength(0);
  });

  it("une cada canje con su perfil y sus clases; un perfil borrado sale como «Usuario eliminado»", async () => {
    servidorFalso.responder("from:suscripciones", {
      data: [
        { id_codigo_invitacion: CODIGO, id_usuario: "u1", fecha_inicio: "2026-11-01", usuario: { nombre: "Ana", correo: "ana@x.co", slug: "ana" } },
        { id_codigo_invitacion: CODIGO, id_usuario: "u2", fecha_inicio: "2026-10-01", usuario: null },
      ],
    });
    vi.mocked(clasesPorUsuario).mockResolvedValue({ clases: new Map([["u1", 3]]), error: null } as never);

    const { canjes } = await obtenerCanjes([CODIGO]);

    expect(canjes).toEqual([
      { idCodigo: CODIGO, usuarioId: "u1", nombre: "Ana", correo: "ana@x.co", slug: "ana", canjeadoEn: "2026-11-01", clases: 3 },
      { idCodigo: CODIGO, usuarioId: "u2", nombre: "Usuario eliminado", correo: "", slug: null, canjeadoEn: "2026-10-01", clases: 0 },
    ]);
  });

  it("un lote grande se consulta en tandas de 150 (el .in() va en la URL)", async () => {
    servidorFalso.responder("from:suscripciones", { data: [] });
    vi.mocked(clasesPorUsuario).mockResolvedValue({ clases: new Map(), error: null } as never);

    await obtenerCanjes(Array.from({ length: 320 }, (_, i) => `codigo-${i}`));

    expect(servidorFalso.llamadasA("from:suscripciones")).toHaveLength(3);
  });

  it("si fallan los canjes o las clases, devuelve error en vez de una lista incompleta", async () => {
    servidorFalso.responder("from:suscripciones", { data: null, error: ERROR_PG });
    expect(await obtenerCanjes([CODIGO])).toEqual({ error: "No pudimos cargar quiénes canjearon." });

    servidorFalso.responder("from:suscripciones", { data: [] });
    vi.mocked(clasesPorUsuario).mockResolvedValue({ clases: new Map(), error: ERROR_PG } as never);
    expect(await obtenerCanjes([CODIGO])).toEqual({ error: "No pudimos cargar cuánto ha estudiado cada persona." });
  });
});
