"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { COOKIE_REGISTRO_PENDIENTE, clarityPermitida, registrarEvento } from "@/lib/analitica";
import {
  CLAVE_CONSENTIMIENTO,
  EVENTO_ABRIR_AVISO_COOKIES,
  esCookieDeAnalitica,
  leerConsentimiento,
  serializarConsentimiento,
  type DecisionConsentimiento,
} from "@/lib/consentimiento";

/**
 * Aviso de cookies y carga de GA4 y Clarity, solo con consentimiento.
 *
 * Lo monta el layout raíz únicamente si hay algún id de analítica
 * (`lib/analitica.ts`). Hasta que la persona pulsa «Aceptar» no se pide ningún
 * script de Google ni de Microsoft y no se escribe ninguna cookie suya.
 *
 * Los scripts se crean desde aquí (no en el <head>): un script que agrega otro
 * script con nonce está permitido por 'strict-dynamic', y se les pone el nonce
 * igual para los navegadores de CSP nivel 2.
 */

type Props = {
  gaId: string | null;
  clarityId: string | null;
  nonce: string | undefined;
  /** `/legal/cookies` si ya tiene texto vigente; si no, el aviso no enlaza a un 404. */
  rutaPoliticaCookies: string | null;
};

type VentanaConAnalitica = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
};

/** Avisa a esta misma pestaña que la decisión cambió (`storage` solo llega a las otras). */
const EVENTO_CAMBIO = "uva:consentimiento-cambio";
/** El servidor no sabe qué hay en localStorage: hasta hidratar no se decide nada. */
const SIN_LEER = "__sin-leer__";

function leerGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE_CONSENTIMIENTO);
  } catch {
    return null;
  }
}

function suscribir(avisar: () => void): () => void {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO_CAMBIO, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO_CAMBIO, avisar);
  };
}

function agregarScript(src: string, nonce: string | undefined): void {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  if (nonce) script.nonce = nonce;
  document.head.appendChild(script);
}

function cargarGa(gaId: string, nonce: string | undefined): void {
  const w = window as VentanaConAnalitica;
  if (w.gtag) return;
  w.dataLayer = w.dataLayer ?? [];
  // gtag.js exige el objeto `arguments`, no un arreglo: es su snippet oficial.
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  // Sin publicidad: solo medición. La persona aceptó analítica, nada más.
  w.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  });
  w.gtag("js", new Date());
  w.gtag("config", gaId);
  agregarScript(`https://www.googletagmanager.com/gtag/js?id=${gaId}`, nonce);
}

function cargarClarity(clarityId: string, nonce: string | undefined): void {
  const w = window as VentanaConAnalitica;
  if (w.clarity) return;
  // Cola del snippet oficial: las llamadas anteriores a que llegue el script
  // se guardan y Clarity las procesa al cargar.
  const cola = function clarity() {
    // eslint-disable-next-line prefer-rest-params
    (cola.q = cola.q ?? []).push(arguments);
  } as NonNullable<VentanaConAnalitica["clarity"]>;
  w.clarity = cola;
  w.clarity("consent");
  agregarScript(`https://www.clarity.ms/tag/${clarityId}`, nonce);
}

function borrarCookiesDeAnalitica(): void {
  const nombres = document.cookie
    .split(";")
    .map((par) => par.split("=")[0].trim())
    .filter(esCookieDeAnalitica);
  // GA4 y Clarity las ponen en el dominio principal (con punto delante):
  // se borran en el host y en cada dominio padre por si acaso.
  const partes = location.hostname.split(".");
  const dominios = partes.map((_, i) => partes.slice(i).join(".")).filter((d) => d.includes("."));
  for (const nombre of nombres) {
    document.cookie = `${nombre}=; Max-Age=0; path=/`;
    for (const dominio of dominios) document.cookie = `${nombre}=; Max-Age=0; path=/; domain=.${dominio}`;
  }
}

export function Analitica({ gaId, clarityId, nonce, rutaPoliticaCookies }: Props) {
  const ruta = usePathname();
  const guardado = useSyncExternalStore(suscribir, leerGuardado, () => SIN_LEER);
  const decision = guardado === SIN_LEER ? undefined : leerConsentimiento(guardado);
  const [reabierto, setReabierto] = useState(false);
  const clarityCargada = useRef(false);
  const tituloId = useId();

  // «Configurar cookies» del pie vuelve a abrir el aviso.
  useEffect(() => {
    const abrir = () => setReabierto(true);
    window.addEventListener(EVENTO_ABRIR_AVISO_COOKIES, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_AVISO_COOKIES, abrir);
  }, []);

  useEffect(() => {
    if (decision === "aceptada" && gaId) cargarGa(gaId, nonce);
  }, [decision, gaId, nonce]);

  // Registro con Google: lo marca `/auth/callback` con una cookie corta. Se
  // mide solo con consentimiento; si lo rechazó, se borra sin medir. Sin
  // decidir todavía, se deja (vence sola en 10 minutos).
  useEffect(() => {
    if (decision !== "aceptada" && decision !== "rechazada") return;
    const pendiente = document.cookie.split(";").some((par) => par.trim().startsWith(`${COOKIE_REGISTRO_PENDIENTE}=`));
    if (!pendiente) return;
    document.cookie = `${COOKIE_REGISTRO_PENDIENTE}=; Max-Age=0; path=/`;
    if (decision === "aceptada") registrarEvento("registro_completado", { metodo: "google" });
  }, [decision]);

  // Clarity solo graba en las páginas públicas (`clarityPermitida`). No tiene
  // forma documentada de detenerse una vez cargado, así que al entrar desde
  // una página pública a una privada (p. ej., después de iniciar sesión) se
  // enmascara todo y se recarga la página: la carga nueva ya no lo incluye.
  useEffect(() => {
    if (decision !== "aceptada" || !clarityId) return;
    if (clarityPermitida(ruta)) {
      cargarClarity(clarityId, nonce);
      clarityCargada.current = true;
    } else if (clarityCargada.current) {
      document.body.setAttribute("data-clarity-mask", "true");
      location.reload();
    }
  }, [decision, clarityId, nonce, ruta]);

  // `clic_whatsapp` con un solo oyente para todo el sitio: los enlaces a
  // WhatsApp están en el pie, el botón flotante, soporte y otros sitios, y así
  // ninguno se queda sin medir. Sin `gtag` cargado no hace nada.
  useEffect(() => {
    function alHacerClic(evento: MouseEvent) {
      const enlace = (evento.target as Element | null)?.closest?.("a[href]");
      if (enlace instanceof HTMLAnchorElement && /(^|\.)whatsapp\.com$|^wa\.me$/.test(enlace.hostname)) {
        registrarEvento("clic_whatsapp", { pagina: location.pathname });
      }
    }
    document.addEventListener("click", alHacerClic);
    return () => document.removeEventListener("click", alHacerClic);
  }, []);

  function decidir(nueva: DecisionConsentimiento) {
    const retira = decision === "aceptada" && nueva === "rechazada";
    try {
      localStorage.setItem(CLAVE_CONSENTIMIENTO, serializarConsentimiento(nueva, new Date()));
    } catch {
      // Sin almacenamiento (modo privado estricto): la decisión vale solo
      // para esta visita. Se aplica igual.
    }
    setReabierto(false);
    window.dispatchEvent(new Event(EVENTO_CAMBIO));
    // Los scripts ya cargados no se pueden descargar: se borran sus cookies y
    // se recarga sin ellos.
    if (retira) {
      // Primero se apagan: si no, gtag vuelve a escribir `_ga_<id>` antes de
      // que termine la recarga.
      const w = window as unknown as VentanaConAnalitica & Record<string, unknown>;
      if (gaId) w[`ga-disable-${gaId}`] = true;
      w.gtag?.("consent", "update", { analytics_storage: "denied" });
      w.clarity?.("consent", false);
      borrarCookiesDeAnalitica();
      location.reload();
    }
  }

  const visible = decision !== undefined && (decision === null || reabierto);
  if (!visible) return null;

  const herramientas = [gaId && "Google Analytics", clarityId && "Microsoft Clarity"].filter(Boolean).join(" y ");

  return (
    <section
      aria-labelledby={tituloId}
      className="fixed inset-x-0 bottom-0 z-50 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] print:hidden"
    >
      {/* Con la letra del sistema agrandada el aviso puede ser más alto que la
          pantalla: scroll propio para que el título y los botones se alcancen. */}
      <div className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col gap-4 overflow-y-auto overscroll-contain rounded-uva-lg border border-uva-line-strong bg-uva-surface p-5 shadow-uva-flotante md:flex-row md:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 id={tituloId} className="m-0 text-uva-titulo-4 text-uva-text">
            Cookies de análisis
          </h2>
          <p className="m-0 text-uva-cuerpo text-uva-text-muted">
            Si las aceptas, usamos {herramientas} para saber qué páginas se visitan y mejorar el sitio. Si las
            rechazas, no se activan y el sitio funciona igual.
            {rutaPoliticaCookies && (
              <>
                {" "}
                <Link href={rutaPoliticaCookies} className="text-uva-accent-ink underline underline-offset-2">
                  Política de cookies
                </Link>
              </>
            )}
          </p>
        </div>
        {/* Mismo estilo y tamaño para los dos: rechazar no puede costar más que aceptar. */}
        {/* Lado a lado si caben; con letra grande, uno debajo del otro. */}
        <div className="flex flex-wrap gap-3 md:shrink-0 md:flex-nowrap">
          <Button variant="uva-secondary" size="uva" className="grow basis-28 md:w-32 md:grow-0 md:basis-auto" onClick={() => decidir("rechazada")}>
            Rechazar
          </Button>
          <Button variant="uva-secondary" size="uva" className="grow basis-28 md:w-32 md:grow-0 md:basis-auto" onClick={() => decidir("aceptada")}>
            Aceptar
          </Button>
        </div>
      </div>
    </section>
  );
}
