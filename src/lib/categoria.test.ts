import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearCliente, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => crearCliente("sesion") }));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));

import { buscarCatalogoConProgreso } from "@/lib/categoria";

/**
 * Catálogo del dashboard: las marcas "Completado" / "Examen pendiente" de la
 * tarjeta (P2-4, AUDIT-2026-09-22.md). Antes se calculaban acá con la regla
 * vieja (100% de clases Y examen aprobado) y divergían de "Mi progreso".
 */

const CURSO = "curso-taller";

function conFilaDeProgreso(fila: {
  lecciones_total: number;
  lecciones_completadas: number;
  examen_requerido: boolean;
  examen_aprobado: boolean;
}) {
  servidorFalso.responder("rpc:buscar_catalogo", {
    data: [
      {
        curso_id: CURSO,
        curso_slug: "taller-de-presupuestos",
        titulo: "Taller de Presupuestos",
        nivel: "BASICO",
        imagen_portada: "/portada.jpg",
        instructor_nombre: "Ana",
        categorias: null,
        total_clases: fila.lecciones_total,
        total_resultados: 1,
      },
    ],
  });
  servidorFalso.responder("from:progreso_cursos_estudiante", { data: [{ curso_id: CURSO, ...fila }] });
}

beforeEach(() => {
  servidorFalso.reiniciar();
});

describe("buscarCatalogoConProgreso", () => {
  it("examen aprobado con 5 de 10 clases: la tarjeta sale Completado (el caso visto en producción)", async () => {
    conFilaDeProgreso({ lecciones_total: 10, lecciones_completadas: 5, examen_requerido: true, examen_aprobado: true });

    const { cursos } = await buscarCatalogoConProgreso({});

    expect(cursos[0]).toMatchObject({ completado: true, examenPendiente: false });
  });

  it("todas las clases sin el examen aprobado: Examen pendiente, no Completado", async () => {
    conFilaDeProgreso({ lecciones_total: 10, lecciones_completadas: 10, examen_requerido: true, examen_aprobado: false });

    const { cursos } = await buscarCatalogoConProgreso({});

    expect(cursos[0]).toMatchObject({ completado: false, examenPendiente: true });
  });

  it("sin examen, 199 de 200 clases no está completado (redondeo hacia abajo)", async () => {
    conFilaDeProgreso({ lecciones_total: 200, lecciones_completadas: 199, examen_requerido: false, examen_aprobado: false });

    const { cursos } = await buscarCatalogoConProgreso({});

    expect(cursos[0]).toMatchObject({ completado: false, examenPendiente: false });
  });
});
