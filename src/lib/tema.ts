/**
 * Tema claro / oscuro de toda la plataforma (sitio público, panel del
 * estudiante y panel de administración).
 *
 * Tres preferencias posibles:
 *   - "sistema" (por defecto, sin nada guardado): sigue la media query
 *     `prefers-color-scheme` del sistema operativo, y cambia en vivo si el
 *     usuario cambia el tema de su equipo con la página abierta.
 *   - "claro" / "oscuro": elección manual con el selector de la interfaz;
 *     sobrescribe al sistema y persiste en `localStorage`.
 *
 * El servidor no puede leer `localStorage`, así que el tema se aplica en el
 * navegador ANTES de pintar con SCRIPT_TEMA_INICIAL (en el <head> del layout
 * raíz, con el nonce de la CSP): pone o quita `.dark` en <html>, que es lo
 * que activa los tokens oscuros de globals.css. Sin ese script la página
 * nacería clara y se oscurecería al hidratar (un destello en cada carga).
 *
 * Todo acceso a `localStorage` va en try/catch: en una ventana privada o con
 * los datos del sitio bloqueados puede lanzar, y ahí se cae a "sistema".
 */
export const TEMA_STORAGE_KEY = "uva-tema";

export type Tema = "claro" | "oscuro";
export type PreferenciaTema = Tema | "sistema";

const MEDIA_OSCURO = "(prefers-color-scheme: dark)";

/** Evento propio para avisar a los suscriptores de esta misma pestaña
 *  (el evento `storage` del navegador solo llega a las OTRAS pestañas). */
const EVENTO_CAMBIO = "uva-tema-cambio";

/** Color de la barra del navegador móvil y de la zona de overscroll: el
 *  mismo `--uva-bg` de cada tema en globals.css. */
export const COLOR_BARRA_NAVEGADOR: Record<Tema, string> = {
  claro: "#fafafa",
  oscuro: "#09090b",
};

export function parsearPreferencia(valor: string | null | undefined): PreferenciaTema {
  return valor === "claro" || valor === "oscuro" ? valor : "sistema";
}

export function resolverTema(preferencia: PreferenciaTema, sistemaOscuro: boolean): Tema {
  if (preferencia === "sistema") return sistemaOscuro ? "oscuro" : "claro";
  return preferencia;
}

export function leerPreferencia(): PreferenciaTema {
  try {
    return parsearPreferencia(window.localStorage.getItem(TEMA_STORAGE_KEY));
  } catch {
    return "sistema";
  }
}

function sistemaEsOscuro(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MEDIA_OSCURO).matches;
}

/** Tema que corresponde ahora mismo según lo guardado y el sistema. */
export function temaActual(): Tema {
  return resolverTema(leerPreferencia(), sistemaEsOscuro());
}

/**
 * Pinta el tema en el documento ya cargado: clase `.dark`, `color-scheme`
 * (controles nativos y barras de scroll) y la barra del navegador móvil.
 * Las dos etiquetas `theme-color` (una por cada `prefers-color-scheme`, ver
 * layout.tsx) reciben el mismo color: con una elección manual, la media
 * query del sistema ya no debe decidir el color de la barra.
 */
export function aplicarTema(tema: Tema): void {
  if (typeof document === "undefined") return;

  const raiz = document.documentElement;
  raiz.classList.toggle("dark", tema === "oscuro");
  raiz.style.colorScheme = tema === "oscuro" ? "dark" : "light";

  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", COLOR_BARRA_NAVEGADOR[tema]);
  });
}

/** Guarda la preferencia (o la borra, con "sistema"), la aplica y avisa. */
export function guardarPreferencia(preferencia: PreferenciaTema): void {
  if (typeof window === "undefined") return;
  try {
    if (preferencia === "sistema") window.localStorage.removeItem(TEMA_STORAGE_KEY);
    else window.localStorage.setItem(TEMA_STORAGE_KEY, preferencia);
  } catch {
    // Sin almacenamiento la elección vale solo para esta visita: se aplica
    // igual, pero no sobrevive a la recarga.
  }
  aplicarTema(resolverTema(preferencia, sistemaEsOscuro()));
  window.dispatchEvent(new Event(EVENTO_CAMBIO));
}

/**
 * Suscripción para `useSyncExternalStore`: avisa cuando cambia la elección
 * (en esta pestaña o en otra) o el tema del sistema. Ante un cambio del
 * sistema o de otra pestaña también re-aplica el tema, porque nadie más lo
 * hace en esos dos casos.
 */
export function suscribirTema(alCambiar: () => void): () => void {
  const media = window.matchMedia(MEDIA_OSCURO);

  function reaplicar() {
    aplicarTema(temaActual());
    alCambiar();
  }
  function alCambiarStorage(evento: StorageEvent) {
    if (evento.key === null || evento.key === TEMA_STORAGE_KEY) reaplicar();
  }

  media.addEventListener("change", reaplicar);
  window.addEventListener("storage", alCambiarStorage);
  window.addEventListener(EVENTO_CAMBIO, alCambiar);
  return () => {
    media.removeEventListener("change", reaplicar);
    window.removeEventListener("storage", alCambiarStorage);
    window.removeEventListener(EVENTO_CAMBIO, alCambiar);
  };
}

/**
 * Script en línea que corre en el <head> antes de pintar. Debe ser autónomo
 * (no puede importar nada) y mínimo; replica parsearPreferencia +
 * resolverTema + la parte de aplicarTema que importa para el primer pintado.
 * Lo cubre tema.test.ts ejecutándolo contra un documento falso.
 */
export const SCRIPT_TEMA_INICIAL = `(function(){var p=null;try{p=localStorage.getItem(${JSON.stringify(
  TEMA_STORAGE_KEY,
)})}catch(e){}var d=p==="oscuro"||(p!=="claro"&&window.matchMedia(${JSON.stringify(
  MEDIA_OSCURO,
)}).matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"})()`;
