import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedireccionFalsa, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { eliminarMiCuenta } from "@/actions/perfil/eliminar-cuenta";
import { logError } from "@/lib/log";

/**
 * Eliminar la cuenta propia — P2-6 (AUDIT-2026-09-22.md). Es IRREVERSIBLE:
 * `solicitar_supresion_propia` anonimiza el perfil y borra las sesiones.
 *
 * Lo que se prueba es que nada irreversible ocurra antes de comprobar las
 * tres cosas que piden intención y autoría: el correo tecleado, la
 * contraseña actual (si la cuenta tiene una) y el límite de intentos. Una
 * acción que borre sin comprobar alguna es un botón para destruir la cuenta
 * de quien tenga la sesión abierta un minuto.
 */

const CORREO = "ana@uva.co";
const FOTO = "https://proyecto.supabase.co/storage/v1/object/public/avatares/estudiante-1/foto.webp";

/** Usuario de sesión con sus identidades: `email` = tiene contraseña. */
function sesionCon(proveedores: string[]) {
  servidorFalso.conUsuario({
    id: "estudiante-1",
    email: CORREO,
    identities: proveedores.map((provider) => ({ provider })),
  } as never);
}

function formulario(campos: Record<string, string>): FormData {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

const eliminar = (campos: Record<string, string> = {}) =>
  eliminarMiCuenta(null, formulario({ correo_confirmacion: CORREO, password_actual: "Secreta123!x", ...campos }));

/** Nada irreversible: ni la supresión, ni la foto, ni el cierre de sesión. */
function nadaIrreversible() {
  expect(servidorFalso.llamadasA("rpc:solicitar_supresion_propia")).toHaveLength(0);
  expect(servidorFalso.llamadasA("storage:avatares")).toHaveLength(0);
  expect(servidorFalso.llamadasA("auth:signOut")).toHaveLength(0);
}

async function destinoDe(accion: Promise<unknown>): Promise<string> {
  try {
    await accion;
  } catch (error) {
    if (error instanceof RedireccionFalsa) return error.destino;
    throw error;
  }
  throw new Error("La acción no redirigió");
}

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(logError).mockClear();
  sesionCon(["email"]);
  servidorFalso.responder("rpc:verificar_intentos_login", { data: { permitido: true, segundos_espera: 0 } });
  servidorFalso.responder("from:perfiles", { data: { foto_url: FOTO } });
});

describe("eliminarMiCuenta — antes de borrar nada", () => {
  it("sin sesión no toca nada", async () => {
    servidorFalso.conUsuario(null);

    expect(await eliminar()).toEqual({ error: "Tu sesión expiró. Vuelve a iniciar sesión." });
    nadaIrreversible();
  });

  it("el correo tecleado no coincide con el de la sesión: no borra", async () => {
    expect(await eliminar({ correo_confirmacion: "otra@uva.co" })).toEqual({
      error: "El correo no coincide con el de tu cuenta.",
    });
    nadaIrreversible();
    expect(servidorFalso.clientesCreados.admin).toBe(0);
  });

  it("el correo se compara sin distinguir mayúsculas ni espacios", async () => {
    await destinoDe(eliminar({ correo_confirmacion: "  ANA@UVA.CO " }));

    expect(servidorFalso.llamadasA("rpc:solicitar_supresion_propia")).toHaveLength(1);
  });

  it("cuenta con contraseña y sin contraseña en el formulario: la pide", async () => {
    expect(await eliminar({ password_actual: "" })).toEqual({ error: "Ingresa tu contraseña actual." });
    nadaIrreversible();
  });

  it("contraseña incorrecta: suma un intento fallido y no borra", async () => {
    servidorFalso.responder("auth:signInWithPassword", { data: {}, error: { message: "Invalid login credentials" } });

    expect(await eliminar()).toEqual({ error: "Tu contraseña actual no es correcta." });
    expect(servidorFalso.argumentosDe("rpc:registrar_login_fallido")).toEqual({ p_correo: CORREO });
    nadaIrreversible();
  });

  it("la contraseña se verifica contra el correo de la SESIÓN, no contra el del formulario", async () => {
    await destinoDe(eliminar());

    expect(servidorFalso.argumentosDe("auth:signInWithPassword")).toEqual({ email: CORREO, password: "Secreta123!x" });
  });

  it("con el límite de intentos agotado ni siquiera prueba la contraseña", async () => {
    servidorFalso.responder("rpc:verificar_intentos_login", { data: { permitido: false, segundos_espera: 300 } });

    expect(await eliminar()).toEqual({ error: "Demasiados intentos. Espera 5 minutos e intenta de nuevo." });
    expect(servidorFalso.llamadasA("auth:signInWithPassword")).toHaveLength(0);
    nadaIrreversible();
  });

  it("si la consulta del límite falla, BLOQUEA (falla cerrado)", async () => {
    servidorFalso.responder("rpc:verificar_intentos_login", { data: null, error: { message: "timeout" } });

    expect((await eliminar())?.error).toMatch(/No pudimos verificar tu acceso/);
    expect(servidorFalso.llamadasA("auth:signInWithPassword")).toHaveLength(0);
    nadaIrreversible();
  });

  it("una cuenta solo de Google no tiene contraseña que pedir: basta el correo", async () => {
    sesionCon(["google"]);

    await destinoDe(eliminar({ password_actual: "" }));

    expect(servidorFalso.llamadasA("auth:signInWithPassword")).toHaveLength(0);
    expect(servidorFalso.llamadasA("rpc:verificar_intentos_login")).toHaveLength(0);
    expect(servidorFalso.llamadasA("rpc:solicitar_supresion_propia")).toHaveLength(1);
  });
});

describe("eliminarMiCuenta — la supresión", () => {
  it("camino feliz: limpia intentos, borra la foto ANTES de la supresión, cierra sesión y redirige", async () => {
    expect(await destinoDe(eliminar())).toBe("/cuenta-eliminada");

    expect(servidorFalso.llamadasA("rpc:limpiar_intentos_login")).toHaveLength(1);
    expect(servidorFalso.encadenado("storage:avatares", "remove")).toEqual([[["estudiante-1/foto.webp"]]]);
    const orden = servidorFalso.operaciones();
    expect(orden.indexOf("storage:avatares")).toBeLessThan(orden.indexOf("rpc:solicitar_supresion_propia"));
    expect(orden.indexOf("rpc:solicitar_supresion_propia")).toBeLessThan(orden.indexOf("auth:signOut"));
    // La supresión corre con la SESIÓN: la RPC decide por auth.uid(), no por un id que mande la acción.
    expect(servidorFalso.llamadasA("rpc:solicitar_supresion_propia")[0].cliente).toBe("sesion");
  });

  it("una cuenta ADMINISTRADOR (42501 de la RPC) recibe el mensaje de la base y no se cierra su sesión", async () => {
    servidorFalso.responder("rpc:solicitar_supresion_propia", {
      error: { code: "42501", message: "Una cuenta de administrador no se puede eliminar desde aquí." },
    });

    expect(await eliminar()).toEqual({ error: "Una cuenta de administrador no se puede eliminar desde aquí." });
    expect(servidorFalso.llamadasA("auth:signOut")).toHaveLength(0);
  });

  it("un fallo real de la base NO se muestra tal cual: mensaje genérico y queda registrado", async () => {
    servidorFalso.responder("rpc:solicitar_supresion_propia", {
      error: { code: "57014", message: "canceling statement due to statement timeout" },
    });

    expect(await eliminar()).toEqual({ error: "No pudimos eliminar tu cuenta. Intenta de nuevo o contacta soporte." });
    expect(logError).toHaveBeenCalledWith(
      "eliminarMiCuenta",
      expect.any(String),
      expect.objectContaining({ code: "57014" }),
      { area: "cuenta" },
    );
    expect(servidorFalso.llamadasA("auth:signOut")).toHaveLength(0);
  });
});
