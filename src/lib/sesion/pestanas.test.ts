import { afterEach, describe, expect, it, vi } from "vitest";
import { avisarPestanas, escucharPestanas, mismoCorreo, reaccionAlCambio, usuarioDeCookies, type AvisoPestanas } from "./pestanas";

const ID = "6f1c2a9e-0b7d-4c1e-9a3f-2d8e5b7c4a10";

function base64url(texto: string): string {
  return Buffer.from(texto, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function cookieDeSesion(sesion: object): string {
  return `base64-${base64url(JSON.stringify(sesion))}`;
}

describe("usuarioDeCookies", () => {
  it("sin cookie de sesión devuelve null", () => {
    expect(usuarioDeCookies("")).toBeNull();
    expect(usuarioDeCookies("uva-sidebar-colapsado=1; _ga=GA1.1")).toBeNull();
  });

  it("lee el id de la cookie en base64 (formato de @supabase/ssr), con tildes en los datos", () => {
    const valor = cookieDeSesion({ access_token: "x", user: { id: ID, user_metadata: { nombre: "Laura Mejía" } } });
    expect(usuarioDeCookies(`otra=1; sb-tmvmthdwapegypveaosd-auth-token=${valor}`)).toBe(ID);
  });

  it("une la cookie partida en trozos .0, .1 en orden", () => {
    const valor = cookieDeSesion({ user: { id: ID }, relleno: "a".repeat(200) });
    const mitad = Math.floor(valor.length / 2);
    const cookies = `sb-abc-auth-token.1=${valor.slice(mitad)}; sb-abc-auth-token.0=${valor.slice(0, mitad)}`;
    expect(usuarioDeCookies(cookies)).toBe(ID);
  });

  it("acepta el formato JSON sin base64 y codificado para URL", () => {
    const valor = encodeURIComponent(JSON.stringify({ user: { id: ID } }));
    expect(usuarioDeCookies(`sb-abc-auth-token=${valor}`)).toBe(ID);
  });

  it("si la sesión no trae `user`, usa el `sub` del token", () => {
    const token = `cabecera.${base64url(JSON.stringify({ sub: ID }))}.firma`;
    expect(usuarioDeCookies(`sb-abc-auth-token=${cookieDeSesion({ access_token: token })}`)).toBe(ID);
  });

  it("no confunde el verificador de PKCE con una sesión", () => {
    expect(usuarioDeCookies("sb-abc-auth-token-code-verifier=xyz")).toBeNull();
  });

  it("con una cookie ilegible igual reporta que hay sesión", () => {
    expect(usuarioDeCookies("sb-abc-auth-token=base64-%%%")).toBe("con-sesion");
  });
});

describe("reaccionAlCambio", () => {
  it("sin cambio, nada", () => {
    expect(reaccionAlCambio("/dashboard", ID, ID)).toBe("ninguna");
    expect(reaccionAlCambio("/login", null, null)).toBe("ninguna");
  });

  it("en login, registro o recuperar, entrar en otra pestaña lleva al destino", () => {
    expect(reaccionAlCambio("/login", null, ID)).toBe("ir-al-destino");
    expect(reaccionAlCambio("/recuperar", null, ID)).toBe("ir-al-destino");
    expect(reaccionAlCambio("/registro", null, ID)).toBe("ir-al-destino");
  });

  it("en login, cerrar sesión en otra pestaña no hace nada", () => {
    expect(reaccionAlCambio("/login", ID, null)).toBe("ninguna");
  });

  it("en un panel, cerrar sesión o cambiar de cuenta recarga la página entera", () => {
    expect(reaccionAlCambio("/dashboard/cursos", ID, null)).toBe("recargar");
    expect(reaccionAlCambio("/admin", null, ID)).toBe("recargar");
    expect(reaccionAlCambio("/admin/usuarios", ID, "otro-id")).toBe("recargar");
  });

  it("no toca /actualizar-password, que vive de la sesión del enlace, ni las páginas públicas", () => {
    expect(reaccionAlCambio("/actualizar-password", ID, null)).toBe("ninguna");
    expect(reaccionAlCambio("/auth/confirm", null, ID)).toBe("ninguna");
    expect(reaccionAlCambio("/catalogo", ID, null)).toBe("ninguna");
  });

  it("no confunde rutas que solo empiezan igual", () => {
    expect(reaccionAlCambio("/loginx", null, ID)).toBe("ninguna");
    expect(reaccionAlCambio("/administracion", ID, null)).toBe("ninguna");
  });
});

describe("mismoCorreo", () => {
  it("ignora mayúsculas y espacios", () => {
    expect(mismoCorreo(" Laura@Uva.test ", "laura@uva.test")).toBe(true);
  });

  it("dos correos distintos o vacíos no coinciden", () => {
    expect(mismoCorreo("a@uva.test", "b@uva.test")).toBe(false);
    expect(mismoCorreo("", "")).toBe(false);
    expect(mismoCorreo(null, undefined)).toBe(false);
  });
});

describe("avisar y escuchar entre pestañas", () => {
  afterEach(() => vi.unstubAllGlobals());

  function ventanaFalsa() {
    const almacen = new Map<string, string>();
    const oyentes = new Set<(e: StorageEvent) => void>();
    return {
      localStorage: {
        getItem: (k: string) => almacen.get(k) ?? null,
        setItem: (k: string, v: string) => void almacen.set(k, v),
      },
      addEventListener: (_: string, f: (e: StorageEvent) => void) => void oyentes.add(f),
      removeEventListener: (_: string, f: (e: StorageEvent) => void) => void oyentes.delete(f),
      /** Simula el evento `storage` que el navegador entrega a OTRA pestaña. */
      emitirStorage: (key: string, newValue: string) => oyentes.forEach((f) => f({ key, newValue } as StorageEvent)),
      almacen,
    };
  }

  it("un aviso llega a quien escucha por BroadcastChannel", async () => {
    vi.stubGlobal("window", ventanaFalsa());
    const recibidos: AvisoPestanas[] = [];
    const dejar = escucharPestanas((a) => recibidos.push(a));
    avisarPestanas({ tipo: "contrasena-guardada", correo: "laura@uva.test" });
    await vi.waitFor(() => expect(recibidos).toHaveLength(1));
    expect(recibidos[0]).toEqual({ tipo: "contrasena-guardada", correo: "laura@uva.test" });
    dejar();
  });

  it("también llega por el respaldo de localStorage, e ignora valores ajenos", () => {
    const ventana = ventanaFalsa();
    vi.stubGlobal("window", ventana);
    vi.stubGlobal("BroadcastChannel", undefined);
    const recibidos: AvisoPestanas[] = [];
    const dejar = escucharPestanas((a) => recibidos.push(a));
    ventana.emitirStorage("uva-pestanas-aviso", JSON.stringify({ tipo: "correo-confirmado", correo: "a@uva.test", t: 1 }));
    ventana.emitirStorage("uva-pestanas-aviso", JSON.stringify({ tipo: "otra-cosa" }));
    ventana.emitirStorage("uva-pestanas-aviso", "no es json");
    ventana.emitirStorage("otra-clave", JSON.stringify({ tipo: "acceso-cambio" }));
    expect(recibidos).toEqual([{ tipo: "correo-confirmado", correo: "a@uva.test", t: 1 }]);
    dejar();
  });

  it("avisar guarda el respaldo con marca de tiempo aunque no haya BroadcastChannel", () => {
    const ventana = ventanaFalsa();
    vi.stubGlobal("window", ventana);
    vi.stubGlobal("BroadcastChannel", undefined);
    avisarPestanas({ tipo: "acceso-cambio" });
    const guardado = JSON.parse(ventana.almacen.get("uva-pestanas-aviso") ?? "{}");
    expect(guardado.tipo).toBe("acceso-cambio");
    expect(typeof guardado.t).toBe("number");
  });
});
