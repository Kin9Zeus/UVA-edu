/**
 * Avisos entre pestañas del mismo navegador.
 *
 * Los enlaces de los correos (confirmar cuenta, recuperar contraseña) siempre
 * abren una pestaña nueva: la app de correo decide eso. La pestaña donde se
 * pidió el enlace se quedaba en "revisa tu correo" aunque en la otra ya se
 * hubiera terminado todo. Con estos avisos, la pestaña vieja se entera y
 * avanza sola.
 *
 * Va por BroadcastChannel y, como respaldo, por el evento `storage` de
 * localStorage (los dos llegan solo a las OTRAS pestañas del mismo origen).
 * Quien escucha puede recibir el mismo aviso dos veces: los manejadores deben
 * ser idempotentes. Todo acceso al almacenamiento va en try/catch: en una
 * ventana privada o con los datos del sitio bloqueados puede lanzar.
 *
 * Solo sirve dentro del mismo navegador: entre dispositivos no hay forma
 * limpia sin preguntarle al servidor por un correo, y eso revelaría si está
 * registrado (la pantalla de recuperar lo oculta a propósito).
 */

export type AvisoPestanas =
  /** Se confirmó el correo de una cuenta nueva (la sesión del enlace ya se cerró). */
  | { tipo: "correo-confirmado"; correo: string }
  /** Se guardó una contraseña nueva desde el enlace de recuperación. */
  | { tipo: "contrasena-guardada"; correo: string }
  /** Cambió el acceso a cursos de la sesión actual (canje de un código). */
  | { tipo: "acceso-cambio" };

const CANAL = "uva-pestanas";
const CLAVE_AVISO = "uva-pestanas-aviso";
/** Usuario con sesión en este navegador según la última pestaña que cargó. */
export const CLAVE_USUARIO = "uva-pestanas-usuario";

export function avisarPestanas(aviso: AvisoPestanas): void {
  if (typeof window === "undefined") return;
  try {
    const canal = new BroadcastChannel(CANAL);
    canal.postMessage(aviso);
    canal.close();
  } catch {
    // Sin BroadcastChannel queda el respaldo de localStorage.
  }
  try {
    // La marca de tiempo hace que el valor cambie siempre: el evento
    // `storage` solo se dispara si el valor es distinto al anterior.
    window.localStorage.setItem(CLAVE_AVISO, JSON.stringify({ ...aviso, t: Date.now() }));
  } catch {
    // Sin almacenamiento, el aviso llega solo por BroadcastChannel.
  }
}

function esAviso(valor: unknown): valor is AvisoPestanas {
  if (!valor || typeof valor !== "object") return false;
  const { tipo, correo } = valor as { tipo?: unknown; correo?: unknown };
  if (tipo === "acceso-cambio") return true;
  return (tipo === "correo-confirmado" || tipo === "contrasena-guardada") && typeof correo === "string";
}

export function escucharPestanas(alAviso: (aviso: AvisoPestanas) => void): () => void {
  let canal: BroadcastChannel | null = null;
  try {
    canal = new BroadcastChannel(CANAL);
    canal.onmessage = (evento) => {
      if (esAviso(evento.data)) alAviso(evento.data);
    };
  } catch {
    canal = null;
  }
  function alStorage(evento: StorageEvent) {
    if (evento.key !== CLAVE_AVISO || !evento.newValue) return;
    try {
      const valor: unknown = JSON.parse(evento.newValue);
      if (esAviso(valor)) alAviso(valor);
    } catch {
      // Valor ajeno o corrupto: se ignora.
    }
  }
  window.addEventListener("storage", alStorage);
  return () => {
    canal?.close();
    window.removeEventListener("storage", alStorage);
  };
}

export function mismoCorreo(a: string | null | undefined, b: string | null | undefined): boolean {
  const normalizar = (c: string | null | undefined) => (c ?? "").trim().toLowerCase();
  return normalizar(a) !== "" && normalizar(a) === normalizar(b);
}

/** Valor que se guarda cuando hay sesión pero no se pudo leer el id. */
const CON_SESION = "con-sesion";

function decodificarBase64(texto: string): string {
  const base64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const relleno = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binario = atob(relleno);
  return new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
}

/**
 * Id del usuario con sesión según las cookies de Supabase (`sb-<ref>-auth-token`,
 * a veces partida en `.0`, `.1`...), o `null` sin sesión.
 *
 * Solo para decidir si una pestaña debe recargarse: no es una comprobación de
 * seguridad (eso lo hacen el proxy y RLS en el servidor). Lee la cookie en vez
 * de usar el cliente de Supabase para no cargarlo en todas las páginas.
 */
export function usuarioDeCookies(cookies: string): string | null {
  const partes = new Map<string, Map<number, string>>();
  for (const par of cookies.split(";")) {
    const igual = par.indexOf("=");
    if (igual === -1) continue;
    const nombre = par.slice(0, igual).trim();
    const coincidencia = nombre.match(/^(sb-[a-z0-9]+-auth-token)(?:\.(\d+))?$/);
    if (!coincidencia) continue;
    const base = coincidencia[1];
    const indice = coincidencia[2] === undefined ? -1 : Number(coincidencia[2]);
    if (!partes.has(base)) partes.set(base, new Map());
    partes.get(base)!.set(indice, par.slice(igual + 1).trim());
  }
  if (partes.size === 0) return null;

  // Una sola cookie de sesión por proyecto; si hubiera más, la primera.
  const trozos = [...partes.values()][0];
  const valor = trozos.has(-1)
    ? trozos.get(-1)!
    : [...trozos.entries()].sort(([a], [b]) => a - b).map(([, v]) => v).join("");
  if (!valor) return null;

  try {
    let texto = decodeURIComponent(valor);
    if (texto.startsWith("base64-")) texto = decodificarBase64(texto.slice("base64-".length));
    const sesion = JSON.parse(texto) as { user?: { id?: unknown }; access_token?: unknown };
    if (typeof sesion.user?.id === "string") return sesion.user.id;
    if (typeof sesion.access_token === "string") {
      const carga = JSON.parse(decodificarBase64(sesion.access_token.split(".")[1] ?? "")) as { sub?: unknown };
      if (typeof carga.sub === "string") return carga.sub;
    }
  } catch {
    // Formato inesperado: hay sesión, pero no sabemos de quién.
  }
  return CON_SESION;
}

// `/recuperar` no está aquí a propósito: el enlace del correo abre una sesión de
// recuperación en este mismo navegador, y la pestaña que pidió el enlace la
// tomaría por un inicio de sesión y saltaría al panel antes de que se guarde la
// contraseña nueva. Esa pestaña avanza sola con el aviso "contrasena-guardada".
const RUTAS_DE_ACCESO = ["/login", "/registro"];
const RUTAS_CON_SESION = ["/dashboard", "/admin"];

function empiezaCon(ruta: string, prefijos: string[]): boolean {
  return prefijos.some((p) => ruta === p || ruta.startsWith(`${p}/`));
}

export type Reaccion = "ninguna" | "ir-al-destino" | "recargar";

/**
 * Qué hace una pestaña cuando nota que la sesión del navegador cambió.
 *   - En login o registro, si ahora hay sesión: ir al destino (se entró en
 *     otra pestaña). En /recuperar no: ahí la sesión nueva es la del enlace de
 *     recuperación y todavía falta guardar la contraseña.
 *   - En un panel: recargar entera, para que el servidor decida (sin sesión,
 *     el proxy manda al login; con otro usuario, no quedan en pantalla datos
 *     del anterior). Un `router.refresh()` no sirve aquí: no sigue la
 *     redirección del proxy y la pestaña se quedaba en el panel.
 *   - En el resto (enlaces de correo, /actualizar-password, páginas
 *     públicas): nada. /actualizar-password vive de la sesión del enlace de
 *     recuperación y no debe saltar a ningún lado.
 */
export function reaccionAlCambio(ruta: string, antes: string | null, ahora: string | null): Reaccion {
  if (antes === ahora) return "ninguna";
  if (empiezaCon(ruta, RUTAS_DE_ACCESO)) return ahora ? "ir-al-destino" : "ninguna";
  if (empiezaCon(ruta, RUTAS_CON_SESION)) return "recargar";
  return "ninguna";
}

