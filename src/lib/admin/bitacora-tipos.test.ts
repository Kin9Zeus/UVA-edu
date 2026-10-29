import { describe, expect, it } from "vitest";
import { accionEnFrase, esSensible, tipoDeAccion } from "./bitacora-tipos";

describe("tipoDeAccion", () => {
  it("clasifica por la tabla afectada", () => {
    expect(tipoDeAccion("Eliminó un módulo", "modulos")).toBe("contenido");
    expect(tipoDeAccion("Suspendió una cuenta", "perfiles")).toBe("personas");
    expect(tipoDeAccion("Creó un cupón", "cupones")).toBe("invitaciones");
    expect(tipoDeAccion("Descartó un reporte de Comunidad (sin eliminar el contenido)", "comunidad_reportes")).toBe("moderacion");
  });

  it("exportar y suprimir datos van a Datos aunque la tabla sea otra", () => {
    expect(tipoDeAccion("Exportó la lista de usuarios a CSV", "perfiles")).toBe("datos");
    expect(tipoDeAccion("Exportó los códigos de invitación a CSV", "codigos_invitacion")).toBe("datos");
    expect(tipoDeAccion("Suprimió los datos personales de una cuenta (Habeas Data)", "perfiles")).toBe("datos");
  });
});

describe("esSensible", () => {
  it.each(["Eliminó un curso", "Suspendió una cuenta", "Revocó una membresía manual", "Quitó el video de una lección", "Exportó la bitácora a CSV", "Suprimió los datos personales de una cuenta (Habeas Data)"])(
    "%s es sensible",
    (accion) => expect(esSensible(accion)).toBe(true),
  );

  it.each(["Publicó un curso", "Activó una cuenta", "Creó un código de invitación", "Despublicó un curso"])(
    "%s no es sensible",
    (accion) => expect(esSensible(accion)).toBe(false),
  );
});

describe("accionEnFrase", () => {
  it("baja la inicial para leerse después del nombre", () => {
    expect(accionEnFrase("Publicó un curso")).toBe("publicó un curso");
  });

  it("traduce las filas guardadas antes de usar frases", () => {
    expect(accionEnFrase("GENERAR_EXAMEN_IA")).toBe("generó el examen final con IA");
  });
});
