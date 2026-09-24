import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/resend", () => ({ enviarCorreoPasswordActualizada: vi.fn() }));
vi.mock("@/lib/fotoPerfilServidor", () => ({ procesarFotoPerfil: vi.fn() }));

import { cambiarPassword } from "@/actions/perfil/cambiar-password";
import { eliminarFotoPerfil, subirFotoPerfil } from "@/actions/perfil/foto";
import { actualizarPerfil } from "@/actions/perfil/actualizar";
import { enviarCorreoPasswordActualizada } from "@/lib/resend";
import { procesarFotoPerfil } from "@/lib/fotoPerfilServidor";
import { logError } from "@/lib/log";

/**
 * Perfil — AUDIT-2026-09-15.md, P2-8 Fase 3.
 *
 * Tres acciones que un estudiante ejecuta sobre SÍ MISMO, y cuyo riesgo es
 * justamente que dejen de ser "sobre sí mismo": que la contraseña se cambie
 * sin comprobar la actual, que el formulario cuele columnas que no debería
 * (`rol`, `estado`), o que la foto se escriba o borre fuera de su carpeta.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co" };
const URL_AVATAR = (ruta: string) => `https://proyecto.supabase.co/storage/v1/object/public/avatares/${ruta}`;

function formulario(campos: Record<string, string>): FormData {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
  vi.mocked(logError).mockClear();
});

describe("cambiarPassword", () => {
  const VALIDO = { password_actual: "Vieja12345!x", password_nueva: "Nueva12345!x", password_nueva2: "Nueva12345!x" };
  const cambiar = (campos: Partial<typeof VALIDO> = {}) => cambiarPassword(null, formulario({ ...VALIDO, ...campos }));

  beforeEach(() => {
    servidorFalso.responder("rpc:verificar_intentos_login", { data: { permitido: true, segundos_espera: 0 } });
    vi.mocked(enviarCorreoPasswordActualizada).mockReset().mockResolvedValue({ success: true, id: "c-1" });
  });

  it.each([
    ["sin contraseña actual", { password_actual: "" }, "Ingresa tu contraseña actual."],
    ["nueva débil", { password_nueva: "corta", password_nueva2: "corta" }, "La contraseña nueva no cumple los requisitos."],
    ["confirmación distinta", { password_nueva2: "Otra12345!xy" }, "Las contraseñas nuevas no coinciden."],
    [
      "nueva igual a la actual",
      { password_actual: "Nueva12345!x" },
      "La contraseña nueva debe ser distinta de la actual.",
    ],
  ])("%s: no toca la base", async (_caso, campos, mensaje) => {
    expect(await cambiar(campos)).toEqual({ error: mensaje });
    expect(servidorFalso.clientesCreados).toEqual({ sesion: 0, admin: 0 });
  });

  it("la contraseña actual se verifica contra el correo de la SESIÓN antes de cambiar nada", async () => {
    await cambiarPassword(null, formulario({ ...VALIDO, email: "otra-persona@uva.co" }));

    expect(servidorFalso.argumentosDe("rpc:verificar_intentos_login")).toEqual({ p_correo: ESTUDIANTE.email });
    const [reauth] = servidorFalso.llamadasA("auth:signInWithPassword");
    expect(reauth.argumentos[0]).toEqual({ email: ESTUDIANTE.email, password: VALIDO.password_actual });

    const operaciones = servidorFalso.operaciones();
    expect(operaciones.indexOf("auth:signInWithPassword")).toBeLessThan(operaciones.indexOf("auth:updateUser"));
  });

  it("contraseña actual incorrecta: NO la cambia y suma un intento fallido", async () => {
    servidorFalso.responder("auth:signInWithPassword", { data: null, error: { message: "Invalid login credentials" } });

    expect(await cambiar()).toEqual({ error: "Tu contraseña actual no es correcta." });
    expect(servidorFalso.llamadasA("auth:updateUser")).toHaveLength(0);
    expect(servidorFalso.argumentosDe("rpc:registrar_login_fallido")).toEqual({ p_correo: ESTUDIANTE.email });
    expect(enviarCorreoPasswordActualizada).not.toHaveBeenCalled();
  });

  it("bloqueado por intentos: ni siquiera prueba la contraseña actual", async () => {
    // Si la probara, este formulario sería una forma de adivinar contraseñas
    // saltándose el límite del login (comparten contador por correo).
    servidorFalso.responder("rpc:verificar_intentos_login", { data: { permitido: false, segundos_espera: 90 } });

    expect(await cambiar()).toEqual({ error: "Demasiados intentos. Espera 2 minutos e intenta de nuevo." });
    expect(servidorFalso.llamadasA("auth:signInWithPassword")).toHaveLength(0);
  });

  it("si la consulta del límite falla, BLOQUEA: no prueba la contraseña (P2-6, falla cerrado)", async () => {
    servidorFalso.responder("rpc:verificar_intentos_login", { data: null, error: { message: "timeout" } });

    expect((await cambiar())?.error).toMatch(/No pudimos verificar tu acceso/);
    expect(servidorFalso.llamadasA("auth:signInWithPassword")).toHaveLength(0);
    expect(servidorFalso.llamadasA("auth:updateUser")).toHaveLength(0);
  });

  it("éxito: limpia intentos, cambia la contraseña y avisa por correo", async () => {
    expect(await cambiar()).toEqual({ success: true });
    expect(servidorFalso.llamadasA("auth:updateUser")[0].argumentos[0]).toEqual({ password: VALIDO.password_nueva });
    expect(servidorFalso.llamadasA("rpc:limpiar_intentos_login")).toHaveLength(1);
    expect(enviarCorreoPasswordActualizada).toHaveBeenCalledWith(ESTUDIANTE.email);
  });

  it("si el aviso por correo falla, el cambio ya hecho se reporta como éxito", async () => {
    vi.mocked(enviarCorreoPasswordActualizada).mockResolvedValue({ success: false, error: "Resend caído" });

    expect(await cambiar()).toEqual({ success: true });
    expect(logError).toHaveBeenCalledWith(
      "cambiarPassword",
      "enviarCorreoPasswordActualizada falló",
      expect.any(Error),
      { area: "email" },
    );
  });
});

describe("actualizarPerfil", () => {
  it("el UPDATE solo lleva nombre, celular y país — `rol` o `estado` colados en el formulario no llegan", async () => {
    const resultado = await actualizarPerfil(
      null,
      formulario({ nombre: " Ana ", celular: "300 123 4567", pais: "CO", rol: "ADMINISTRADOR", estado: "ACTIVO", id: "otra" }),
    );

    expect(resultado).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:perfiles", "update")).toEqual([
      [{ nombre: "Ana", celular: "+57 300 123 4567", pais: "Colombia" }],
    ]);
    expect(servidorFalso.encadenado("from:perfiles", "eq")).toEqual([["id", ESTUDIANTE.id]]);
  });

  it("sin celular guarda país y celular en null", async () => {
    await actualizarPerfil(null, formulario({ nombre: "Ana", celular: "", pais: "CO" }));

    expect(servidorFalso.encadenado("from:perfiles", "update")[0][0]).toEqual({ nombre: "Ana", celular: null, pais: null });
  });

  it.each([
    ["nombre vacío", { nombre: "  ", celular: "" }, "El nombre no puede estar vacío."],
    ["celular con letras", { nombre: "Ana", celular: "300-abc" }, "El celular no es válido. Usa solo dígitos, espacios y guiones."],
  ])("%s: no escribe", async (_caso, campos, mensaje) => {
    expect(await actualizarPerfil(null, formulario(campos))).toEqual({ error: mensaje });
    expect(servidorFalso.clientesCreados.sesion).toBe(0);
  });
});

describe("foto de perfil", () => {
  const FOTO = { cuerpo: new Uint8Array([1, 2, 3]), contentType: "image/webp", extension: "webp" };

  function conArchivo(): FormData {
    const datos = new FormData();
    datos.set("archivo", new File([new Uint8Array([1])], "yo.png", { type: "image/png" }));
    return datos;
  }

  function rutaSubida(): string {
    const [subida] = servidorFalso.encadenado("storage:avatares", "upload");
    return subida[0] as string;
  }

  beforeEach(() => {
    vi.mocked(procesarFotoPerfil).mockReset().mockResolvedValue({ foto: FOTO } as never);
  });

  it("sube dentro de la carpeta del usuario de la sesión y guarda la URL en SU perfil", async () => {
    servidorFalso.responder("from:perfiles", { data: { foto_url: null } });

    const resultado = await subirFotoPerfil(conArchivo());

    const ruta = rutaSubida();
    // La policy de Storage de `avatares` solo deja escribir en `<uid>/…`.
    expect(ruta).toMatch(new RegExp(`^${ESTUDIANTE.id}/[0-9a-f-]{36}\\.webp$`));
    expect(resultado).toEqual({ success: true, url: URL_AVATAR(ruta) });
    expect(servidorFalso.encadenado("from:perfiles", "update")).toEqual([[{ foto_url: URL_AVATAR(ruta) }]]);
    expect(servidorFalso.encadenado("from:perfiles", "eq")).toEqual([
      ["id", ESTUDIANTE.id],
      ["id", ESTUDIANTE.id],
    ]);
    expect(servidorFalso.revalidaciones).toEqual(["/dashboard/perfil", "/admin/configuracion"]);
  });

  it("reemplaza: borra la foto anterior DESPUÉS de guardar la nueva", async () => {
    servidorFalso.responder("from:perfiles", { data: { foto_url: URL_AVATAR(`${ESTUDIANTE.id}/vieja.webp`) } });

    await subirFotoPerfil(conArchivo());

    expect(servidorFalso.encadenado("storage:avatares", "remove")).toEqual([[[`${ESTUDIANTE.id}/vieja.webp`]]]);
  });

  it("una foto_url externa (no de nuestro bucket) no se intenta borrar", async () => {
    servidorFalso.responder("from:perfiles", { data: { foto_url: "https://lh3.googleusercontent.com/foto" } });

    await subirFotoPerfil(conArchivo());

    expect(servidorFalso.encadenado("storage:avatares", "remove")).toEqual([]);
  });

  it("si no se pudo guardar la URL, borra lo recién subido y conserva la anterior", async () => {
    servidorFalso.responderEnOrden("from:perfiles", [
      { data: { foto_url: URL_AVATAR(`${ESTUDIANTE.id}/vieja.webp`) } },
      { error: { message: "update falló" } },
    ]);

    expect(await subirFotoPerfil(conArchivo())).toEqual({ error: "No pudimos guardar la foto." });
    expect(servidorFalso.encadenado("storage:avatares", "remove")).toEqual([[[rutaSubida()]]]);
  });

  it("un archivo que no pasa el procesamiento no sube nada", async () => {
    vi.mocked(procesarFotoPerfil).mockResolvedValue({ error: "Formato no soportado." } as never);

    expect(await subirFotoPerfil(conArchivo())).toEqual({ error: "Formato no soportado." });
    expect(servidorFalso.llamadasA("storage:avatares")).toHaveLength(0);
  });

  it("sin archivo no procesa ni sube", async () => {
    expect(await subirFotoPerfil(new FormData())).toEqual({ error: "Selecciona una imagen." });
    expect(procesarFotoPerfil).not.toHaveBeenCalled();
  });

  it("eliminar: pone foto_url en null en SU perfil y borra el archivo", async () => {
    servidorFalso.responder("from:perfiles", { data: { foto_url: URL_AVATAR(`${ESTUDIANTE.id}/actual.webp`) } });

    expect(await eliminarFotoPerfil()).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:perfiles", "update")).toEqual([[{ foto_url: null }]]);
    expect(servidorFalso.encadenado("storage:avatares", "remove")).toEqual([[[`${ESTUDIANTE.id}/actual.webp`]]]);
  });

  it("eliminar sin foto no escribe nada", async () => {
    servidorFalso.responder("from:perfiles", { data: { foto_url: null } });

    expect(await eliminarFotoPerfil()).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:perfiles", "update")).toEqual([]);
  });
});
