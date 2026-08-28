import { describe, expect, it } from "vitest";
import {
  calcularDiasVigencia,
  calcularEstadoAcceso,
  suscripcionDaAcceso,
  tipoAccesoGratuito,
  type EstadoAcceso,
} from "@/lib/estadoAcceso";
import { formatFecha } from "@/lib/admin/format";
import type { SuscripcionActual } from "@/lib/suscripcion";

type SuscripcionMinima = Parameters<typeof calcularEstadoAcceso>[0];

function suscripcion(campos: Partial<NonNullable<SuscripcionMinima>> = {}): SuscripcionMinima {
  return {
    accesoManual: true,
    tieneCodigoInvitacion: true,
    estado: "ACTIVA" as SuscripcionActual["estado"],
    fechaRenovacion: "2026-12-31T05:00:00Z",
    ...campos,
  };
}

describe("tipoAccesoGratuito", () => {
  it("una suscripción de pago no es acceso gratuito", () => {
    expect(tipoAccesoGratuito({ accesoManual: false, tieneCodigoInvitacion: false })).toBeNull();
  });

  it("con código canjeado es una invitación", () => {
    expect(tipoAccesoGratuito({ accesoManual: true, tieneCodigoInvitacion: true })).toBe(
      "INVITACION",
    );
  });

  it("sin código lo otorgó un administrador", () => {
    expect(tipoAccesoGratuito({ accesoManual: true, tieneCodigoInvitacion: false })).toBe(
      "OTORGADO_ADMIN",
    );
  });
});

/**
 * El conteo se hace en días de calendario colombiano, no en múltiplos de 24 h
 * desde el instante actual: el estudiante lee "vence en N días" justo al lado
 * de "Vigente hasta <fecha>", y ambas cosas tienen que estar contando lo mismo.
 */
describe("calcularDiasVigencia", () => {
  it("sin fecha límite no hay conteo", () => {
    expect(calcularDiasVigencia(null, new Date("2026-09-03T15:00:00Z"))).toBeNull();
  });

  it("el mismo día en Bogotá es 0 (vence hoy), aunque falten horas", () => {
    // 2026-09-04T03:00Z son las 22:00 del 3 de septiembre en Bogotá.
    expect(calcularDiasVigencia("2026-09-04T03:00:00Z", new Date("2026-09-03T20:00:00Z"))).toBe(0);
  });

  it("el día siguiente en Bogotá es 1, aunque falten menos de 24 h", () => {
    // 2026-09-04T06:00Z = 01:00 del 4 de septiembre en Bogotá; ahora, 22:00 del 3.
    expect(calcularDiasVigencia("2026-09-04T06:00:00Z", new Date("2026-09-04T03:00:00Z"))).toBe(1);
  });

  it("cuenta los días completos que faltan", () => {
    expect(calcularDiasVigencia("2026-09-30T05:00:00Z", new Date("2026-09-03T20:00:00Z"))).toBe(27);
  });

  it("una fecha ya pasada devuelve negativo, no 0", () => {
    // Regresión: con Math.max(0, …) un acceso vencido en junio seguía
    // diciendo "vence hoy" indefinidamente.
    expect(calcularDiasVigencia("2026-06-01T05:00:00Z", new Date("2026-09-03T20:00:00Z"))).toBe(-94);
  });
});

describe("calcularEstadoAcceso", () => {
  const ahora = new Date("2026-09-03T20:00:00Z"); // 15:00 del 3 de septiembre en Bogotá

  it("sin suscripción no hay tarjeta", () => {
    expect(calcularEstadoAcceso(null, ahora)).toBeNull();
  });

  it("una suscripción de pago no usa esta tarjeta", () => {
    expect(
      calcularEstadoAcceso(
        suscripcion({ accesoManual: false, tieneCodigoInvitacion: false }),
        ahora,
      ),
    ).toBeNull();
  });

  it("con margen amplio está vigente", () => {
    expect(calcularEstadoAcceso(suscripcion({ fechaRenovacion: "2026-10-03T05:00:00Z" }), ahora))
      .toMatchObject<Partial<EstadoAcceso>>({
        tipo: "INVITACION",
        vigencia: "VIGENTE",
        diasRestantes: 30,
      });
  });

  it("a 7 días entra el aviso de vencimiento próximo", () => {
    expect(
      calcularEstadoAcceso(suscripcion({ fechaRenovacion: "2026-09-10T05:00:00Z" }), ahora)
        ?.vigencia,
    ).toBe("POR_VENCER");
  });

  it("a 8 días todavía no avisa", () => {
    expect(
      calcularEstadoAcceso(suscripcion({ fechaRenovacion: "2026-09-11T05:00:00Z" }), ahora)
        ?.vigencia,
    ).toBe("VIGENTE");
  });

  it("el último día avisa, con 0 días restantes", () => {
    expect(
      calcularEstadoAcceso(suscripcion({ fechaRenovacion: "2026-09-03T23:00:00Z" }), ahora),
    ).toMatchObject<Partial<EstadoAcceso>>({ vigencia: "POR_VENCER", diasRestantes: 0 });
  });

  it("pasada la fecha queda vencido aunque la fila siga ACTIVA", () => {
    // Nada mueve hoy la suscripción a VENCIDA al pasar la fecha (no hay job
    // de expiración), así que la tarjeta no puede fiarse solo del estado.
    expect(
      calcularEstadoAcceso(suscripcion({ fechaRenovacion: "2026-08-20T05:00:00Z" }), ahora),
    ).toMatchObject<Partial<EstadoAcceso>>({ vigencia: "VENCIDO", diasRestantes: -14 });
  });

  it("una suscripción cancelada está vencida aunque le queden días", () => {
    expect(
      calcularEstadoAcceso(
        suscripcion({ estado: "CANCELADA", fechaRenovacion: "2026-12-31T05:00:00Z" }),
        ahora,
      )?.vigencia,
    ).toBe("VENCIDO");
  });

  it("una suscripción marcada VENCIDA está vencida", () => {
    expect(calcularEstadoAcceso(suscripcion({ estado: "VENCIDA" }), ahora)?.vigencia).toBe(
      "VENCIDO",
    );
  });

  it("un acceso manual sin fecha se muestra sin límite, no como vencido", () => {
    expect(
      calcularEstadoAcceso(suscripcion({ fechaRenovacion: null }), ahora),
    ).toMatchObject<Partial<EstadoAcceso>>({ vigencia: "SIN_LIMITE", diasRestantes: null });
  });

  it("distingue el acceso otorgado por el admin del canjeado con código", () => {
    expect(
      calcularEstadoAcceso(suscripcion({ tieneCodigoInvitacion: false }), ahora)?.tipo,
    ).toBe("OTORGADO_ADMIN");
  });
});

/**
 * La tarjeta imprime la fecha con `formatFecha` (zona America/Bogota) y, al
 * lado, los días que faltan. Si el conteo se hiciera en UTC, en las horas de
 * la noche colombiana diría "vence en 1 día" debajo de una fecha que ya es
 * hoy. Este test fija que ambas lecturas salgan del mismo día civil.
 */
describe("el conteo de días y la fecha impresa no se separan", () => {
  it("cuando faltan 0 días, la fecha impresa es la de hoy en Bogotá", () => {
    const ahora = new Date("2026-09-03T20:00:00Z");
    const fechaRenovacion = "2026-09-04T03:00:00Z"; // 22:00 del 3 en Bogotá

    expect(calcularDiasVigencia(fechaRenovacion, ahora)).toBe(0);
    expect(formatFecha(fechaRenovacion)).toBe(formatFecha(ahora.toISOString()));
  });
});

/**
 * La regla que decide si el contenido se abre. Vale la pena fijarla con
 * tests porque es la que, al no mirar la fecha, dejaba a una invitación
 * de 30 días reproduciendo video indefinidamente.
 */
describe("suscripcionDaAcceso", () => {
  const ahora = new Date("2026-09-03T20:00:00Z"); // 15:00 del 3 de septiembre en Bogotá

  it("sin suscripción no hay acceso", () => {
    expect(suscripcionDaAcceso(null, ahora)).toBe(false);
  });

  it("ACTIVA con días por delante: sí", () => {
    expect(
      suscripcionDaAcceso({ estado: "ACTIVA", fechaRenovacion: "2026-09-20T05:00:00Z" }, ahora),
    ).toBe(true);
  });

  it("ACTIVA en su último día: sí, hasta el final del día colombiano", () => {
    // La plataforma le anunció "Vigente hasta el 3 de septiembre": no puede
    // cortarle el video a media mañana de ese mismo día.
    expect(
      suscripcionDaAcceso({ estado: "ACTIVA", fechaRenovacion: "2026-09-03T12:00:00Z" }, ahora),
    ).toBe(true);
  });

  it("ACTIVA con la fecha ya pasada: NO (el agujero que se cierra)", () => {
    expect(
      suscripcionDaAcceso({ estado: "ACTIVA", fechaRenovacion: "2026-09-02T23:00:00Z" }, ahora),
    ).toBe(false);
  });

  it("ACTIVA sin fecha límite: sí", () => {
    expect(suscripcionDaAcceso({ estado: "ACTIVA", fechaRenovacion: null }, ahora)).toBe(true);
  });

  it("PAST_DUE dentro de la gracia: sí", () => {
    expect(
      suscripcionDaAcceso({ estado: "PAST_DUE", fechaRenovacion: "2026-09-01T20:00:00Z" }, ahora),
    ).toBe(true);
  });

  it("PAST_DUE pasada la gracia: no", () => {
    expect(
      suscripcionDaAcceso({ estado: "PAST_DUE", fechaRenovacion: "2026-08-20T20:00:00Z" }, ahora),
    ).toBe(false);
  });

  it("VENCIDA y CANCELADA no dan acceso aunque les sobren días", () => {
    expect(
      suscripcionDaAcceso({ estado: "VENCIDA", fechaRenovacion: "2026-12-31T05:00:00Z" }, ahora),
    ).toBe(false);
    expect(
      suscripcionDaAcceso({ estado: "CANCELADA", fechaRenovacion: "2026-12-31T05:00:00Z" }, ahora),
    ).toBe(false);
  });
});
