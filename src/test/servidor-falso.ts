import { vi } from "vitest";

/**
 * Un "servidor" falso para probar Server Actions con vitest.
 * AUDIT-2026-09-15.md — P2-8, Fase 1.
 *
 * El problema que resuelve
 * ------------------------
 * Toda Server Action llama `createClient()` (lib/supabase/server.ts), que lee
 * `cookies()` de `next/headers`, y eso solo existe dentro de una petición real
 * de Next: desde vitest lanza. Por eso `src/actions/` no tenía un solo test —
 * el encabezado de scripts/canje-codigo-test.ts lo explica— y por eso lo que
 * sí se probaba era el lado de Postgres, no la capa TypeScript: que se mire la
 * sesión, que el id salga de `auth.getUser()` y no del cliente, en qué orden
 * se llaman las RPC, que un correo caído no rompa la operación.
 *
 * Qué hace
 * --------
 * Reemplaza los bordes del servidor —Supabase, `next/cache`,
 * `next/navigation`, `next/headers` y los SDK externos— por dobles que
 * REGISTRAN lo que la acción intentó hacer y devuelven lo que el test
 * configure. La lógica de la acción corre de verdad; lo único falso es el
 * mundo exterior.
 *
 * No reemplaza a scripts/rls-test.ts: aquí la base no existe, así que esto no
 * dice nada sobre RLS ni sobre las funciones SQL. Prueba la otra mitad.
 *
 * Uso
 * ---
 * `vi.mock` tiene que estar en el archivo de test (vitest lo iza al principio
 * del módulo), así que cada test declara qué bordes falsea delegando aquí:
 *
 *   vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
 *
 * y en `beforeEach` llama `servidorFalso.reiniciar()`.
 */

export type RespuestaFalsa = { data?: unknown; error?: unknown; count?: number | null };

export type TipoCliente = "sesion" | "admin";

export type LlamadaRegistrada = {
  cliente: TipoCliente;
  /** `from:perfiles`, `rpc:canjear_codigo_invitacion`, `auth:signInWithPassword`, `storage:portadas`… */
  operacion: string;
  argumentos: unknown[];
  /** Lo encadenado después: `select`, `eq`, `single`… con sus argumentos. */
  cadena: { metodo: string; argumentos: unknown[] }[];
};

/** Lo que lanza el `redirect()` falso, para que el test lea el destino. */
export class RedireccionFalsa extends Error {
  constructor(readonly destino: string) {
    super(`redirect(${destino})`);
    this.name = "RedireccionFalsa";
  }
}

const estado = {
  usuario: null as { id: string; email?: string; email_confirmed_at?: string | null } | null,
  respuestas: new Map<string, RespuestaFalsa>(),
  /** Respuestas que se consumen en orden antes de caer en `respuestas`. */
  colas: new Map<string, RespuestaFalsa[]>(),
  llamadas: [] as LlamadaRegistrada[],
  clientesCreados: { sesion: 0, admin: 0 } as Record<TipoCliente, number>,
  revalidaciones: [] as string[],
  /** Llamadas a SDK externos (Resend, Mux): `resend.emails.send`, `mux.video.assets.delete`… */
  efectosExternos: [] as string[],
};

export const servidorFalso = {
  reiniciar() {
    estado.usuario = null;
    estado.respuestas.clear();
    estado.colas.clear();
    estado.llamadas = [];
    estado.clientesCreados = { sesion: 0, admin: 0 };
    estado.revalidaciones = [];
    estado.efectosExternos = [];
  },

  /** Usuario que devuelve `auth.getUser()`. `null` = sin sesión. */
  conUsuario(usuario: typeof estado.usuario) {
    estado.usuario = usuario;
  },

  /** Respuesta para una operación (`rpc:nombre`, `from:tabla`, `auth:metodo`). */
  responder(operacion: string, respuesta: RespuestaFalsa) {
    estado.respuestas.set(operacion, respuesta);
  },

  /**
   * Respuestas distintas para llamadas sucesivas a la misma operación (una
   * acción que lee la misma tabla dos veces). Agotada la cola, se usa lo que
   * haya configurado `responder`, o la respuesta vacía.
   */
  responderEnOrden(operacion: string, respuestas: RespuestaFalsa[]) {
    estado.colas.set(operacion, [...respuestas]);
  },

  /** Todas las llamadas a una operación, en orden. */
  llamadasA(operacion: string): LlamadaRegistrada[] {
    return estado.llamadas.filter((l) => l.operacion === operacion);
  },

  /** Argumentos de la primera `rpc:` con ese nombre (el objeto `{ p_... }`). */
  argumentosDe(operacion: string): unknown {
    const llamada = estado.llamadas.find((l) => l.operacion === operacion);
    if (!llamada) throw new Error(`No hubo ninguna llamada a ${operacion}`);
    return llamada.argumentos[0];
  },

  /**
   * Argumentos de cada `.metodo(...)` encadenado a una operación, en orden:
   * `encadenado("from:pagos", "insert")[0][0]` es la fila insertada.
   */
  encadenado(operacion: string, metodo: string): unknown[][] {
    return estado.llamadas
      .filter((l) => l.operacion === operacion)
      .flatMap((l) => l.cadena.filter((c) => c.metodo === metodo).map((c) => c.argumentos));
  },

  get llamadas(): readonly LlamadaRegistrada[] {
    return estado.llamadas;
  },
  get clientesCreados(): Readonly<Record<TipoCliente, number>> {
    return estado.clientesCreados;
  },
  get revalidaciones(): readonly string[] {
    return estado.revalidaciones;
  },
  get efectosExternos(): readonly string[] {
    return estado.efectosExternos;
  },

  /** Nombres de operación en orden, para afirmar secuencias sin ruido. */
  operaciones(): string[] {
    return estado.llamadas.map((l) => l.operacion);
  },
};

function respuestaDe(operacion: string): RespuestaFalsa {
  const cola = estado.colas.get(operacion);
  if (cola && cola.length > 0) return cola.shift()!;
  return estado.respuestas.get(operacion) ?? { data: null, error: null };
}

/**
 * Consulta encadenable: `.select().eq().single()` en cualquier orden y
 * cantidad, y `await` en cualquier punto devuelve la respuesta configurada.
 * No interpreta los filtros — los registra, para que el test los afirme.
 */
function consulta(cliente: TipoCliente, operacion: string, argumentos: unknown[]): unknown {
  const llamada: LlamadaRegistrada = { cliente, operacion, argumentos, cadena: [] };
  estado.llamadas.push(llamada);

  const proxy: unknown = new Proxy(
    {},
    {
      get(_objetivo, propiedad) {
        if (propiedad === "then") {
          return (resolver: (v: unknown) => unknown, rechazar: (e: unknown) => unknown) =>
            Promise.resolve(respuestaDe(operacion)).then(resolver, rechazar);
        }
        return (...args: unknown[]) => {
          llamada.cadena.push({ metodo: String(propiedad), argumentos: args });
          // En el SDK real `getPublicUrl` es SÍNCRONO (no hace red): se usa sin
          // `await`, así que devolver la consulta encadenable rompería el
          // destructuring `{ data: { publicUrl } }`.
          if (propiedad === "getPublicUrl" && operacion.startsWith("storage:")) {
            const bucket = operacion.slice("storage:".length);
            return {
              data: { publicUrl: `https://proyecto.supabase.co/storage/v1/object/public/${bucket}/${String(args[0])}` },
            };
          }
          return proxy;
        };
      },
    },
  );
  return proxy;
}

/** `supabase.auth.*` y `supabase.auth.admin.*`. */
function auth(cliente: TipoCliente, prefijo = "auth"): unknown {
  return new Proxy(
    {},
    {
      get(_objetivo, propiedad) {
        const metodo = String(propiedad);
        if (metodo === "then") return undefined;
        if (metodo === "admin") return auth(cliente, "auth.admin");

        return async (...args: unknown[]) => {
          const operacion = `${prefijo}:${metodo}`;
          estado.llamadas.push({ cliente, operacion, argumentos: args, cadena: [] });

          if (estado.respuestas.has(operacion) || estado.colas.get(operacion)?.length) {
            return respuestaDe(operacion);
          }
          if (metodo === "getUser") return { data: { user: estado.usuario }, error: null };
          return { data: { user: estado.usuario, session: null }, error: null };
        };
      },
    },
  );
}

/**
 * Cliente de Supabase falso. Las fábricas de `vi.mock` lo usan por dentro;
 * se exporta para los tests que simulan un guard (`requireAdmin`) que
 * devuelve su propio `supabase`.
 */
export function crearCliente(tipo: TipoCliente) {
  estado.clientesCreados[tipo]++;
  return {
    from: (tabla: string) => consulta(tipo, `from:${tabla}`, [tabla]),
    rpc: (nombre: string, args?: unknown) => consulta(tipo, `rpc:${nombre}`, [args]),
    storage: { from: (bucket: string) => consulta(tipo, `storage:${bucket}`, [bucket]) },
    auth: auth(tipo),
  };
}

/**
 * Doble de un SDK externo: cualquier ruta de propiedades invocada
 * (`resend.emails.send(...)`) queda registrada y resuelve a `{}`.
 */
export function sdkFalso(nombre: string): unknown {
  const nivel = (ruta: string): unknown =>
    new Proxy(function () {}, {
      get(_objetivo, propiedad) {
        if (propiedad === "then") return undefined;
        return nivel(`${ruta}.${String(propiedad)}`);
      },
      apply() {
        estado.efectosExternos.push(ruta);
        return Promise.resolve({ data: {}, error: null });
      },
    });
  return nivel(nombre);
}

// ---------------------------------------------------------------------------
// Fábricas para `vi.mock`. Cada una es la forma del módulo real que reemplaza.
// ---------------------------------------------------------------------------

export function moduloSupabaseServer() {
  return { createClient: vi.fn(async () => crearCliente("sesion")) };
}

export function moduloSupabaseAdmin() {
  return { createAdminClient: vi.fn(() => crearCliente("admin")) };
}

export function moduloNextCache() {
  const registrar = (ruta: string) => {
    estado.revalidaciones.push(ruta);
  };
  return {
    revalidatePath: vi.fn(registrar),
    revalidateTag: vi.fn(registrar),
    updateTag: vi.fn(registrar),
    refresh: vi.fn(),
    unstable_cache: <T>(fn: T) => fn,
  };
}

export function moduloNextNavigation() {
  const redirigir = (destino: string) => {
    throw new RedireccionFalsa(destino);
  };
  return {
    redirect: vi.fn(redirigir),
    permanentRedirect: vi.fn(redirigir),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  };
}

export function moduloNextHeaders() {
  return {
    cookies: vi.fn(async () => ({
      get: () => undefined,
      getAll: () => [],
      has: () => false,
      set: () => {},
      delete: () => {},
    })),
    headers: vi.fn(async () => new Headers()),
  };
}

/** `@/lib/resend/client`: `new Resend(undefined)` lanza al importar. */
export function moduloResendCliente() {
  return { resend: sdkFalso("resend") };
}

/** `@/lib/mux/client`. */
export function moduloMuxCliente() {
  return { mux: sdkFalso("mux") };
}

/** `@/lib/log`: silencia la salida y no manda nada a Sentry. */
export function moduloLog() {
  return { logError: vi.fn(() => "evento-falso") };
}
