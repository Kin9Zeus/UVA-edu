import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/notificaciones", () => ({ getNotificaciones: vi.fn(), contarNotificacionesNoLeidas: vi.fn() }));
vi.mock("@/lib/suscripcion", () => ({ getSuscripcionActual: vi.fn() }));

const { calcularAcceso } = await import("@/lib/dashboard-chrome");

const ahora = new Date("2026-10-16T12:00:00Z");
const base = { estado: "ACTIVA", fechaInicio: "2026-10-01T12:00:00Z", tieneCodigoInvitacion: true };

describe("calcularAcceso", () => {
  it("cuenta los días que faltan y la parte del período que queda", () => {
    const acceso = calcularAcceso({ ...base, fechaRenovacion: "2026-10-31T12:00:00Z" }, ahora);
    expect(acceso).toMatchObject({ diasRestantes: 15, esInvitacion: true });
    expect(acceso!.restante).toBeCloseTo(0.5);
  });

  it("sin fecha de fin, vencido o fuera de ACTIVA no hay tarjeta", () => {
    expect(calcularAcceso({ ...base, fechaRenovacion: null }, ahora)).toBeNull();
    expect(calcularAcceso({ ...base, fechaRenovacion: "2026-10-10T12:00:00Z" }, ahora)).toBeNull();
    expect(calcularAcceso({ ...base, estado: "PAST_DUE", fechaRenovacion: "2026-10-31T12:00:00Z" }, ahora)).toBeNull();
    expect(calcularAcceso(null, ahora)).toBeNull();
  });
});
