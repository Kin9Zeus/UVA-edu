import { config as configurarZod } from "zod";

/**
 * Zod v4 prueba si puede compilar validadores con `Function("")` (su modo
 * JIT). La CSP no permite `unsafe-eval`, así que cada prueba era un reporte
 * `Blocked 'script' from 'eval:'` en Sentry (UVA-EDU-1S) — sin romper nada,
 * porque Zod atrapa el fallo y valida sin JIT. `jitless` se salta la prueba:
 * mismo resultado, sin el reporte. Va aquí porque este archivo corre antes
 * que cualquier componente que valide con Zod. En el servidor no aplica
 * (no hay CSP), así que ahí el JIT sigue activo.
 */
configurarZod({ jitless: true });

/**
 * P1-3 (AUDIT-2026-08-24.md): monitoreo de errores del lado del cliente.
 * Convención de Next 16.3 (antes `sentry.client.config.ts`): este archivo
 * corre después de cargar el HTML y antes de la hidratación de React
 * (docs/app/api-reference/file-conventions/instrumentation-client.md).
 *
 * El SDK NO se importa ni se inicia aquí: hacerlo lo metía en el paquete que
 * se ejecuta antes de hidratar y sumaba ~230 ms de TBT en móvil (medido con
 * Lighthouse, mismo código con Sentry apagado y activo: soporte 83 a 76,
 * login 86 a 79, registro 84 a 66; en un computador más lento, más). Se carga
 * unos segundos después de la carga de la página, cuando el navegador está
 * libre, y en ese lapso los errores se guardan en una cola pequeña y se
 * envían a Sentry apenas el SDK esté listo.
 *
 * Qué se pierde a cambio: la traza de rendimiento de la PRIMERA carga de cada
 * visita (el SDK arranca tarde) y el contexto previo (breadcrumbs) de los
 * errores de esos primeros segundos. Los errores y las trazas de las
 * navegaciones siguientes se mantienen.
 */
type SentryCliente = typeof import("./lib/sentry-cliente");

/** Espera tras la carga de la página antes de cargar Sentry. */
const ESPERA_ANTES_DE_CARGAR_MS = 6_000;
/** Tope de la cola: un bucle de errores no debe crecer sin límite. */
const MAXIMO_ERRORES_EN_COLA = 20;

const colaDeErrores: unknown[] = [];
let sentry: SentryCliente | undefined;
let cargaIniciada = false;

function aError(valor: unknown, mensaje?: string): unknown {
  if (valor instanceof Error) return valor;
  if (mensaje) return new Error(mensaje);
  return new Error(typeof valor === "string" ? valor : "Error sin detalle");
}

function guardarError(error: unknown) {
  if (colaDeErrores.length < MAXIMO_ERRORES_EN_COLA) colaDeErrores.push(error);
}

function alErrorTemprano(evento: ErrorEvent) {
  guardarError(aError(evento.error, evento.message));
}

function alRechazoTemprano(evento: PromiseRejectionEvent) {
  guardarError(aError(evento.reason));
}

function cargarSentry() {
  if (cargaIniciada) return;
  cargaIniciada = true;

  void import("./lib/sentry-cliente")
    .then((Sentry) => {
      Sentry.iniciarSentry();
      sentry = Sentry;

      // El SDK ya instala sus propios manejadores: se retiran los de la cola
      // y se envía lo que quedó pendiente.
      window.removeEventListener("error", alErrorTemprano);
      window.removeEventListener("unhandledrejection", alRechazoTemprano);
      for (const error of colaDeErrores.splice(0)) Sentry.captureException(error);
    })
    .catch(() => {
      // Sin red o con un bloqueador, el SDK no llega: nada que hacer, y la
      // cola se queda como está (tiene tope).
    });
}

function programarCarga() {
  const cargarCuandoEsteLibre = () => {
    // Safari no tiene requestIdleCallback.
    if ("requestIdleCallback" in window) window.requestIdleCallback(cargarSentry, { timeout: 4_000 });
    else cargarSentry();
  };
  const esperar = () => setTimeout(cargarCuandoEsteLibre, ESPERA_ANTES_DE_CARGAR_MS);

  if (document.readyState === "complete") esperar();
  else window.addEventListener("load", esperar, { once: true });
}

if (typeof window !== "undefined") {
  window.addEventListener("error", alErrorTemprano);
  window.addEventListener("unhandledrejection", alRechazoTemprano);
  programarCarga();
}

// Requerido por el SDK para instrumentar navegaciones del App Router; sin
// esto el wizard/build advierte "ACTION REQUIRED" en cada compilación. Si la
// navegación ocurre antes de que Sentry cargue, no se traza (no se adelanta
// la carga: sería pagar el costo justo al navegar).
export const onRouterTransitionStart: SentryCliente["captureRouterTransitionStart"] = (...args) => {
  sentry?.captureRouterTransitionStart(...args);
};
