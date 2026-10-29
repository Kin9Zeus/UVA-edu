import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));

const { armarPendientes, contarPorSemana, esperanOtroIntento, mayorPerdida } = await import("@/lib/admin/dashboard");

const NADA = {
  reportes: { contenidos: 0, diasMasAntiguo: 0 },
  examenes: [],
  videosConError: [],
  pagosPendientes: 0,
  planesVencen: 0,
  listosParaPublicar: [],
  invitacionesSeAcaban: 0,
  parados: 0,
};

describe("Inicio del panel", () => {
  it("contarPorSemana pone cada fecha en su semana (hora de Colombia) y descarta las viejas", () => {
    // Jueves 29 de octubre de 2026: la última semana empieza el lunes 26.
    const ahora = new Date("2026-10-29T15:00:00-05:00");
    const cuentas = contarPorSemana(
      [
        "2026-10-26T05:30:00Z", // lunes 26, 00:30 en Colombia: esta semana
        "2026-10-26T04:30:00Z", // domingo 25, 23:30 en Colombia: la pasada
        "2026-10-28T12:00:00Z",
        "2026-01-05T12:00:00Z", // fuera de las 12 semanas
      ],
      ahora,
    );
    expect(cuentas).toHaveLength(12);
    expect(cuentas[11]).toBe(2);
    expect(cuentas[10]).toBe(1);
    expect(cuentas.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("mayorPerdida señala el paso al que más gente no llega", () => {
    const pasos = [214, 171, 88, 27, 21].map((personas, i) => ({ etiqueta: String(i), personas }));
    expect(mayorPerdida(pasos)).toBe(2);
    expect(mayorPerdida([{ etiqueta: "a", personas: 3 }, { etiqueta: "b", personas: 3 }])).toBeNull();
  });

  it("esperanOtroIntento cuenta solo a quien agotó la tanda, sin aprobar ni intento abierto", () => {
    const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();
    const intentos = [
      // Agotó los 3 hace una hora: espera larga.
      ...[180, 120, 60].map((m) => ({ idExamen: "e1", idUsuario: "ana", estado: "REPROBADO", finalizadoEn: hace(m) })),
      // Dos de tres: solo espera corta.
      ...[90, 60].map((m) => ({ idExamen: "e1", idUsuario: "beto", estado: "REPROBADO", finalizadoEn: hace(m) })),
      // Agotó y luego aprobó: no cuenta.
      ...[180, 120].map((m) => ({ idExamen: "e1", idUsuario: "caro", estado: "REPROBADO", finalizadoEn: hace(m) })),
      { idExamen: "e1", idUsuario: "caro", estado: "APROBADO", finalizadoEn: hace(60) },
    ];
    expect(esperanOtroIntento(intentos, new Map([["e1", 3]]))).toEqual(new Map([["e1", 1]]));
  });

  it("armarPendientes deja fuera lo que está en cero y escribe en singular y plural", () => {
    expect(armarPendientes(NADA)).toEqual([]);

    const lista = armarPendientes({
      ...NADA,
      reportes: { contenidos: 1, diasMasAntiguo: 0 },
      videosConError: [{ slug: "revit-mep", titulo: "Revit MEP básico", clases: ["Ductos"] }],
      listosParaPublicar: [{ slug: "costos", titulo: "Control de costos en obra" }],
      parados: 23,
    });
    expect(lista.map((p) => p.titulo)).toEqual([
      "1 contenido reportado espera tu decisión",
      "1 video no se pudo procesar",
      "Control de costos en obra ya se puede publicar",
      "23 personas con acceso dejaron de estudiar",
    ]);
    expect(lista[0].detalle).toBe("En Comunidad. Es de hoy");
    expect(lista[1]).toMatchObject({ tono: "error", href: "/admin/cursos/revit-mep?pestana=contenido" });
    expect(lista[2].cantidad).toBeNull();
    expect(lista[3].href).toBe("/admin/usuarios?estudio=PARADOS");
  });
});
