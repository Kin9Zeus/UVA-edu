import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearCliente, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("next/headers", () => import("@/test/servidor-falso").then((m) => m.moduloNextHeaders()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/mux/client", () => import("@/test/servidor-falso").then((m) => m.moduloMuxCliente()));
vi.mock("@/lib/admin/bitacora", () => ({ registrarBitacora: vi.fn() }));
vi.mock("@/lib/admin/requireAdmin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/cache-catalogo", async (original) => ({
  ...(await original<typeof import("@/lib/cache-catalogo")>()),
  revalidarCatalogoPublico: vi.fn(),
}));
vi.mock("@/lib/admin/portada", () => ({ procesarPortada: vi.fn() }));

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { revalidarCatalogoPublico } from "@/lib/cache-catalogo";
import { procesarPortada } from "@/lib/admin/portada";
import {
  alternarPublicacionCurso,
  eliminarCurso,
  moverLeccion,
  moverModulo,
  subirPortadaCurso,
} from "@/actions/admin/cursos";

/**
 * Editor de cursos, lo delicado (P2-12, AUDIT-2026-11-23): publicar, borrar,
 * reordenar y cambiar la portada. Borrar módulos y clases con sus videos ya
 * lo cubre videosMux.test.ts; el guard de rol, autorizacion.test.ts.
 */

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CURSO = "22222222-2222-4222-8222-222222222222";
const MODULO = "33333333-3333-4333-8333-333333333333";
const A = "44444444-4444-4444-8444-444444444444";
const B = "55555555-5555-4555-8555-555555555555";
const C = "66666666-6666-4666-8666-666666666666";
const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };
const PORTADA = "https://proyecto.supabase.co/storage/v1/object/public/portadas-cursos/revit-22222222/vieja.webp";

const bitacora = vi.mocked(registrarBitacora);

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(requireAdmin).mockResolvedValue({ supabase: crearCliente("sesion") as never, adminId: ADMIN });
  bitacora.mockReset();
  vi.mocked(revalidarCatalogoPublico).mockReset();
});

describe("alternarPublicacionCurso", () => {
  const listo = {
    titulo: "Revit",
    imagen_portada: PORTADA,
    modulos: [{ lecciones: [{ estado_procesamiento: "LISTO" }] }],
  };

  it("publica un curso listo, lo anota y vacía la caché del catálogo", async () => {
    servidorFalso.responderEnOrden("from:cursos", [{ data: listo }, { error: null }]);

    expect(await alternarPublicacionCurso(CURSO, true)).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:cursos", "update")).toEqual([[{ mostrado: true }]]);
    expect(bitacora).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ accion: "Publicó un curso" }));
    expect(revalidarCatalogoPublico).toHaveBeenCalled();
  });

  it("no publica un curso sin portada (la regla manda en el servidor, no solo en la UI)", async () => {
    servidorFalso.responder("from:cursos", { data: { ...listo, imagen_portada: null } });

    expect((await alternarPublicacionCurso(CURSO, true)).error).toMatch(/portada/);
    expect(servidorFalso.encadenado("from:cursos", "update")).toEqual([]);
  });

  it("si no puede comprobar el curso, no publica", async () => {
    servidorFalso.responder("from:cursos", { data: null, error: ERROR_PG });

    expect(await alternarPublicacionCurso(CURSO, true)).toEqual({ error: "No pudimos comprobar el curso. Intenta de nuevo." });
    expect(servidorFalso.encadenado("from:cursos", "update")).toEqual([]);
  });

  it("despublicar no exige nada: siempre se puede sacar un curso del catálogo", async () => {
    expect(await alternarPublicacionCurso(CURSO, false)).toEqual({ success: true });
    expect(servidorFalso.llamadasA("from:cursos")).toHaveLength(1);
    expect(bitacora).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ accion: "Despublicó un curso" }));
  });

  it("rechaza un id que no es uuid sin tocar la base", async () => {
    expect(await alternarPublicacionCurso("../otro", true)).toEqual({ error: "Curso inválido." });
    expect(servidorFalso.llamadas).toHaveLength(0);
  });
});

describe("eliminarCurso", () => {
  it("borra un curso vacío y sin inscritos", async () => {
    servidorFalso.responder("from:inscripciones", { count: 0 });
    servidorFalso.responder("from:modulos", { count: 0 });

    expect(await eliminarCurso(CURSO)).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:cursos", "delete")).toHaveLength(1);
    expect(bitacora).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ accion: "Eliminó un curso" }));
  });

  it("con inscritos no se borra: propone despublicar", async () => {
    servidorFalso.responder("from:inscripciones", { count: 3 });

    expect((await eliminarCurso(CURSO)).error).toMatch(/3 estudiantes inscritos.*despublícalo/);
    expect(servidorFalso.llamadasA("from:cursos")).toHaveLength(0);
  });

  it("con módulos no se borra (un curso con contenido no desaparece de un golpe)", async () => {
    servidorFalso.responder("from:inscripciones", { count: 0 });
    servidorFalso.responder("from:modulos", { count: 2 });

    expect((await eliminarCurso(CURSO)).error).toMatch(/tiene módulos/);
    expect(servidorFalso.llamadasA("from:cursos")).toHaveLength(0);
  });

  it("si no puede contar inscritos o módulos, no borra (un fallo no es «cero»)", async () => {
    servidorFalso.responder("from:inscripciones", { count: null, error: ERROR_PG });
    expect(await eliminarCurso(CURSO)).toEqual({ error: "No pudimos verificar los estudiantes del curso." });

    servidorFalso.responder("from:inscripciones", { count: 0 });
    servidorFalso.responder("from:modulos", { count: null, error: ERROR_PG });
    expect(await eliminarCurso(CURSO)).toEqual({ error: "No pudimos verificar el contenido del curso." });

    expect(servidorFalso.llamadasA("from:cursos")).toHaveLength(0);
    expect(bitacora).not.toHaveBeenCalled();
  });
});

describe.each([
  {
    nombre: "moverModulo",
    tabla: "from:modulos",
    rpc: "rpc:reespaciar_orden_modulos",
    grupo: { p_curso_id: CURSO },
    mover: (anterior: string | null, siguiente: string | null) => moverModulo(CURSO, C, anterior, siguiente),
  },
  {
    nombre: "moverLeccion",
    tabla: "from:lecciones",
    rpc: "rpc:reespaciar_orden_lecciones",
    grupo: { p_modulo_id: MODULO },
    mover: (anterior: string | null, siguiente: string | null) => moverLeccion(CURSO, MODULO, C, anterior, siguiente),
  },
])("$nombre", ({ tabla, rpc, grupo, mover }) => {
  it("con espacio entre los vecinos: una sola escritura con el orden intermedio", async () => {
    servidorFalso.responderEnOrden(tabla, [
      { data: [{ id: A, orden: 10 }, { id: B, orden: 20 }] },
      { error: null },
    ]);

    expect(await mover(A, B)).toEqual({ success: true });
    expect(servidorFalso.encadenado(tabla, "update")).toEqual([[{ orden: 15 }]]);
    expect(servidorFalso.llamadasA(rpc)).toHaveLength(0);
  });

  it("al final de la lista: 10 después del último", async () => {
    servidorFalso.responderEnOrden(tabla, [{ data: [{ id: B, orden: 20 }] }, { error: null }]);

    await mover(B, null);

    expect(servidorFalso.encadenado(tabla, "update")).toEqual([[{ orden: 30 }]]);
  });

  it("sin espacio (10 y 11): reespacía TODO el grupo en una sola RPC, con el elemento en su lugar", async () => {
    servidorFalso.responderEnOrden(tabla, [
      { data: [{ id: A, orden: 10 }, { id: B, orden: 11 }] },
      { data: [{ id: A }, { id: B }] },
    ]);

    expect(await mover(A, B)).toEqual({ success: true });
    expect(servidorFalso.argumentosDe(rpc)).toEqual({ ...grupo, p_ids: [A, C, B] });
    expect(servidorFalso.encadenado(tabla, "update")).toEqual([]);
  });

  it("si no puede leer los vecinos o el resto del grupo, no escribe un orden equivocado", async () => {
    servidorFalso.responder(tabla, { data: null, error: ERROR_PG });
    expect(await mover(A, B)).toHaveProperty("error");

    servidorFalso.responderEnOrden(tabla, [
      { data: [{ id: A, orden: 10 }, { id: B, orden: 11 }] },
      { data: null, error: ERROR_PG },
    ]);
    expect(await mover(A, B)).toHaveProperty("error");

    expect(servidorFalso.encadenado(tabla, "update")).toEqual([]);
    expect(servidorFalso.llamadasA(rpc)).toHaveLength(0);
  });

  it("rechaza ids que no son uuid sin tocar la base", async () => {
    expect(await mover("no-es-uuid", null)).toHaveProperty("error");
    expect(servidorFalso.llamadas).toHaveLength(0);
  });
});

describe("subirPortadaCurso", () => {
  const formulario = () => {
    const datos = new FormData();
    datos.set("archivo", new File([new Uint8Array([1])], "foto.png", { type: "image/png" }));
    return datos;
  };

  beforeEach(() => {
    vi.mocked(procesarPortada).mockResolvedValue({
      portada: { cuerpo: Buffer.from([1]), contentType: "image/webp", extension: "webp" },
    } as never);
  });

  it("sube con nombre aleatorio a la carpeta del curso, guarda la URL y RECIÉN después borra la anterior", async () => {
    servidorFalso.responderEnOrden("from:cursos", [{ data: { titulo: "Revit", imagen_portada: PORTADA } }, { error: null }]);

    const resultado = await subirPortadaCurso(CURSO, formulario());

    expect(resultado).toMatchObject({ success: true });
    const [ruta] = servidorFalso.encadenado("storage:portadas-cursos", "upload")[0] as [string];
    expect(ruta).toMatch(/^revit-22222222\/[0-9a-f-]{36}\.webp$/);
    expect(servidorFalso.encadenado("storage:portadas-cursos", "remove")).toEqual([[["revit-22222222/vieja.webp"]]]);
    const orden = servidorFalso.operaciones();
    expect(orden.lastIndexOf("from:cursos")).toBeLessThan(orden.lastIndexOf("storage:portadas-cursos"));
  });

  it("si no se puede guardar la URL, borra lo recién subido y conserva la portada anterior", async () => {
    servidorFalso.responderEnOrden("from:cursos", [
      { data: { titulo: "Revit", imagen_portada: PORTADA } },
      { error: ERROR_PG },
    ]);

    expect(await subirPortadaCurso(CURSO, formulario())).toEqual({ error: "No pudimos guardar la portada." });
    const [subida] = servidorFalso.encadenado("storage:portadas-cursos", "upload")[0] as [string];
    expect(servidorFalso.encadenado("storage:portadas-cursos", "remove")).toEqual([[[subida]]]);
    expect(bitacora).not.toHaveBeenCalled();
  });

  it("una imagen que no pasa la validación no sube nada", async () => {
    vi.mocked(procesarPortada).mockResolvedValue({ error: "El archivo no es una imagen válida." } as never);

    expect(await subirPortadaCurso(CURSO, formulario())).toEqual({ error: "El archivo no es una imagen válida." });
    expect(servidorFalso.llamadas).toHaveLength(0);
  });
});
