import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedireccionFalsa, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("next/headers", () => import("@/test/servidor-falso").then((m) => m.moduloNextHeaders()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { cookies } from "next/headers";
import { confirmarEnlace } from "@/actions/auth/confirmar-enlace";
import { COOKIE_CORREO_CONFIRMADO, leerCorreoConfirmado } from "@/lib/correo-confirmado";

/**
 * Enlaces de registro: al confirmar van a "¡Correo confirmado!" con el carné
 * (cookie de corta vida) y, si no sirven, a "Este enlace ya venció". Los de
 * recuperar contraseña siguen yendo a su destino o a /login?error=.
 */

async function destinoDe(accion: () => Promise<unknown>): Promise<string> {
  try {
    await accion();
  } catch (error) {
    if (error instanceof RedireccionFalsa) return error.destino;
    throw error;
  }
  throw new Error("La acción no llamó a redirect()");
}

function formulario(campos: Record<string, string>): FormData {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

const ENLACE_FALLIDO = {
  data: { user: null, session: null },
  error: { name: "AuthApiError", message: "Email link is invalid or has expired", code: "otp_expired", status: 403 },
};

let cookiesPuestas: { nombre: string; valor: string; opciones: Record<string, unknown> }[];

beforeEach(() => {
  servidorFalso.reiniciar();
  cookiesPuestas = [];
  vi.mocked(cookies).mockImplementation(async () => {
    const tienda = {
      get: () => undefined,
      getAll: () => [],
      has: () => false,
      set: (nombre: string, valor: string, opciones: Record<string, unknown>) => {
        cookiesPuestas.push({ nombre, valor, opciones });
      },
      delete: () => {},
    };
    return tienda as unknown as Awaited<ReturnType<typeof cookies>>;
  });
});

describe("confirmarEnlace con un enlace de registro", () => {
  it("al confirmar va a ¡Correo confirmado! y deja el carné en una cookie httpOnly", async () => {
    servidorFalso.responder("auth:verifyOtp", {
      data: { user: { id: "u-1", email: "laura@obra.co", user_metadata: { nombre: "Laura Gómez" } }, session: null },
      error: null,
    });

    const destino = await destinoDe(() =>
      confirmarEnlace(
        formulario({
          tokenHash: "hash",
          type: "signup",
          next: "http://localhost:3000/login?signout=1&email=laura%40obra.co",
          email: "laura@obra.co",
        }),
      ),
    );

    expect(destino).toBe(`/auth/confirm?estado=confirmada&next=${encodeURIComponent("/login?email=laura%40obra.co")}`);
    expect(cookiesPuestas).toHaveLength(1);
    const [cookie] = cookiesPuestas;
    expect(cookie.nombre).toBe(COOKIE_CORREO_CONFIRMADO);
    expect(cookie.opciones).toMatchObject({ httpOnly: true, path: "/auth/confirm" });
    expect(leerCorreoConfirmado(cookie.valor)).toEqual({ nombre: "Laura Gómez", correo: "laura@obra.co" });
    // signout=1: la sesión del enlace se cierra antes de redirigir.
    expect(servidorFalso.operaciones()).toContain("auth:signOut");
  });

  it("si el enlace venció va a Este enlace ya venció con el correo, para pedir uno nuevo", async () => {
    servidorFalso.responder("auth:verifyOtp", ENLACE_FALLIDO);

    const destino = await destinoDe(() =>
      confirmarEnlace(
        formulario({ tokenHash: "hash", type: "signup", next: "/login?signout=1", email: "laura@obra.co" }),
      ),
    );

    expect(destino).toBe("/auth/confirm?estado=vencido&email=laura%40obra.co");
    expect(cookiesPuestas).toHaveLength(0);
  });

  it("sin correo en el enlace, va a la pantalla de vencido sin el parámetro", async () => {
    servidorFalso.responder("auth:verifyOtp", ENLACE_FALLIDO);

    const destino = await destinoDe(() =>
      confirmarEnlace(formulario({ tokenHash: "hash", type: "email", next: "/login?signout=1" })),
    );

    expect(destino).toBe("/auth/confirm?estado=vencido");
  });
});

describe("confirmarEnlace con un enlace de recuperar contraseña (sin cambios)", () => {
  it("al confirmar va directo a su destino, sin cookie del carné", async () => {
    const destino = await destinoDe(() =>
      confirmarEnlace(formulario({ tokenHash: "hash", type: "recovery", next: "/actualizar-password" })),
    );

    expect(destino).toBe("/actualizar-password");
    expect(cookiesPuestas).toHaveLength(0);
  });

  it("si el enlace venció sigue yendo a /login?error=enlace_invalido", async () => {
    servidorFalso.responder("auth:verifyOtp", ENLACE_FALLIDO);

    const destino = await destinoDe(() =>
      confirmarEnlace(formulario({ tokenHash: "hash", type: "recovery", next: "/actualizar-password" })),
    );

    expect(destino).toBe("/login?error=enlace_invalido");
  });
});

describe("leerCorreoConfirmado", () => {
  it("rechaza lo que no es la cookie que deja confirmarEnlace", () => {
    expect(leerCorreoConfirmado(undefined)).toBeNull();
    expect(leerCorreoConfirmado("no es json")).toBeNull();
    expect(leerCorreoConfirmado(JSON.stringify({ nombre: "Ana" }))).toBeNull();
    expect(leerCorreoConfirmado(JSON.stringify({ correo: "ana@uva.co", nombre: 3 }))).toEqual({
      nombre: "",
      correo: "ana@uva.co",
    });
  });
});
