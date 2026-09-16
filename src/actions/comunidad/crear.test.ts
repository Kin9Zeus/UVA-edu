import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/comunidad-adjuntos", () => ({
  prepararAdjuntosNuevos: vi.fn(),
  subirAdjuntosProcesados: vi.fn(),
}));

import { crearPostComunidad, responderPostComunidad, type DatosEmpleoComunidad } from "@/actions/comunidad/crear";
import { prepararAdjuntosNuevos, subirAdjuntosProcesados } from "@/lib/comunidad-adjuntos";

/**
 * Publicar y responder en Comunidad — AUDIT-2026-09-15.md, P2-9 Fase 1.
 *
 * RLS exige lo mismo que estas acciones (scripts/rls-test.ts, sección
 * COMUNIDAD); lo que se prueba aquí es el orden y lo que decide TypeScript:
 *   · el autor sale de la sesión;
 *   · todo se valida ANTES de escribir, adjuntos incluidos (todo o nada);
 *   · Anuncios es solo de admin, y sin acceso a la comunidad no se publica;
 *   · los campos de Empleo se exigen en Empleo y se DESCARTAN en las demás;
 *   · los adjuntos se suben después del INSERT y con el mismo id.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co" };

const EMPLEO: DatosEmpleoComunidad = {
  empresa: "Constructora Andes",
  modalidad: "HIBRIDO",
  ubicacion: "",
  enlace: "https://andes.example/vacante",
};

function inserts(tabla: "comunidad_posts" | "comunidad_respuestas"): Record<string, unknown>[] {
  return servidorFalso.encadenado(`from:${tabla}`, "insert").map((args) => args[0] as Record<string, unknown>);
}

/** FormData con N pares token/archivo, como lo arma el composer. */
function conAdjuntos(n: number): FormData {
  const formData = new FormData();
  for (let i = 0; i < n; i++) {
    formData.append("token", `pendiente:${i}`);
    formData.append("archivo", new File(["x"], `plano-${i}.pdf`, { type: "application/pdf" }));
  }
  return formData;
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
  servidorFalso.responder("rpc:comunidad_tiene_acceso", { data: true });
  servidorFalso.responder("from:perfiles", { data: { rol: "ESTUDIANTE" } });
  servidorFalso.responder("from:comunidad_posts", { data: { id: "post-creado" } });
  servidorFalso.responder("from:comunidad_respuestas", { data: { id: "respuesta-creada" } });
  vi.mocked(prepararAdjuntosNuevos)
    .mockReset()
    .mockImplementation(async (contenido) => ({ contenido, procesados: [] }));
  vi.mocked(subirAdjuntosProcesados).mockReset();
});

describe("crearPostComunidad", () => {
  it("sin sesión no consulta nada", async () => {
    servidorFalso.conUsuario(null);

    expect(await crearPostComunidad("PREGUNTAS", "¿Qué losa uso?", "Detalle", "/dashboard/comunidad")).toEqual({
      error: "Debes iniciar sesión para publicar.",
    });
    expect(servidorFalso.operaciones()).toEqual(["auth:getUser"]);
  });

  it("publica con el autor de la sesión y un id decidido en el servidor", async () => {
    const resultado = await crearPostComunidad("PREGUNTAS", "  ¿Qué losa uso?  ", "Detalle", "/dashboard/comunidad");

    expect(resultado).toEqual({ success: true, id: "post-creado" });
    const [fila] = inserts("comunidad_posts");
    expect(fila).toMatchObject({
      id_usuario: ESTUDIANTE.id,
      categoria: "PREGUNTAS",
      titulo: "¿Qué losa uso?",
      contenido: "Detalle",
      empleo_empresa: null,
      empleo_modalidad: null,
      empleo_ubicacion: null,
      empleo_enlace: null,
    });
    expect(fila.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(servidorFalso.revalidaciones).toEqual(["/dashboard/comunidad"]);
  });

  it.each([
    ["categoría inexistente", ["GENERAL", "Título válido", "Texto"], "Categoría inválida."],
    ["título corto", ["PREGUNTAS", "ab", "Texto"], "El título es demasiado corto."],
    ["título largo", ["PREGUNTAS", "a".repeat(151), "Texto"], "El título es demasiado largo."],
    ["contenido vacío", ["PREGUNTAS", "Título válido", "   "], "Escribe algo antes de publicar."],
    ["contenido largo", ["PREGUNTAS", "Título válido", "a".repeat(5001)], "La publicación es demasiado larga."],
  ])("%s: se rechaza sin tocar la base", async (_caso, [categoria, titulo, contenido], mensaje) => {
    expect(
      await crearPostComunidad(categoria as "PREGUNTAS", titulo, contenido, "/dashboard/comunidad"),
    ).toEqual({ error: mensaje });
    expect(servidorFalso.operaciones()).toEqual(["auth:getUser"]);
  });

  it("sin acceso a la comunidad no publica", async () => {
    servidorFalso.responder("rpc:comunidad_tiene_acceso", { data: false });

    expect(await crearPostComunidad("PREGUNTAS", "Título válido", "Texto", "/dashboard/comunidad")).toEqual({
      error: "Todavía no tienes acceso a la comunidad. Necesitas una suscripción activa.",
    });
    expect(inserts("comunidad_posts")).toEqual([]);
    expect(prepararAdjuntosNuevos).not.toHaveBeenCalled();
  });

  describe("Anuncios", () => {
    it("un estudiante no publica en Anuncios", async () => {
      expect(await crearPostComunidad("ANUNCIOS", "Aviso importante", "Texto", "/dashboard/comunidad")).toEqual({
        error: "Solo un administrador puede publicar en Anuncios.",
      });
      expect(servidorFalso.encadenado("from:perfiles", "eq")).toEqual([["id", ESTUDIANTE.id]]);
      expect(inserts("comunidad_posts")).toEqual([]);
    });

    it("un admin sí", async () => {
      servidorFalso.responder("from:perfiles", { data: { rol: "ADMINISTRADOR" } });

      expect(await crearPostComunidad("ANUNCIOS", "Aviso importante", "Texto", "/dashboard/comunidad")).toMatchObject({
        success: true,
      });
    });

    it("en otras categorías no se consulta el rol", async () => {
      await crearPostComunidad("PROYECTOS", "Mi proyecto", "Texto", "/dashboard/comunidad");

      expect(servidorFalso.llamadasA("from:perfiles")).toHaveLength(0);
    });
  });

  describe("Empleo", () => {
    it("guarda los cuatro campos validados; ubicación vacía queda null", async () => {
      await crearPostComunidad("EMPLEO", "Se busca residente", "Detalle", "/dashboard/comunidad", new FormData(), EMPLEO);

      expect(inserts("comunidad_posts")[0]).toMatchObject({
        empleo_empresa: "Constructora Andes",
        empleo_modalidad: "HIBRIDO",
        empleo_ubicacion: null,
        empleo_enlace: "https://andes.example/vacante",
      });
    });

    it.each([
      ["sin datos", undefined, "Escribe el nombre de la empresa."],
      ["modalidad fuera de la lista", { ...EMPLEO, modalidad: "FREELANCE" }, "Selecciona una modalidad."],
      [
        "enlace que no es URL",
        { ...EMPLEO, enlace: "andes.example" },
        "Ingresa un enlace válido (debe empezar con http:// o https://).",
      ],
    ])("%s: se rechaza sin escribir", async (_caso, datos, mensaje) => {
      expect(
        await crearPostComunidad("EMPLEO", "Se busca residente", "Detalle", "/dashboard/comunidad", new FormData(), datos),
      ).toEqual({ error: mensaje });
      expect(inserts("comunidad_posts")).toEqual([]);
    });

    it("en otra categoría los datos de empleo se ignoran, no se guardan", async () => {
      // El CHECK comunidad_posts_empleo_coherente rechazaría la fila entera.
      await crearPostComunidad("PREGUNTAS", "Una pregunta", "Detalle", "/dashboard/comunidad", new FormData(), EMPLEO);

      expect(inserts("comunidad_posts")[0]).toMatchObject({
        empleo_empresa: null,
        empleo_modalidad: null,
        empleo_ubicacion: null,
        empleo_enlace: null,
      });
    });
  });

  describe("adjuntos", () => {
    it("más del máximo se rechaza antes de procesar ninguno", async () => {
      expect(
        await crearPostComunidad("PROYECTOS", "Mi proyecto", "Texto", "/dashboard/comunidad", conAdjuntos(7)),
      ).toEqual({ error: "No puedes adjuntar más de 6 archivos por publicación." });
      expect(prepararAdjuntosNuevos).not.toHaveBeenCalled();
      expect(inserts("comunidad_posts")).toEqual([]);
    });

    it("si un archivo no pasa validación no se crea el post (todo o nada)", async () => {
      vi.mocked(prepararAdjuntosNuevos).mockResolvedValue({ error: "Formato no permitido." });

      expect(
        await crearPostComunidad("PROYECTOS", "Mi proyecto", "Texto", "/dashboard/comunidad", conAdjuntos(1)),
      ).toEqual({ error: "Formato no permitido." });
      expect(inserts("comunidad_posts")).toEqual([]);
      expect(subirAdjuntosProcesados).not.toHaveBeenCalled();
    });

    it("se inserta el contenido con los ids definitivos y se sube con el MISMO id de post", async () => {
      const procesados = [{ id: "adj-1", nombreOriginal: "plano-0.pdf" }] as never;
      vi.mocked(prepararAdjuntosNuevos).mockResolvedValue({ contenido: "Texto [[adjunto:adj-1]]", procesados });

      await crearPostComunidad(
        "PROYECTOS",
        "Mi proyecto",
        "Texto [[adjunto:pendiente:0]]",
        "/dashboard/comunidad",
        conAdjuntos(1),
      );

      const [fila] = inserts("comunidad_posts");
      expect(fila.contenido).toBe("Texto [[adjunto:adj-1]]");
      expect(subirAdjuntosProcesados).toHaveBeenCalledWith(expect.anything(), procesados, {
        idPost: fila.id,
        idUsuario: ESTUDIANTE.id,
      });
    });

    it("si el INSERT falla no se sube nada ni se revalida", async () => {
      servidorFalso.responder("from:comunidad_posts", { error: { message: "RLS" } });

      expect(await crearPostComunidad("PROYECTOS", "Mi proyecto", "Texto", "/dashboard/comunidad")).toEqual({
        error: "No pudimos publicar tu mensaje.",
      });
      expect(subirAdjuntosProcesados).not.toHaveBeenCalled();
      expect(servidorFalso.revalidaciones).toEqual([]);
    });
  });
});

describe("responderPostComunidad", () => {
  beforeEach(() => {
    servidorFalso.responder("from:comunidad_posts", { data: { eliminado: false } });
  });

  it("sin sesión no consulta nada", async () => {
    servidorFalso.conUsuario(null);

    expect(await responderPostComunidad("post-1", "Hola", "/dashboard/comunidad/x")).toEqual({
      error: "Debes iniciar sesión para responder.",
    });
    expect(servidorFalso.operaciones()).toEqual(["auth:getUser"]);
  });

  it("responde con el autor de la sesión en el post indicado", async () => {
    expect(await responderPostComunidad("post-1", "  Usa losa aligerada  ", "/dashboard/comunidad/x")).toEqual({
      success: true,
      id: "respuesta-creada",
    });
    const [fila] = inserts("comunidad_respuestas");
    expect(fila).toMatchObject({ id_usuario: ESTUDIANTE.id, id_post: "post-1", contenido: "Usa losa aligerada" });
  });

  it.each([
    ["vacía", "   ", "Escribe algo antes de responder."],
    ["larga", "a".repeat(2001), "La respuesta es demasiado larga."],
  ])("respuesta %s: se rechaza sin tocar la base", async (_caso, contenido, mensaje) => {
    expect(await responderPostComunidad("post-1", contenido, "/dashboard/comunidad/x")).toEqual({ error: mensaje });
    expect(servidorFalso.operaciones()).toEqual(["auth:getUser"]);
  });

  it.each([
    ["no existe (o RLS no deja verlo)", { data: null }],
    ["está eliminado", { data: { eliminado: true } }],
  ])("post que %s: no se responde", async (_caso, respuesta) => {
    servidorFalso.responder("from:comunidad_posts", respuesta);

    expect(await responderPostComunidad("post-1", "Hola", "/dashboard/comunidad/x")).toEqual({
      error: "La publicación a la que respondes ya no existe.",
    });
    expect(inserts("comunidad_respuestas")).toEqual([]);
  });

  it("sin acceso a la comunidad no responde", async () => {
    servidorFalso.responder("rpc:comunidad_tiene_acceso", { data: null });

    expect(await responderPostComunidad("post-1", "Hola", "/dashboard/comunidad/x")).toMatchObject({
      error: expect.stringContaining("acceso a la comunidad"),
    });
    expect(inserts("comunidad_respuestas")).toEqual([]);
  });

  it("más del máximo de adjuntos se rechaza antes de procesar", async () => {
    expect(await responderPostComunidad("post-1", "Hola", "/dashboard/comunidad/x", conAdjuntos(7))).toEqual({
      error: "No puedes adjuntar más de 6 archivos por respuesta.",
    });
    expect(prepararAdjuntosNuevos).not.toHaveBeenCalled();
  });

  it("los adjuntos se suben con el mismo id de la respuesta insertada", async () => {
    await responderPostComunidad("post-1", "Hola", "/dashboard/comunidad/x", conAdjuntos(1));

    const [fila] = inserts("comunidad_respuestas");
    expect(subirAdjuntosProcesados).toHaveBeenCalledWith(expect.anything(), [], {
      idRespuesta: fila.id,
      idUsuario: ESTUDIANTE.id,
    });
  });
});
