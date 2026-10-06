import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

/**
 * Tercer bloque de "error mostrado como vacío" (ver error-como-vacio.test.ts y
 * error-como-vacio-lecturas.test.ts): certificado, sitemap y los datos
 * SECUNDARIOS de las pantallas (nombres de autor, reacciones, adjuntos).
 *
 * Los secundarios no tumban la pantalla —el contenido principal se lee igual—
 * pero ya no fallan en silencio: dejan registro para que un "Usuario" donde
 * debería haber un nombre no sea un misterio.
 */
vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/public", () => import("@/test/servidor-falso").then((m) => m.moduloSupabasePublic()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/resend/client", () => import("@/test/servidor-falso").then((m) => m.moduloResendCliente()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("@/lib/perfil", () => ({
  getPerfilActual: async () => ({ user: { id: "u1" }, perfil: { nombre: "Ana", rol: "ESTUDIANTE" } }),
  getUsuarioActual: async () => ({ id: "u1", email: "ana@uva.co" }),
}));
vi.mock("@/lib/categoria", () => ({ getCategoriasActivas: async () => [] }));
vi.mock("@/lib/certificados/pdf", () => ({ construirCertificadoPdf: vi.fn(async () => new Uint8Array([1])) }));

const { logError } = await import("@/lib/log");
const { descargarCertificadoPdf } = await import("@/actions/certificados/descargar");
const { default: sitemap } = await import("@/app/sitemap");
const { getComentariosDeLeccion } = await import("@/lib/comentarios");
const { getNotificaciones } = await import("@/lib/notificaciones");
const { construirCertificadoPdf } = await import("@/lib/certificados/pdf");
const { getNotasDeLeccion } = await import("@/lib/notas");
const { listarNotasDelCurso } = await import("@/actions/notas/listar");
const { contarNotificacionesNoLeidas } = await import("@/lib/notificaciones");
const { getDashboardChromeData } = await import("@/lib/dashboard-chrome");

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };
const FALLO = { data: null, error: ERROR_PG };

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(logError).mockClear();
  vi.mocked(construirCertificadoPdf).mockClear();
  process.env.NEXT_PUBLIC_SITE_URL = "https://uva.test";
});

describe("Certificado en PDF", () => {
  const certificado = {
    id: "cert-1",
    id_curso: "c1",
    fecha_emision: "2026-09-01T00:00:00Z",
    codigo_verificacion: "ABC123",
    archivo_pdf: null,
    nombre_estudiante: "Ana",
    nombre_curso: "Revit desde cero",
  };

  it("si falla la lectura de la duración NO arma ni guarda un PDF sin horas (se cachearía para siempre)", async () => {
    servidorFalso.responder("from:certificados", { data: certificado, error: null });
    servidorFalso.responder("from:lecciones", FALLO);

    expect(await descargarCertificadoPdf("cert-1")).toEqual({
      error: "No pudimos generar tu certificado. Intenta de nuevo.",
    });
    expect(construirCertificadoPdf).not.toHaveBeenCalled();
    expect(servidorFalso.llamadas.some((l) => l.operacion.startsWith("storage:"))).toBe(false);
    expect(logError).toHaveBeenCalledTimes(1);
  });
});

describe("Sitemap", () => {
  it("si falla la lectura de los cursos lanza (Next conserva la última versión buena) en vez de servir uno sin cursos", async () => {
    servidorFalso.responder("from:cursos", FALLO);
    await expect(sitemap()).rejects.toThrow(/sitemap:cursos falló.*57014/);
  });

  it("con cursos y sin error los lista", async () => {
    servidorFalso.responder("from:cursos", {
      data: [{ slug: "revit", actualizado_en: "2026-09-01T00:00:00Z" }],
      error: null,
    });
    const rutas = await sitemap();
    expect(rutas.some((ruta) => ruta.url.endsWith("/cursos/revit"))).toBe(true);
  });
});

describe("Datos secundarios: se degradan pero dejan registro", () => {
  it("comentarios: si fallan los autores se leen igual (autor genérico) y se registra", async () => {
    servidorFalso.responder("from:comentarios", {
      data: [
        {
          id: "k1",
          id_comentario_padre: null,
          contenido: "Muy buena clase",
          eliminado: false,
          creado_en: "2026-09-01T00:00:00Z",
          id_usuario: "u2",
          comentario_likes: [],
        },
      ],
      error: null,
    });
    servidorFalso.responder("from:comentarios_autor_publico", FALLO);
    servidorFalso.responder("from:curso_instructores_publico", { data: [], error: null });

    const comentarios = await getComentariosDeLeccion("l1", "c1", null);

    expect(comentarios).toHaveLength(1);
    expect(comentarios![0].texto).toBe("Muy buena clase");
    expect(comentarios![0].autor).toBe("Usuario");
    expect(logError).toHaveBeenCalledWith("comentarios:autores", expect.any(String), ERROR_PG, expect.anything());
  });

  it("notificaciones: si fallan los autores se muestran con 'Alguien' y se registra", async () => {
    servidorFalso.responder("from:notificaciones", {
      data: [
        {
          id: "n1",
          tipo: "REACCION",
          id_actor: "u2",
          entidad_tipo: "comunidad_post",
          entidad_id: "p1",
          leida: false,
          creado_en: "2026-09-01T00:00:00Z",
        },
      ],
      error: null,
    });
    servidorFalso.responder("from:comunidad_autor_publico", FALLO);
    servidorFalso.responder("from:comunidad_posts", { data: [{ id: "p1", titulo: "Hola", slug: "hola" }], error: null });

    const notificaciones = await getNotificaciones("u1");

    expect(notificaciones).toHaveLength(1);
    expect(notificaciones[0].actorNombre).toBe("Alguien");
    expect(logError).toHaveBeenCalledWith("notificaciones:actores", expect.any(String), ERROR_PG, expect.anything());
  });
});

describe("Bloques que no deben decir 'no hay nada' cuando no se pudieron leer: null, no []", () => {
  it("comentarios: si falla la lectura devuelve null (la UI avisa con Reintentar), no [] ('Sé el primero')", async () => {
    servidorFalso.responder("from:comentarios", FALLO);

    expect(await getComentariosDeLeccion("l1", "c1", null)).toBeNull();
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("comentarios: sin error y sin comentarios sigue siendo [] (eso sí es 'aún no hay')", async () => {
    servidorFalso.responder("from:comentarios", { data: [], error: null });

    expect(await getComentariosDeLeccion("l1", "c1", null)).toEqual([]);
  });

  it("notas de la clase: si falla devuelve null, no [] ('Aún no tienes notas')", async () => {
    servidorFalso.responder("from:notas_leccion", FALLO);

    expect(await getNotasDeLeccion("l1", "u1")).toBeNull();
  });

  it("notas de la clase: sin sesión es [] sin consultar nada, y sin error y sin notas también", async () => {
    expect(await getNotasDeLeccion("l1", null)).toEqual([]);
    expect(servidorFalso.llamadas).toHaveLength(0);

    servidorFalso.responder("from:notas_leccion", { data: [], error: null });
    expect(await getNotasDeLeccion("l1", "u1")).toEqual([]);
  });

  it("'Todo el curso': si falla devuelve { error } (la pestaña ya lo muestra), no una lista vacía", async () => {
    servidorFalso.responder("from:notas_leccion", FALLO);

    expect(await listarNotasDelCurso(["6f1c0f5e-1111-4222-8333-444455556666"])).toEqual({
      error: "No pudimos cargar tus notas. Intenta de nuevo.",
    });
  });

  it("notificaciones: si falla la lista lanza (no devuelve [] = 'No tienes notificaciones')", async () => {
    servidorFalso.responder("from:notificaciones", FALLO);

    await expect(getNotificaciones("u1")).rejects.toThrow(/notificaciones:lista falló.*57014/);
  });

  it("notificaciones: el contador de no leídas degrada a 0 pero deja registro", async () => {
    servidorFalso.responder("from:notificaciones", { data: null, error: ERROR_PG, count: null });

    expect(await contarNotificacionesNoLeidas("u1")).toBe(0);
    expect(logError).toHaveBeenCalledWith("notificaciones:no-leidas", expect.any(String), ERROR_PG, expect.anything());
  });

  it("chrome del dashboard: si fallan las notificaciones entrega null (la campana avisa), sin tumbar el layout", async () => {
    servidorFalso.responder("from:notificaciones", { data: null, error: ERROR_PG, count: null });
    servidorFalso.responder("from:suscripciones", { data: null, error: null });
    servidorFalso.responder("from:certificados", { data: null, error: null, count: 0 });

    const chrome = await getDashboardChromeData({
      user: { id: "u1", email: "a@b.co" } as never,
      perfil: { nombre: "Ana", foto_url: null, rol: "ESTUDIANTE" } as never,
    });

    expect(chrome.notificaciones).toBeNull();
    expect(chrome.nombre).toBe("Ana");
  });
});
