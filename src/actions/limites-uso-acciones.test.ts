import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/eventos-seguridad", () => ({ registrarEventoDeLaPeticion: vi.fn(async () => {}) }));
vi.mock("@/lib/comunidad-adjuntos", () => ({
  prepararAdjuntosNuevos: vi.fn(async (contenido: string) => ({ contenido, procesados: [] })),
  subirAdjuntosProcesados: vi.fn(),
  borrarAdjuntoComunidad: vi.fn(),
}));

import { crearPostComunidad, responderPostComunidad } from "@/actions/comunidad/crear";
import { editarPostComunidad } from "@/actions/comunidad/editar";
import { reaccionarPostComunidad, reaccionarRespuestaComunidad } from "@/actions/comunidad/reaccionar";
import { reportarComunidad } from "@/actions/comunidad/reportar";
import { crearComentario } from "@/actions/comentarios/crear";
import { darLikeComentario } from "@/actions/comentarios/like";
import { crearNota } from "@/actions/notas/crear";
import { editarNota } from "@/actions/notas/editar";
import { prepararAdjuntosNuevos } from "@/lib/comunidad-adjuntos";
import { logError } from "@/lib/log";
import { registrarEventoDeLaPeticion } from "@/lib/eventos-seguridad";
import {
  ACCIONES_LIMITADAS,
  CODIGO_LIMITE_DE_USO,
  MENSAJE_LIMITE_ADJUNTOS,
  MENSAJE_LIMITE_ALCANZADO,
  MENSAJE_LIMITE_SIN_COMPROBAR,
} from "@/lib/limites-uso";

/**
 * Fase 3 del plan de blindaje. Los topes los aplica la base, con un trigger
 * en cada tabla (supabase/sql/134_limites_uso.sql): así valen también para
 * quien escriba directo por la API. Que la base cuente bien, corte en el
 * máximo y no deje pasar a dos a la vez se prueba en `npm run test:rls`.
 *
 * Aquí se prueba lo que hace la app: traducir el rechazo de la base a un
 * aviso claro (no "no pudimos publicar", que haría reintentar en vano), y
 * contar los adjuntos antes de procesar los archivos.
 */

const USUARIO = { id: "estudiante-1", email: "ana@uva.co" };
const LECCION = "11111111-1111-4111-8111-111111111111";
const NOTA = "22222222-2222-4222-8222-222222222222";
const RECHAZO_POR_LIMITE = {
  data: null,
  error: { code: CODIGO_LIMITE_DE_USO, message: "Vas muy rápido. Espera unos minutos e inténtalo de nuevo." },
};

function conAdjuntos(n: number): FormData {
  const formData = new FormData();
  for (let i = 0; i < n; i++) {
    formData.append("token", `pendiente:${i}`);
    formData.append("archivo", new File(["x"], `plano-${i}.pdf`, { type: "application/pdf" }));
  }
  return formData;
}

const POST_PROPIO = { id_usuario: USUARIO.id, eliminado: false, categoria: "PREGUNTAS" };

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(USUARIO);
  servidorFalso.responder("rpc:comunidad_tiene_acceso", { data: true });
  servidorFalso.responder("rpc:consumir_limite", { data: true });
  vi.mocked(logError).mockClear();
  vi.mocked(registrarEventoDeLaPeticion).mockClear();
  vi.mocked(prepararAdjuntosNuevos).mockClear();
});

describe.each([
  {
    nombre: "publicar en la comunidad",
    tabla: "from:comunidad_posts",
    ejecutar: () => crearPostComunidad("PREGUNTAS", "¿Qué losa uso?", "Detalle", "/r"),
  },
  {
    nombre: "responder en la comunidad",
    tabla: "from:comunidad_respuestas",
    preparar: () => servidorFalso.responder("from:comunidad_posts", { data: { eliminado: false } }),
    ejecutar: () => responderPostComunidad("post-1", "Usa una losa aligerada", "/r"),
  },
  {
    nombre: "comentar en una clase",
    tabla: "from:comentarios",
    ejecutar: () => crearComentario(LECCION, "Muy clara la clase", null, "/r"),
  },
  {
    nombre: "reaccionar a un post",
    tabla: "from:comunidad_reacciones",
    ejecutar: () => reaccionarPostComunidad("post-1", "/r"),
  },
  {
    nombre: "reaccionar a una respuesta",
    tabla: "from:comunidad_reacciones",
    ejecutar: () => reaccionarRespuestaComunidad("respuesta-1", "/r"),
  },
  {
    nombre: "dar like a un comentario",
    tabla: "from:comentario_likes",
    ejecutar: () => darLikeComentario("comentario-1", "/r"),
  },
  {
    nombre: "reportar contenido",
    tabla: "from:comunidad_reportes",
    ejecutar: () => reportarComunidad({ idPost: "post-1" }, "Es spam"),
  },
  {
    nombre: "crear una nota",
    tabla: "from:notas_leccion",
    ejecutar: () => crearNota(LECCION, 95, "Revisar la exposición"),
  },
  {
    nombre: "editar una nota",
    tabla: "from:notas_leccion",
    ejecutar: () => editarNota(NOTA, "Revisar la exposición, otra vez"),
  },
])("límite de uso (lo aplica la base): $nombre", ({ tabla, preparar, ejecutar }) => {
  it("si la base rechaza por el límite, avisa que vaya más despacio y no revalida nada", async () => {
    preparar?.();
    // Las lecturas previas (si las hay) responden lo de `preparar`; la escritura, el rechazo.
    servidorFalso.responderSegun(tabla, (llamada) =>
      llamada.cadena.some((c) => ["insert", "upsert", "update"].includes(c.metodo))
        ? RECHAZO_POR_LIMITE
        : ({ data: { eliminado: false } } as never),
    );

    expect(await ejecutar()).toEqual({ error: MENSAJE_LIMITE_ALCANZADO });
    expect(servidorFalso.revalidaciones).toEqual([]);
    // Fase 10.2: deja su evento de seguridad, con el nombre de la acción de la base.
    expect(registrarEventoDeLaPeticion).toHaveBeenCalledTimes(1);
    const [evento, datos] = vi.mocked(registrarEventoDeLaPeticion).mock.calls[0];
    expect(evento).toBe("limite_de_uso");
    expect(ACCIONES_LIMITADAS).toContain(datos?.accion);
  });
});

describe.each([
  {
    nombre: "publicar con 3 adjuntos",
    cantidad: 3,
    escritura: ["from:comunidad_posts", "insert"] as const,
    ejecutar: () => crearPostComunidad("PREGUNTAS", "¿Qué losa uso?", "Detalle", "/r", conAdjuntos(3)),
  },
  {
    nombre: "responder con 2 adjuntos",
    cantidad: 2,
    escritura: ["from:comunidad_respuestas", "insert"] as const,
    preparar: () => servidorFalso.responder("from:comunidad_posts", { data: { eliminado: false } }),
    ejecutar: () => responderPostComunidad("post-1", "Mira estos planos", "/r", conAdjuntos(2)),
  },
  {
    nombre: "editar un post agregando 2 adjuntos",
    cantidad: 2,
    escritura: ["from:comunidad_posts", "update"] as const,
    preparar: () => {
      servidorFalso.responder("from:comunidad_posts", { data: POST_PROPIO });
      servidorFalso.responder("from:comunidad_adjuntos", { data: [] });
    },
    ejecutar: () => editarPostComunidad("post-1", "Título corregido", "Contenido corregido", "/r", conAdjuntos(2)),
  },
])("tope diario de adjuntos: $nombre", ({ cantidad, escritura, preparar, ejecutar }) => {
  beforeEach(() => preparar?.());

  it("gasta un uso por archivo, con la sesión, antes de procesarlos", async () => {
    await ejecutar();

    const llamadas = servidorFalso.llamadasA("rpc:consumir_limite");
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].argumentos[0]).toEqual({ p_accion: "comunidad_adjuntos", p_cantidad: cantidad });
    // Con la sesión: la base toma el usuario de auth.uid(), nunca de la app.
    expect(llamadas[0].cliente).toBe("sesion");
    const orden = servidorFalso.operaciones();
    // Antes de la escritura (lastIndexOf: editar también LEE comunidad_posts antes).
    expect(orden.indexOf("rpc:consumir_limite")).toBeLessThan(orden.lastIndexOf(escritura[0]));
    expect(prepararAdjuntosNuevos).toHaveBeenCalled();
  });

  it("sin cupo, avisa que es por hoy y no procesa ni escribe nada", async () => {
    servidorFalso.responder("rpc:consumir_limite", { data: false });

    expect(await ejecutar()).toEqual({ error: MENSAJE_LIMITE_ADJUNTOS });
    expect(prepararAdjuntosNuevos).not.toHaveBeenCalled();
    expect(servidorFalso.encadenado(escritura[0], escritura[1])).toHaveLength(0);
  });

  it("si la comprobación falla, no deja pasar (falla cerrado) y no dice que fue por ir rápido", async () => {
    servidorFalso.responder("rpc:consumir_limite", { data: null, error: { code: "57014", message: "statement timeout" } });

    expect(await ejecutar()).toEqual({ error: MENSAJE_LIMITE_SIN_COMPROBAR });
    expect(prepararAdjuntosNuevos).not.toHaveBeenCalled();
    expect(servidorFalso.encadenado(escritura[0], escritura[1])).toHaveLength(0);
    expect(logError).toHaveBeenCalledWith(
      "limites-uso",
      expect.any(String),
      expect.objectContaining({ code: "57014" }),
      expect.objectContaining({ accion: "comunidad_adjuntos" }),
    );
  });
});

describe("tope de adjuntos: sin archivos no se gasta", () => {
  it("publicar sin adjuntos no llama a consumir_limite (el tope de publicar lo pone la base)", async () => {
    await crearPostComunidad("PREGUNTAS", "¿Qué losa uso?", "Detalle", "/r");
    expect(servidorFalso.llamadasA("rpc:consumir_limite")).toHaveLength(0);
  });
});
