import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/comunidad-adjuntos", () => ({
  // Sin archivos nuevos el procesamiento real no cambia el texto; se
  // reemplaza para no cargar el pipeline de imágenes en un test de permisos.
  prepararAdjuntosNuevos: vi.fn(async (contenido: string) => ({ contenido, procesados: [] })),
  subirAdjuntosProcesados: vi.fn(),
  borrarAdjuntoComunidad: vi.fn(),
}));

import { editarPostComunidad } from "@/actions/comunidad/editar";
import { borrarAdjuntoComunidad, subirAdjuntosProcesados } from "@/lib/comunidad-adjuntos";

/**
 * `editarPostComunidad` — AUDIT-2026-09-15.md, P2-8 Fase 3.
 *
 * Editar es solo del autor (ni siquiera un admin edita contenido ajeno: lo
 * modera borrándolo). Y el UPDATE tiene que tocar solo lo editable: si un
 * refactor lo cambiara por un spread de lo que manda el formulario, un
 * estudiante podría fijarse su propio post o reasignarlo a otro usuario.
 */

const AUTORA = { id: "autora-1", email: "ana@uva.co" };
const OTRO = { id: "otro-2", email: "beto@uva.co" };
const POST = { id_usuario: AUTORA.id, eliminado: false, categoria: "PREGUNTAS" };

function editar(campos: { titulo?: string; contenido?: string; empleo?: Parameters<typeof editarPostComunidad>[5] } = {}) {
  return editarPostComunidad(
    "post-1",
    campos.titulo ?? "Título corregido",
    campos.contenido ?? "Contenido corregido",
    "/dashboard/comunidad/post-1",
    new FormData(),
    campos.empleo,
  );
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.responder("from:comunidad_posts", { data: POST });
  servidorFalso.responder("from:comunidad_adjuntos", { data: [] });
  vi.mocked(borrarAdjuntoComunidad).mockReset();
  vi.mocked(subirAdjuntosProcesados).mockReset();
});

describe("quién puede editar", () => {
  it("sin sesión no lee el post", async () => {
    expect(await editar()).toEqual({ error: "Debes iniciar sesión." });
    expect(servidorFalso.llamadasA("from:comunidad_posts")).toHaveLength(0);
  });

  it("otro usuario: rechazo sin escribir ni tocar adjuntos", async () => {
    servidorFalso.conUsuario(OTRO);

    expect(await editar()).toEqual({ error: "No tienes permiso para editar esta publicación." });
    expect(servidorFalso.encadenado("from:comunidad_posts", "update")).toEqual([]);
    expect(servidorFalso.llamadasA("from:comunidad_adjuntos")).toHaveLength(0);
    expect(servidorFalso.revalidaciones).toEqual([]);
  });

  it("un post eliminado ya no se puede editar, ni por su autora", async () => {
    servidorFalso.conUsuario(AUTORA);
    servidorFalso.responder("from:comunidad_posts", { data: { ...POST, eliminado: true } });

    expect(await editar()).toEqual({ error: "La publicación ya no existe." });
    expect(servidorFalso.encadenado("from:comunidad_posts", "update")).toEqual([]);
  });
});

describe("la autora edita", () => {
  beforeEach(() => servidorFalso.conUsuario(AUTORA));

  it("el UPDATE toca solo título y contenido — nada de autor, fijado, categoría ni eliminado", async () => {
    expect(await editar({ titulo: "  Título corregido  " })).toEqual({ success: true });

    expect(servidorFalso.encadenado("from:comunidad_posts", "update")).toEqual([
      [{ titulo: "Título corregido", contenido: "Contenido corregido" }],
    ]);
    expect(servidorFalso.encadenado("from:comunidad_posts", "eq")).toContainEqual(["id", "post-1"]);
    expect(servidorFalso.revalidaciones).toEqual(["/dashboard/comunidad/post-1"]);
  });

  it.each([
    ["título demasiado corto", { titulo: "ab" }, "El título es demasiado corto."],
    ["contenido vacío", { contenido: "   " }, "Escribe algo antes de publicar."],
  ])("%s: no escribe", async (_caso, campos, mensaje) => {
    expect(await editar(campos)).toEqual({ error: mensaje });
    expect(servidorFalso.encadenado("from:comunidad_posts", "update")).toEqual([]);
  });

  it("en EMPLEO exige los datos de la oferta", async () => {
    servidorFalso.responder("from:comunidad_posts", { data: { ...POST, categoria: "EMPLEO" } });

    // Campos vacíos, que es lo que manda el formulario.
    const resultado = await editar({ empleo: { empresa: "", modalidad: "REMOTO", ubicacion: "", enlace: "" } });

    expect(resultado).toEqual({ error: "Escribe el nombre de la empresa." });
    expect(servidorFalso.encadenado("from:comunidad_posts", "update")).toEqual([]);
  });

  it("en EMPLEO sin datos de la oferta (no llegaron) el mensaje sigue en español", async () => {
    // Antes zod respondía "Invalid input: expected string, received
    // undefined" y la acción lo mostraba tal cual: ver comunidad-validacion.ts.
    servidorFalso.responder("from:comunidad_posts", { data: { ...POST, categoria: "EMPLEO" } });

    expect(await editar()).toEqual({ error: "Escribe el nombre de la empresa." });
  });

  // Una Server Action es un endpoint POST: nada impide invocarla sin un
  // argumento aunque el tipo diga `string`. Se llama directo porque el
  // helper `editar()` rellena los que faltan.
  const NO_LLEGO = undefined as unknown as string;

  it("título que no llegó: mensaje en español", async () => {
    expect(await editarPostComunidad("post-1", NO_LLEGO, "Contenido válido", "/r")).toEqual({
      error: "Escribe un título.",
    });
  });

  it("contenido que no llegó: mensaje en español", async () => {
    expect(await editarPostComunidad("post-1", "Título válido", NO_LLEGO, "/r")).toEqual({
      error: "Escribe algo antes de publicar.",
    });
  });

  it("en EMPLEO con datos válidos, actualiza también los campos de la oferta", async () => {
    servidorFalso.responder("from:comunidad_posts", { data: { ...POST, categoria: "EMPLEO" } });

    const resultado = await editar({
      empleo: { empresa: " Constructora X ", modalidad: "REMOTO", ubicacion: "", enlace: "https://x.co/oferta" },
    });

    expect(resultado).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:comunidad_posts", "update")[0][0]).toEqual({
      titulo: "Título corregido",
      contenido: "Contenido corregido",
      empleo_empresa: "Constructora X",
      empleo_modalidad: "REMOTO",
      empleo_ubicacion: null,
      empleo_enlace: "https://x.co/oferta",
    });
  });

  it("en otra categoría ignora datos de empleo que lleguen igual", async () => {
    await editar({ empleo: { empresa: "X", modalidad: "REMOTO", ubicacion: "", enlace: "https://x.co" } });

    expect(servidorFalso.encadenado("from:comunidad_posts", "update")[0][0]).toEqual({
      titulo: "Título corregido",
      contenido: "Contenido corregido",
    });
  });

  it("borra los adjuntos que el nuevo texto ya no referencia, y conserva los que sí", async () => {
    servidorFalso.responder("from:comunidad_adjuntos", {
      data: [
        { id: "queda", ruta_storage: "a/queda.png" },
        { id: "sobra", ruta_storage: "a/sobra.png" },
      ],
    });

    await editar({ contenido: "Mira el plano [[adjunto:queda]]" });

    expect(borrarAdjuntoComunidad).toHaveBeenCalledTimes(1);
    expect(borrarAdjuntoComunidad).toHaveBeenCalledWith(expect.anything(), "sobra", "a/sobra.png");
    expect(subirAdjuntosProcesados).toHaveBeenCalledWith(expect.anything(), [], {
      idPost: "post-1",
      idUsuario: AUTORA.id,
    });
  });

  it("si el UPDATE falla, no borra adjuntos previos", async () => {
    // Borrarlos igual dejaría el texto viejo apuntando a archivos inexistentes.
    servidorFalso.responderEnOrden("from:comunidad_posts", [{ data: POST }, { error: { message: "x" } }]);
    servidorFalso.responder("from:comunidad_adjuntos", { data: [{ id: "sobra", ruta_storage: "a/sobra.png" }] });

    expect(await editar()).toEqual({ error: "No pudimos guardar los cambios." });
    expect(borrarAdjuntoComunidad).not.toHaveBeenCalled();
  });
});
