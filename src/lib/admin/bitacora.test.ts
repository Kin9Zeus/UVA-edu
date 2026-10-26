import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { cumpleFiltros, diaEnColombia, resumirPorDia, sumarDias, type EntradaBitacora } from "./bitacora";

function entrada(cambios: Partial<EntradaBitacora>): EntradaBitacora {
  return {
    id: "e1",
    creadoEn: "2026-10-26T15:00:00Z",
    dia: "2026-10-26",
    adminNombre: "Andrés Escobar",
    accion: "Publicó un curso",
    entidadAfectada: "cursos",
    tipo: "contenido",
    sensible: false,
    detalles: null,
    idEntidadAfectada: null,
    slugEntidad: null,
    sujeto: null,
    ...cambios,
  };
}

describe("diaEnColombia", () => {
  it("corta el día en hora de Colombia, no en UTC", () => {
    // 02:00 UTC del 27 son las 21:00 del 26 en Bogotá.
    expect(diaEnColombia("2026-10-27T02:00:00Z")).toBe("2026-10-26");
    expect(diaEnColombia("2026-10-27T05:00:00Z")).toBe("2026-10-27");
  });
});

describe("sumarDias", () => {
  it("cruza meses", () => {
    expect(sumarDias("2026-10-01", -1)).toBe("2026-09-30");
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("resumirPorDia", () => {
  it("da 30 días terminando hoy y cuenta por tipo y sensibles", () => {
    const dias = resumirPorDia(
      [
        entrada({ dia: "2026-10-26", tipo: "contenido" }),
        entrada({ dia: "2026-10-26", tipo: "datos", sensible: true }),
        entrada({ dia: "2026-09-27", tipo: "personas" }),
        entrada({ dia: "2026-09-26", tipo: "personas" }), // fuera de los 30 días
      ],
      "2026-10-26",
    );
    expect(dias).toHaveLength(30);
    expect(dias[0].dia).toBe("2026-09-27");
    expect(dias[0].total).toBe(1);
    expect(dias.at(-1)).toEqual({ dia: "2026-10-26", total: 2, sensibles: 1, porTipo: { contenido: 1, datos: 1 } });
  });
});

describe("cumpleFiltros", () => {
  const sin = { tipo: null, sensibles: false, busqueda: null };

  it("busca sin tildes ni mayúsculas en quién, qué y sobre quién", () => {
    const e = entrada({ accion: "Suspendió una cuenta", sujeto: "Laura Mejía", tipo: "personas", sensible: true });
    expect(cumpleFiltros(e, { ...sin, busqueda: "mejia" })).toBe(true);
    expect(cumpleFiltros(e, { ...sin, busqueda: "SUSPENDIO" })).toBe(true);
    expect(cumpleFiltros(e, { ...sin, busqueda: "andres" })).toBe(true);
    expect(cumpleFiltros(e, { ...sin, busqueda: "camilo" })).toBe(false);
  });

  it("filtra por tipo y por sensibles", () => {
    const e = entrada({ tipo: "contenido" });
    expect(cumpleFiltros(e, { ...sin, tipo: "personas" })).toBe(false);
    expect(cumpleFiltros(e, { ...sin, sensibles: true })).toBe(false);
    expect(cumpleFiltros(entrada({ sensible: true }), { ...sin, sensibles: true })).toBe(true);
  });
});
