import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

/**
 * Segundo bloque de "error mostrado como vacío" (ver error-como-vacio.test.ts):
 * las lecturas de las que cuelgan el dashboard, el perfil, la comunidad, el
 * estado de los exámenes y la exportación de datos. Un fallo de la base debe
 * lanzar o devolver un error — nunca caer a una lista vacía, a "sin acceso" o
 * a un archivo de exportación incompleto.
 */
vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/resend/client", () => import("@/test/servidor-falso").then((m) => m.moduloResendCliente()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));

const { logError } = await import("@/lib/log");
const { getInicioData } = await import("@/lib/dashboard");
const { getEstadoExamenPorCurso } = await import("@/lib/examenes/estadoPorCurso");
const { getPerfilActual } = await import("@/lib/perfil");
const { resolverAccesoComunidad, getComunidadFeed } = await import("@/lib/comunidad");
const { exportarMisDatos } = await import("@/actions/perfil/exportar-datos");
const { responderPostComunidad } = await import("@/actions/comunidad/crear");

const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };
const FALLO = { data: null, error: ERROR_PG };
const USUARIO = { id: "u1", email: "ana@uva.co" };

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(logError).mockClear();
});

describe("Inicio del dashboard (getInicioData)", () => {
  it("falla la vista de progreso: lanza, no dice 'sin cursos en progreso'", async () => {
    servidorFalso.responder("from:progreso_cursos_estudiante", FALLO);
    await expect(getInicioData()).rejects.toThrow(/dashboard:progreso de cursos falló.*57014/);
  });

  it("falla la lista de escuelas: lanza, no muestra cero escuelas", async () => {
    servidorFalso.responder("from:progreso_cursos_estudiante", { data: [], error: null });
    servidorFalso.responder("from:categorias", FALLO);
    servidorFalso.responder("from:cursos", { data: [], error: null });
    await expect(getInicioData()).rejects.toThrow(/dashboard:escuelas falló/);
  });

  it("falla el conteo de cursos por escuela: lanza", async () => {
    servidorFalso.responder("from:progreso_cursos_estudiante", { data: [], error: null });
    servidorFalso.responder("from:categorias", { data: [], error: null });
    servidorFalso.responder("from:cursos", FALLO);
    await expect(getInicioData()).rejects.toThrow(/dashboard:conteo de cursos por escuela falló/);
  });
});

describe("Estado de los exámenes por curso", () => {
  it("falla `examenes`: lanza (si no, el curso saldría 'Completado' sin examen)", async () => {
    servidorFalso.responder("from:examenes", FALLO);
    const supabase = await (await import("@/lib/supabase/server")).createClient();
    await expect(getEstadoExamenPorCurso(supabase, ["c1"], "u1")).rejects.toThrow(/examenes:publicados por curso falló/);
  });

  it("falla `intentos_examen`: lanza (si no, quien ya aprobó vería 'examen pendiente')", async () => {
    servidorFalso.responder("from:examenes", { data: [{ id: "e1", id_curso: "c1" }], error: null });
    servidorFalso.responder("from:intentos_examen", FALLO);
    const supabase = await (await import("@/lib/supabase/server")).createClient();
    await expect(getEstadoExamenPorCurso(supabase, ["c1"], "u1")).rejects.toThrow(/intentos_examen:aprobados falló/);
  });

  it("sin error, un examen aprobado se refleja", async () => {
    servidorFalso.responder("from:examenes", { data: [{ id: "e1", id_curso: "c1" }], error: null });
    servidorFalso.responder("from:intentos_examen", { data: [{ id_examen: "e1" }], error: null });
    const supabase = await (await import("@/lib/supabase/server")).createClient();
    const estados = await getEstadoExamenPorCurso(supabase, ["c1"], "u1");
    expect(estados.get("c1")).toEqual({ requerido: true, aprobado: true });
  });
});

describe("Perfil de la sesión (getPerfilActual)", () => {
  it("falla la lectura: lanza, no devuelve perfil null (un admin pasaría por estudiante)", async () => {
    servidorFalso.conUsuario(USUARIO);
    servidorFalso.responder("from:perfiles", FALLO);
    await expect(getPerfilActual()).rejects.toThrow(/perfil:actual falló.*57014/);
  });

  it("perfil aún sin crear (PGRST116) sigue siendo null, no un fallo", async () => {
    servidorFalso.conUsuario(USUARIO);
    servidorFalso.responder("from:perfiles", { data: null, error: { code: "PGRST116", message: "0 rows" } });
    const { perfil } = await getPerfilActual();
    expect(perfil).toBeNull();
  });
});

describe("Acceso a Comunidad", () => {
  beforeEach(() => {
    servidorFalso.conUsuario(USUARIO);
    servidorFalso.responder("from:perfiles", { data: { rol: "ESTUDIANTE" }, error: null });
  });

  it("falla la RPC de acceso: lanza, no muestra el muro de suscripción", async () => {
    servidorFalso.responder("rpc:comunidad_tiene_acceso", FALLO);
    await expect(resolverAccesoComunidad()).rejects.toThrow(/comunidad:comunidad_tiene_acceso falló/);
  });

  it("falla la lectura de la suscripción: lanza, no dice 'SIN_SUSCRIPCION'", async () => {
    servidorFalso.responder("rpc:comunidad_tiene_acceso", { data: false, error: null });
    servidorFalso.responder("from:suscripciones", FALLO);
    await expect(resolverAccesoComunidad()).rejects.toThrow(/comunidad:suscripción del usuario falló/);
  });

  it("responder: si falla la RPC de acceso NO dice 'necesitas una suscripción', pide reintentar y registra", async () => {
    servidorFalso.responder("from:comunidad_posts", { data: { eliminado: false }, error: null });
    servidorFalso.responder("rpc:comunidad_tiene_acceso", FALLO);

    const resultado = await responderPostComunidad("p1", "Hola", "/dashboard/comunidad");

    expect(resultado).toEqual({ error: "No pudimos comprobar tu acceso a la comunidad. Intenta de nuevo." });
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("responder: sin acceso de verdad (sin error) sigue diciendo que necesita suscripción", async () => {
    servidorFalso.responder("from:comunidad_posts", { data: { eliminado: false }, error: null });
    servidorFalso.responder("rpc:comunidad_tiene_acceso", { data: false, error: null });

    const resultado = await responderPostComunidad("p1", "Hola", "/dashboard/comunidad");

    expect(resultado).toMatchObject({ error: expect.stringContaining("Necesitas una suscripción activa") });
  });
});

describe("Exportar mis datos", () => {
  const secciones = [
    "perfiles",
    "suscripciones",
    "inscripciones",
    "progreso",
    "certificados",
    "intentos_examen",
    "comentarios",
    "comunidad_posts",
    "comunidad_respuestas",
    "curso_calificaciones",
    "notificaciones",
    "notas_leccion",
  ];

  // La clave de cada sección en el registro no siempre es el nombre de la tabla.
  const NOMBRE_EN_EL_ARCHIVO: Record<string, string> = {
    curso_calificaciones: "calificaciones_de_curso",
    notas_leccion: "notas",
  };

  function todoBien() {
    servidorFalso.conUsuario(USUARIO);
    for (const tabla of secciones) {
      servidorFalso.responder(
        `from:${tabla}`,
        tabla === "perfiles" ? { data: { nombre: "Ana" }, error: null } : { data: [], error: null },
      );
    }
  }

  it("con todo bien entrega el archivo", async () => {
    todoBien();
    expect(await exportarMisDatos()).toMatchObject({ success: true });
  });

  it.each(secciones.filter((tabla) => tabla !== "perfiles"))(
    "si falla `%s` NO entrega una exportación incompleta: devuelve error y registra",
    async (tabla) => {
      todoBien();
      servidorFalso.responder(`from:${tabla}`, FALLO);

      expect(await exportarMisDatos()).toEqual({ error: "No pudimos armar tu exportación. Intenta de nuevo." });
      expect(logError).toHaveBeenCalledWith(
        "exportarMisDatos",
        expect.any(String),
        ERROR_PG,
        expect.objectContaining({ secciones: [NOMBRE_EN_EL_ARCHIVO[tabla] ?? tabla] }),
      );
    },
  );

  it("si falla la lectura del perfil también devuelve error", async () => {
    todoBien();
    servidorFalso.responder("from:perfiles", FALLO);
    expect(await exportarMisDatos()).toEqual({ error: "No pudimos armar tu exportación. Intenta de nuevo." });
  });
});

describe("Feed de Comunidad", () => {
  beforeEach(() => {
    servidorFalso.conUsuario(USUARIO);
  });

  it("si falla la lectura lanza: no devuelve un feed vacío ('Sé el primero en compartir algo')", async () => {
    servidorFalso.responder("rpc:buscar_feed_comunidad", FALLO);

    await expect(getComunidadFeed()).rejects.toThrow(/comunidad:feed falló.*57014/);
  });

  it("sin error y sin publicaciones sigue siendo un feed vacío (eso sí es 'no hay')", async () => {
    servidorFalso.responder("rpc:buscar_feed_comunidad", { data: [], error: null });

    await expect(getComunidadFeed()).resolves.toEqual({ posts: [], pagina: 1, totalPaginas: 1 });
  });
});
