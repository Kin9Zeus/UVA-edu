import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearCliente, servidorFalso } from "@/test/servidor-falso";

vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/admin/requireAdmin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/admin/bitacora", () => ({ registrarBitacora: vi.fn() }));

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { crearLoteCodigosInvitacion } from "@/actions/admin/lotesCodigosInvitacion";

/** Lote de códigos de un solo uso (P2-12, AUDIT-2026-11-23). */

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOTE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const FUTURO = "2099-01-01T00:00:00.000Z";
const RPC = "rpc:crear_lote_codigos_invitacion";
const entrada = { cantidad: 3, duracionDias: 30, fechaVencimiento: FUTURO };

const bitacora = vi.mocked(registrarBitacora);

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(requireAdmin).mockResolvedValue({ supabase: crearCliente("sesion") as never, adminId: ADMIN });
  bitacora.mockReset();
});

describe("crearLoteCodigosInvitacion", () => {
  it("manda N códigos distintos en UNA llamada (transacción del RPC) y anota el lote", async () => {
    servidorFalso.responder(RPC, { data: LOTE });

    const resultado = await crearLoteCodigosInvitacion(entrada);

    expect(resultado).toMatchObject({ success: true, loteId: LOTE });
    expect(new Set(resultado.codigos).size).toBe(3);
    expect(servidorFalso.argumentosDe(RPC)).toEqual({
      p_codigos: resultado.codigos,
      p_duracion_dias: 30,
      p_fecha_vencimiento: FUTURO,
    });
    expect(bitacora).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idEntidadAfectada: LOTE, cantidad: 3 }),
    );
  });

  it("si un código choca con uno existente, reintenta el lote entero con códigos nuevos", async () => {
    servidorFalso.responderEnOrden(RPC, [{ error: { message: "duplicate", code: "23505" } }, { data: LOTE }]);

    expect(await crearLoteCodigosInvitacion(entrada)).toMatchObject({ success: true });
    const [primero, segundo] = servidorFalso.llamadasA(RPC).map((l) => (l.argumentos[0] as { p_codigos: string[] }).p_codigos);
    expect(primero).not.toEqual(segundo);
  });

  it("se rinde tras 5 choques; otro fallo no se reintenta; ninguno va a la bitácora", async () => {
    servidorFalso.responder(RPC, { error: { message: "duplicate", code: "23505" } });
    expect(await crearLoteCodigosInvitacion(entrada)).toEqual({
      error: "No pudimos generar un lote de códigos libres. Intenta de nuevo.",
    });
    expect(servidorFalso.llamadasA(RPC)).toHaveLength(5);

    servidorFalso.reiniciar();
    servidorFalso.responder(RPC, { error: { message: "timeout", code: "57014" } });
    expect(await crearLoteCodigosInvitacion(entrada)).toEqual({ error: "No pudimos generar el lote de códigos." });
    expect(servidorFalso.llamadasA(RPC)).toHaveLength(1);
    expect(bitacora).not.toHaveBeenCalled();
  });

  it.each([
    ["1 código (para eso está el código único)", { ...entrada, cantidad: 1 }],
    ["más de 500", { ...entrada, cantidad: 501 }],
    ["cantidad con decimales", { ...entrada, cantidad: 2.5 }],
    ["días en 0", { ...entrada, duracionDias: 0 }],
    ["fecha pasada", { ...entrada, fechaVencimiento: "2000-01-01T00:00:00.000Z" }],
  ])("rechaza %s sin llamar a la base", async (_caso, invalida) => {
    expect(await crearLoteCodigosInvitacion(invalida)).toHaveProperty("error");
    expect(servidorFalso.llamadas).toHaveLength(0);
  });
});
