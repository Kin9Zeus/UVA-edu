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
    expect(comentarios[0].texto).toBe("Muy buena clase");
    expect(comentarios[0].autor).toBe("Usuario");
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
