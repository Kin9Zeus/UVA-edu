import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { deInvitacionAPago, resumirSemanas } from "./usuarios-estudio";
import { construirHistorial, resumirDiasEstudio, totalPagado, type AccesoDeLaFicha } from "./usuario-historial";
import { dejoDeEstudiar, textoAcceso, textoEstudio } from "./acceso-texto";
import type { AccesoListado } from "./usuarios";

// Miércoles 28 de octubre de 2026, 10:00 en Bogotá. La semana actual empieza el lunes 26.
const AHORA = new Date("2026-10-28T15:00:00Z");
const HOY = AHORA.toISOString();

describe("resumirSemanas", () => {
  it("pone cada fila en su semana y deja en 0 las que no vinieron", () => {
    const semanas = resumirSemanas([{ semana: "2026-10-26", personas: 34, nuevas: 6, pagan: 14 }], AHORA);
    expect(semanas).toHaveLength(12);
    expect(semanas.at(-1)).toMatchObject({ inicio: "2026-10-26", total: 34, porSerie: { personas: 34 }, nuevas: 6, volvieron: 28, pagan: 14 });
    expect(semanas.slice(0, -1).every((s) => s.total === 0 && s.volvieron === 0)).toBe(true);
  });
});

describe("deInvitacionAPago", () => {
  it("cuenta a quien pagó después de que se le acabó la invitación, no antes ni a quien sigue invitado", () => {
    const r = deInvitacionAPago(
      [
        { idUsuario: "ana", proveedor: "invitacion", inicio: "2026-09-01T00:00:00Z", fin: "2026-10-01T00:00:00Z" },
        { idUsuario: "ana", proveedor: "wompi", inicio: "2026-10-02T00:00:00Z", fin: "2026-11-02T00:00:00Z" },
        { idUsuario: "luis", proveedor: "invitacion", inicio: "2026-09-01T00:00:00Z", fin: "2026-10-01T00:00:00Z" },
        // Pagó antes de su invitación: no salió de ella.
        { idUsuario: "eva", proveedor: "stripe", inicio: "2026-08-01T00:00:00Z", fin: "2026-09-01T00:00:00Z" },
        { idUsuario: "eva", proveedor: "invitacion", inicio: "2026-09-02T00:00:00Z", fin: "2026-10-02T00:00:00Z" },
        // Sigue con la invitación: todavía no cuenta.
        { idUsuario: "leo", proveedor: "invitacion", inicio: "2026-10-20T00:00:00Z", fin: "2026-11-20T00:00:00Z" },
      ],
      AHORA,
    );
    expect(r).toEqual({ invitacionTerminada: 3, pagaronDespues: 1 });
  });
});

const acceso = (cambios: Partial<AccesoListado>): AccesoListado => ({
  estado: "ACTIVA",
  origen: "INVITACION",
  inicio: "2026-10-01T15:00:00Z",
  fin: "2026-10-31T15:00:00Z",
  plan: null,
  montoCentavos: 0,
  moneda: "COP",
  proveedor: "invitacion",
  ...cambios,
});

describe("textoAcceso", () => {
  it("dice de dónde viene el acceso vigente y avisa cuando se acaba en 7 días", () => {
    expect(textoAcceso(acceso({}), "ESTUDIANTE", HOY, false)).toEqual({
      etiqueta: "Por invitación",
      tono: "success",
      lineas: [{ texto: "Se le acaba en 3 días", alerta: true }, { texto: "30 días gratis" }],
    });
    expect(textoAcceso(acceso({ origen: "MANUAL", proveedor: "manual", fin: "2027-01-01T15:00:00Z" }), "ESTUDIANTE", HOY, false).etiqueta).toBe(
      "Dado por U.V.A.",
    );
  });

  it("un pago dice plan, monto y pasarela; Stripe se renueva solo y no avisa", () => {
    const wompi = textoAcceso(
      acceso({ origen: "PAGO", proveedor: "wompi", plan: "Mensual", montoCentavos: 4_990_000 }),
      "ESTUDIANTE",
      HOY,
      true,
    );
    expect(wompi.etiqueta).toBe("Paga · Mensual");
    expect(wompi.lineas[1].texto).toMatch(/49\.900 con Wompi$/);
    const stripe = textoAcceso(acceso({ origen: "PAGO", proveedor: "stripe", plan: "Anual" }), "ESTUDIANTE", HOY, true);
    expect(stripe.lineas[0]).toEqual({ texto: "Se renueva sola en 3 días", alerta: false });
  });

  it("vencido y revocado dicen qué era", () => {
    const vencido = textoAcceso(acceso({ estado: "VENCIDA", origen: "PAGO", proveedor: "wompi", plan: "Mensual", fin: "2026-10-22T15:00:00Z" }), "ESTUDIANTE", HOY, true);
    expect(vencido).toMatchObject({ etiqueta: "Vencido", lineas: [{ texto: "Pagó el plan Mensual" }, { texto: "Se le acabó hace 6 días" }] });
    expect(textoAcceso(acceso({ estado: "CANCELADA" }), "ESTUDIANTE", HOY, false)).toMatchObject({
      etiqueta: "Revocado",
      lineas: [{ texto: "Entró por invitación" }, { texto: "Se lo quitó un administrador" }],
    });
  });

  it("nunca tuvo, y un administrador siempre es permanente", () => {
    expect(textoAcceso(null, "ESTUDIANTE", HOY, true).lineas[0].texto).toBe("Nunca canjeó un código ni pagó");
    expect(textoAcceso(null, "ADMINISTRADOR", HOY, true).etiqueta).toBe("Permanente");
  });
});

describe("estudio", () => {
  it("dejó de estudiar: con acceso y 14 días o más sin ver una clase, o nunca", () => {
    expect(dejoDeEstudiar(acceso({}), "2026-10-14T15:00:00Z", HOY)).toBe(true);
    expect(dejoDeEstudiar(acceso({}), "2026-10-15T15:00:00Z", HOY)).toBe(false);
    expect(dejoDeEstudiar(acceso({}), null, HOY)).toBe(true);
    expect(dejoDeEstudiar(acceso({ estado: "VENCIDA" }), null, HOY)).toBe(false);
    expect(textoEstudio("2026-10-27T23:00:00Z", HOY)).toBe("Estudió ayer");
  });

  it("días por semana, días en 30 y racha que termina hoy o ayer", () => {
    const r = resumirDiasEstudio(["2026-10-27", "2026-10-26", "2026-10-25", "2026-10-20", "2026-09-01"], AHORA);
    expect(r.semanas.at(-1)!.total).toBe(2);
    expect(r.semanas.at(-2)!.total).toBe(2);
    expect(r.dias30).toBe(4);
    expect(r.racha).toBe(3);
  });
});

describe("construirHistorial", () => {
  const invitacion: AccesoDeLaFicha = {
    id: "s1",
    estado: "VENCIDA",
    proveedor: "invitacion",
    inicio: "2026-09-03T15:00:00Z",
    fin: "2026-10-03T15:00:00Z",
    plan: null,
    codigo: "UVA-K7M2-QP4X",
    deLote: false,
    motivoCancelacion: null,
    actualizadoEn: "2026-09-03T15:00:00Z",
  };

  it("entrada, fin de la invitación y pagos, de lo más reciente a lo más viejo; sin checkouts abandonados", () => {
    const pagos = [
      { estado: "RECHAZADO" as const, montoCentavos: 4_990_000, moneda: "COP", plan: "Mensual", cupon: null, fecha: "2026-10-04T15:00:00Z" },
      { estado: "APROBADO" as const, montoCentavos: 4_990_000, moneda: "COP", plan: "Mensual", cupon: "OCTUBRE20", fecha: "2026-10-04T16:00:00Z" },
      { estado: "PENDIENTE" as const, montoCentavos: 4_990_000, moneda: "COP", plan: "Mensual", cupon: null, fecha: "2026-10-05T16:00:00Z" },
    ];
    const h = construirHistorial([invitacion], pagos, AHORA);
    expect(h.map((e) => e.titulo)).toEqual([
      "Pagó el plan Mensual",
      "Intentó pagar el plan Mensual",
      "Se le acabó la invitación",
      "Entró con el código UVA-K7M2-QP4X",
    ]);
    expect(h[0]).toMatchObject({ resultado: "Aprobado" });
    expect(h[0].detalle).toMatch(/con Wompi, con el cupón OCTUBRE20$/);
    expect(totalPagado(pagos)).toMatch(/^\$\s?49\.900$/);
  });

  it("una revocación dice el motivo; un código de lote no se muestra", () => {
    const h = construirHistorial(
      [{ ...invitacion, estado: "CANCELADA", deLote: true, motivoCancelacion: "Compartió el acceso", actualizadoEn: "2026-09-20T15:00:00Z" }],
      [],
      AHORA,
    );
    expect(h).toEqual([
      { fecha: "2026-09-20T15:00:00Z", titulo: "Un administrador le quitó el acceso", detalle: "Compartió el acceso" },
      { fecha: "2026-09-03T15:00:00Z", titulo: "Entró con un código de lote", detalle: "30 días gratis" },
    ]);
    expect(totalPagado([])).toBeNull();
  });
});
