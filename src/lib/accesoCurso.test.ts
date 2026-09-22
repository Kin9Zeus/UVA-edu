import { beforeEach, describe, expect, it } from "vitest";
import { crearCliente, servidorFalso } from "@/test/servidor-falso";
import { obtenerAccesoAlCurso } from "@/lib/accesoCurso";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * El muro de acceso distingue "no tiene acceso" de "no se pudo saber"
 * (AUDIT-2026-09-22.md, seguimiento de P2-3). Antes un fallo de cualquiera de
 * sus consultas llegaba como `data: null` y salía como "sin acceso": candado
 * en la ficha, rebote de la lección y el video cortado a quien sí paga.
 */

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };
const EN_UN_MES = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

const cliente = () => crearCliente("sesion") as unknown as SupabaseClient;

beforeEach(() => {
  servidorFalso.reiniciar();
});

describe("obtenerAccesoAlCurso", () => {
  it("sin sesión: sin acceso y sin tocar la base", async () => {
    expect(await obtenerAccesoAlCurso(cliente(), null, "k1")).toEqual({
      tieneAcceso: false,
      tieneCortesia: false,
      suscripcion: null,
    });
    expect(servidorFalso.llamadas).toHaveLength(0);
  });

  it("suscripción vigente: tiene acceso", async () => {
    servidorFalso.responder("from:suscripciones", {
      data: { estado: "ACTIVA", fecha_renovacion: EN_UN_MES },
      error: null,
    });

    const acceso = await obtenerAccesoAlCurso(cliente(), "u1", "k1");

    expect(acceso.tieneAcceso).toBe(true);
    expect(acceso.suscripcion).toEqual({ estado: "ACTIVA", fechaRenovacion: EN_UN_MES });
  });

  it("sin cortesía ni suscripción ni perfil: sin acceso, y NO lanza (no encontrar filas no es un fallo)", async () => {
    const acceso = await obtenerAccesoAlCurso(cliente(), "u1", "k1");

    expect(acceso).toEqual({ tieneAcceso: false, tieneCortesia: false, suscripcion: null });
  });

  it("lee el perfil con maybeSingle: con `single`, un perfil que no existe llega como error y lanzaría", async () => {
    await obtenerAccesoAlCurso(cliente(), "u1", "k1");

    const metodos = servidorFalso.llamadasA("from:perfiles")[0].cadena.map((c) => c.metodo);
    expect(metodos).toContain("maybeSingle");
    expect(metodos).not.toContain("single");
  });

  it.each(["perfiles", "inscripciones", "suscripciones", "curso_instructores_publico"])(
    "si falla la consulta de %s, LANZA en vez de responder 'sin acceso'",
    async (tabla) => {
      // El resto sí daría acceso: lo que se prueba es que un fallo no se
      // disfraza de respuesta, ni en un sentido ni en el otro.
      servidorFalso.responder("from:suscripciones", {
        data: { estado: "ACTIVA", fecha_renovacion: EN_UN_MES },
        error: null,
      });
      servidorFalso.responder(`from:${tabla}`, { data: null, error: ERROR_PG });

      await expect(obtenerAccesoAlCurso(cliente(), "u1", "k1")).rejects.toThrow(
        new RegExp(`obtenerAccesoAlCurso:${tabla} falló.*57014`),
      );
    },
  );
});
