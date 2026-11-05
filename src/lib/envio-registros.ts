/**
 * Copia de los registros importantes hacia Vector (fase 10.1 del plan de
 * blindaje). Vector, un servicio aparte en el mismo proyecto de Railway,
 * los reenvía a Better Stack (búsqueda y alertas, 3 días) y a Cloudflare R2
 * (archivo de 90 días). Ver docs/ops/registros-externos.md.
 *
 * Por qué la app los manda y no se leen de Railway: Railway no tiene envío
 * nativo de registros a otro servicio; su guía pide que la app mande una
 * copia por la red privada (https://railway.com/guides/ship-logs-third-party).
 * La salida estándar sigue igual: Railway los sigue mostrando.
 *
 * Qué se manda: solo lo que ya va a la salida estándar con forma de JSON y
 * ya pasó por los filtros de privacidad (`eventos-seguridad.ts` y `log.ts`).
 * Este módulo no agrega datos de nadie.
 *
 * Reglas:
 *   · Sin `VECTOR_URL`, no hace nada (local, CI, staging sin Vector).
 *   · Nunca frena una petición: junta las líneas y las manda en lotes cada
 *     pocos segundos, en segundo plano.
 *   · Nunca lanza ni registra con `logError` (eso volvería a llamar aquí).
 *     Si Vector no responde, el lote se pierde: la copia en Railway queda.
 *   · Solo en el servidor: en el navegador no existe `VECTOR_URL`.
 */

const CADA_MS = 2_000;
const MAXIMO_POR_LOTE = 100;
/** Si Vector lleva rato caído, no se acumula memoria sin límite. */
const MAXIMO_EN_ESPERA = 1_000;
const TIEMPO_MAXIMO_MS = 3_000;

type Linea = Record<string, unknown>;

const pendientes: Linea[] = [];
let temporizador: ReturnType<typeof setTimeout> | null = null;
let avisoDeFallo = 0;

function destino(): string | null {
  if (typeof window !== "undefined") return null;
  return process.env.VECTOR_URL?.trim() || null;
}

/** De qué servicio y despliegue viene cada línea (variables que pone Railway). */
function origen(): Linea {
  const origen: Linea = {};
  if (process.env.RAILWAY_SERVICE_NAME) origen.servicio = process.env.RAILWAY_SERVICE_NAME;
  if (process.env.RAILWAY_ENVIRONMENT_NAME) origen.entorno = process.env.RAILWAY_ENVIRONMENT_NAME;
  if (process.env.RAILWAY_DEPLOYMENT_ID) origen.despliegue = process.env.RAILWAY_DEPLOYMENT_ID;
  return origen;
}

/** Agrega una línea al próximo lote. No espera ni lanza. */
export function enviarAlRegistroExterno(linea: Linea): void {
  try {
    if (!destino()) return;
    if (pendientes.length >= MAXIMO_EN_ESPERA) pendientes.shift();
    pendientes.push({ ...linea, ...origen() });

    if (pendientes.length >= MAXIMO_POR_LOTE) {
      void vaciarRegistrosPendientes();
    } else if (!temporizador) {
      temporizador = setTimeout(() => void vaciarRegistrosPendientes(), CADA_MS);
      // No mantener vivo el proceso solo por esto.
      temporizador.unref?.();
    }
  } catch {
    // La copia externa es lo menos importante de la petición.
  }
}

/** Manda lo que haya. Exportado para las pruebas. */
export async function vaciarRegistrosPendientes(): Promise<void> {
  if (temporizador) {
    clearTimeout(temporizador);
    temporizador = null;
  }
  const url = destino();
  if (!url || pendientes.length === 0) return;

  while (pendientes.length > 0) {
    const lote = pendientes.splice(0, MAXIMO_POR_LOTE);
    try {
      const respuesta = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-ndjson" },
        body: lote.map((l) => JSON.stringify(l)).join("\n") + "\n",
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    } catch (error) {
      // Un aviso por minuto como mucho, a la salida estándar (no a logError,
      // que volvería a llamar aquí). Se dejan de intentar los lotes que
      // quedan: si Vector no responde, insistir solo suma espera.
      const ahora = Date.now();
      if (ahora - avisoDeFallo > 60_000) {
        avisoDeFallo = ahora;
        console.warn(
          JSON.stringify({
            nivel: "warning",
            scope: "envio-registros",
            mensaje: "Vector no respondió; el lote se perdió (la copia en Railway queda)",
            causa: error instanceof Error ? error.message : String(error),
          }),
        );
      }
      pendientes.length = 0;
      return;
    }
  }
}

/** Solo para pruebas. */
export function _reiniciarEnvioDeRegistros(): void {
  pendientes.length = 0;
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  avisoDeFallo = 0;
}
