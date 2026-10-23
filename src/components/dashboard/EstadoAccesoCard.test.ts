import { describe, expect, it } from "vitest";
import { formatFecha } from "@/lib/admin/format";
import { fraseAcceso, lineaVigencia } from "@/components/dashboard/EstadoAccesoCard";

const fecha = "2026-10-27T16:24:22Z";

/**
 * La tarjeta "Tu acceso" del perfil y "Mi suscripción" no pueden contradecirse.
 * Un acceso CANCELADO conserva su `fecha_renovacion`, que puede ser futura:
 * decir "estuvo vigente hasta" esa fecha la anuncia como pasada.
 */
describe("lineaVigencia", () => {
  it("vigente: dice hasta cuándo", () => {
    expect(lineaVigencia("VIGENTE", fecha, 20)).toBe(`Vigente hasta el ${formatFecha(fecha)}.`);
  });

  it("sin fecha límite: no inventa una", () => {
    expect(lineaVigencia("SIN_LIMITE", null, null)).toBe("Tu acceso no tiene fecha de cierre.");
  });

  it("vencido por fecha: la fecha ya pasó, se imprime", () => {
    expect(lineaVigencia("VENCIDO", fecha, -5)).toBe(`Estuvo vigente hasta el ${formatFecha(fecha)}.`);
  });

  it("vencido por estado con fecha todavía futura: no se imprime", () => {
    expect(lineaVigencia("VENCIDO", fecha, 20)).toBeNull();
  });

  it("vencido el mismo día de la fecha (0 días): tampoco se imprime como pasada", () => {
    expect(lineaVigencia("VENCIDO", fecha, 0)).toBeNull();
  });
});

/** Lo primero que lee el estudiante: qué puede hacer hoy y hasta cuándo. */
describe("fraseAcceso", () => {
  it("vigente: hasta cuándo, con la fecha completa", () => {
    expect(fraseAcceso("VIGENTE", "2027-03-12T16:00:00Z")).toBe(
      "Puedes ver todos los cursos hasta el 12 de marzo de 2027.",
    );
  });

  it("por vencer: la misma frase (el aviso de abajo cuenta los días)", () => {
    expect(fraseAcceso("POR_VENCER", "2026-10-27T16:24:22Z")).toBe(
      "Puedes ver todos los cursos hasta el 27 de octubre de 2026.",
    );
  });

  it("sin fecha límite: lo dice sin inventar una", () => {
    expect(fraseAcceso("SIN_LIMITE", null)).toBe("Puedes ver todos los cursos, sin fecha de cierre.");
  });

  it("vencido: dice que terminó, aunque la fecha sea futura", () => {
    expect(fraseAcceso("VENCIDO", fecha)).toBe("Tu acceso a los cursos terminó.");
  });
});
