/**
 * Decide si la auditoría de dependencias de producción pasa o no (CI,
 * paso «Auditoría de dependencias en producción (bloqueante)»).
 *
 * Por qué existe
 * --------------
 * `npm audit --audit-level=high` no tiene forma de aceptar un aviso puntual:
 * o bloquea todo o no bloquea nada. El 17 de noviembre de 2026 el aviso
 * GHSA-fc5q-39xc-vjpf (picomatch) se amplió a TODAS las versiones, sin
 * parche publicado, y dejó `master` en rojo sin que hubiera nada que
 * actualizar. La salida fácil —quitar el bloqueo o volverlo
 * `continue-on-error`— es justo la que P2-4 (AUDIT-2026-09-04.md) cerró:
 * el contador subió cuatro veces sin que nadie se enterara.
 *
 * Esto acepta SOLO los avisos listados en `EXCEPCIONES_AUDITORIA`, cada uno
 * con su motivo y una fecha de revisión. Cualquier aviso alto o crítico
 * nuevo sigue bloqueando, y una excepción vencida también: obliga a mirar de
 * nuevo si ya salió el parche en vez de olvidarla.
 *
 * Función pura: recibe el JSON de `npm audit --json` y la fecha, sin correr
 * nada. El script que llama a npm es `scripts/auditoria-produccion.ts`.
 */

export type ExcepcionAuditoria = {
  /** Identificador del aviso, p. ej. `GHSA-fc5q-39xc-vjpf`. */
  ghsa: string;
  /** Paquete afectado según el aviso. La excepción no vale para otro. */
  paquete: string;
  /** Por qué no afecta a producción y qué se está esperando. */
  motivo: string;
  /** `AAAA-MM-DD`. Desde ese día la excepción deja de valer y el CI falla. */
  revisarAntes: string;
};

// Vacía: GHSA-fc5q-39xc-vjpf (picomatch) dejó de aparecer en `npm audit` al
// revisarla el 2026-11-24 (venció su plazo). Se agrega una aquí solo con
// motivo y fecha de revisión.
export const EXCEPCIONES_AUDITORIA: ExcepcionAuditoria[] = [];

const SEVERIDADES_BLOQUEANTES = new Set(["high", "critical"]);

type Aviso = { ghsa: string; paquete: string; severidad: string; titulo: string };

export type ResultadoAuditoria = {
  aprobada: boolean;
  /** Avisos altos o críticos sin excepción válida: son los que bloquean. */
  bloqueantes: Aviso[];
  /** Avisos aceptados por una excepción vigente. */
  aceptados: Aviso[];
  /** Excepciones cuya fecha de revisión ya pasó. También bloquean. */
  vencidas: ExcepcionAuditoria[];
  /** Excepciones que ya no corresponden a ningún aviso: se pueden borrar. */
  sinUso: ExcepcionAuditoria[];
  /** El JSON no tenía la forma esperada (npm falló, sin red…). Bloquea. */
  errorLectura?: string;
};

type ViaAudit = string | { source?: number; name?: string; title?: string; url?: string; severity?: string };
type InformeAudit = { vulnerabilities?: Record<string, { via?: ViaAudit[] }>; error?: unknown };

function ghsaDeUrl(url: string | undefined): string | null {
  return url?.match(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i)?.[0] ?? null;
}

/**
 * Solo los avisos de verdad: en el informe de npm, un paquete que depende
 * de otro vulnerable aparece con `via: ["otro-paquete"]` (texto). Los avisos
 * son los objetos con `url`. Así se evalúa la causa, no cada eslabón.
 */
function avisosDelInforme(informe: InformeAudit): Aviso[] {
  const porId = new Map<string, Aviso>();

  for (const vulnerabilidad of Object.values(informe.vulnerabilities ?? {})) {
    for (const via of vulnerabilidad.via ?? []) {
      if (typeof via === "string") continue;
      const ghsa = ghsaDeUrl(via.url) ?? `npm-${via.source ?? "desconocido"}`;
      porId.set(`${ghsa}|${via.name}`, {
        ghsa,
        paquete: via.name ?? "desconocido",
        severidad: via.severity ?? "desconocida",
        titulo: via.title ?? "",
      });
    }
  }

  return [...porId.values()];
}

export function evaluarAuditoria(
  informe: unknown,
  hoy: string,
  excepciones: ExcepcionAuditoria[] = EXCEPCIONES_AUDITORIA,
): ResultadoAuditoria {
  const vacio = { bloqueantes: [], aceptados: [], vencidas: [], sinUso: [] };

  // Fallar cerrado: un informe que no se pudo leer no es "cero avisos".
  if (typeof informe !== "object" || informe === null || "error" in informe) {
    return { aprobada: false, ...vacio, errorLectura: "npm audit no devolvió un informe válido" };
  }

  const vigentes = excepciones.filter((e) => e.revisarAntes > hoy);
  const vencidas = excepciones.filter((e) => e.revisarAntes <= hoy);
  const avisos = avisosDelInforme(informe as InformeAudit).filter((a) => SEVERIDADES_BLOQUEANTES.has(a.severidad));

  const cubre = (a: Aviso) => (e: ExcepcionAuditoria) =>
    e.ghsa.toLowerCase() === a.ghsa.toLowerCase() && e.paquete === a.paquete;

  const aceptados = avisos.filter((a) => vigentes.some(cubre(a)));
  const bloqueantes = avisos.filter((a) => !vigentes.some(cubre(a)));
  const sinUso = vigentes.filter((e) => !avisos.some((a) => cubre(a)(e)));

  return {
    aprobada: bloqueantes.length === 0 && vencidas.length === 0,
    bloqueantes,
    aceptados,
    vencidas,
    sinUso,
  };
}
