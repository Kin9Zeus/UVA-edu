"use client";

import { useEffect, useRef } from "react";
import { llavePublicaTurnstile } from "@/lib/turnstile";

/**
 * Recuadro de Cloudflare Turnstile (fase 4). Va DENTRO del <form>: Turnstile
 * agrega solo el campo oculto `cf-turnstile-response`, que la Server Action
 * lee con `tokenTurnstile(formData)` y le pasa a Supabase.
 *
 * Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no muestra nada: en local y en CI el
 * formulario funciona igual que antes (ver lib/turnstile.ts, orden seguro).
 *
 * `reiniciarCon`: el estado de la acción. Cada token sirve UNA vez (Supabase
 * lo gasta al verificarlo); si el intento falla y se vuelve a enviar, hace
 * falta uno nuevo. Cuando el estado cambia, se pide otro.
 */

type OpcionesTurnstile = {
  sitekey: string;
  theme: "light" | "dark";
  language: string;
  size: "flexible" | "compact";
  action?: string;
};

type ApiTurnstile = {
  render: (contenedor: HTMLElement, opciones: OpcionesTurnstile) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: ApiTurnstile;
  }
}

const URL_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Ancho mínimo del recuadro normal; por debajo, la versión compacta. */
const ANCHO_MINIMO = 300;

let cargaDelScript: Promise<ApiTurnstile> | null = null;

/**
 * Carga el script de Cloudflare una sola vez por página. Lo agrega un script
 * propio de la app (que ya lleva el nonce), así que la CSP lo permite por
 * `'strict-dynamic'`; `challenges.cloudflare.com` está además en la lista
 * (lib/csp.ts) para el iframe del recuadro.
 */
function cargarTurnstile(): Promise<ApiTurnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (cargaDelScript) return cargaDelScript;
  cargaDelScript = new Promise<ApiTurnstile>((resolver, rechazar) => {
    const script = document.createElement("script");
    script.src = URL_SCRIPT;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolver(window.turnstile) : rechazar(new Error("Turnstile no se cargó"));
    script.onerror = () => {
      // Permite reintentar si la página sigue abierta (otra red, otra pestaña).
      cargaDelScript = null;
      rechazar(new Error("No se pudo descargar Turnstile"));
    };
    document.head.appendChild(script);
  });
  return cargaDelScript;
}

export function VerificacionTurnstile({
  reiniciarCon,
  accion,
}: {
  reiniciarCon?: unknown;
  /** Nombre corto del formulario: aparece en las estadísticas de Cloudflare. */
  accion?: string;
}) {
  const llave = llavePublicaTurnstile();
  const contenedor = useRef<HTMLDivElement>(null);
  const idWidget = useRef<string | null>(null);

  useEffect(() => {
    const nodo = contenedor.current;
    if (!llave || !nodo) return;
    let activo = true;

    cargarTurnstile()
      .then((turnstile) => {
        if (!activo || idWidget.current) return;
        idWidget.current = turnstile.render(nodo, {
          sitekey: llave,
          theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
          language: "es",
          // A 320 px de pantalla no caben los 300 px del recuadro normal.
          size: nodo.clientWidth > 0 && nodo.clientWidth < ANCHO_MINIMO ? "compact" : "flexible",
          action: accion,
        });
      })
      .catch(() => {
        // Sin el recuadro, el envío sale sin token y, con el captcha
        // encendido, Supabase lo rechaza con un mensaje claro
        // (MENSAJE_CAPTCHA). No hay nada más que hacer aquí.
      });

    return () => {
      activo = false;
      if (idWidget.current && window.turnstile) window.turnstile.remove(idWidget.current);
      idWidget.current = null;
    };
  }, [llave, accion]);

  // Token nuevo después de cada intento (el anterior ya se gastó).
  const primerEstado = useRef(true);
  useEffect(() => {
    if (primerEstado.current) {
      primerEstado.current = false;
      return;
    }
    if (idWidget.current && window.turnstile) window.turnstile.reset(idWidget.current);
  }, [reiniciarCon]);

  if (!llave) return null;

  // Alto reservado: el recuadro llega un instante después y no debe empujar
  // el botón hacia abajo cuando aparece (CLS).
  return <div ref={contenedor} className="min-h-[65px] w-full" data-verificacion-turnstile="" />;
}
