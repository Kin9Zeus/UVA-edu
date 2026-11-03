import type { DiagnosticoIp } from "@/lib/clientIp";

/**
 * De dónde sale la IP con la que se cuentan los límites de intentos, medida
 * en esta misma petición. Volvió al panel para el paso a Cloudflare (fases 1
 * y 2 del plan de blindaje): confirma que la app lee la IP real del
 * administrador y no la de Cloudflare. Se quita cuando el cambio esté
 * comprobado en producción (docs/ops/cloudflare.md).
 *
 * Va bajo /admin, que el proxy restringe a ADMINISTRADOR: la única IP que se
 * ve aquí es la de la propia conexión.
 */
export function DiagnosticoRed({ diagnostico }: { diagnostico: DiagnosticoIp }) {
  const { crudo, cadena, saltos, saltosConfigurados, indiceUsado, ipUsada, fuente, cfConnectingIp, cierreOrigen, desdeCloudflare } =
    diagnostico;
  const usaCloudflare = fuente === "cf-connecting-ip";

  return (
    <div className="flex flex-col gap-4 text-uva-detalle text-uva-muted">
      <p>
        IP que usa la app para los límites de intentos, leída de <strong className="text-uva-text">esta misma petición</strong>.
      </p>

      <dl className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-uva-text-faint">IP usada:</dt>
          <dd className="font-codigo break-all text-uva-text">{ipUsada}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-uva-text-faint">Sale de:</dt>
          <dd className="text-uva-text">
            {usaCloudflare ? (
              <>
                <code className="font-codigo">CF-Connecting-IP</code> (la escribe Cloudflare)
              </>
            ) : (
              <>
                <code className="font-codigo">X-Forwarded-For</code>, posición {indiceUsado ?? "—"}
              </>
            )}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-uva-text-faint">Cierre del origen:</dt>
          <dd className="text-uva-text">
            {!cierreOrigen
              ? "apagado (ORIGEN_SECRETO sin poner)"
              : desdeCloudflare
                ? "encendido, y esta petición pasó por Cloudflare"
                : "encendido, pero esta petición no trajo el secreto"}
          </dd>
        </div>
        {cfConnectingIp && !usaCloudflare ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-uva-text-faint">CF-Connecting-IP (ignorada):</dt>
            <dd className="font-codigo break-all">{cfConnectingIp}</dd>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-uva-text-faint">TRUSTED_PROXY_HOPS:</dt>
          <dd className="font-codigo text-uva-text tabular-nums">
            {saltos}
            {saltosConfigurados ? "" : " (por defecto)"}
          </dd>
        </div>
      </dl>

      {cadena.length === 0 ? (
        <p className="rounded-uva-md border border-uva-divider px-3 py-2.5 text-uva-text-faint">
          Sin <code className="font-codigo">X-Forwarded-For</code>: no hay ningún proxy delante. Normal en desarrollo local.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5" aria-label="Cadena X-Forwarded-For, de izquierda a derecha">
          {cadena.map((entrada, indice) => {
            const esLaUsada = !usaCloudflare && indice === indiceUsado;
            return (
              <li
                key={`${indice}-${entrada}`}
                className={
                  esLaUsada
                    ? "flex flex-wrap items-center justify-between gap-x-3 rounded-uva-md border border-uva-accent px-3 py-2 text-uva-text"
                    : "flex flex-wrap items-center justify-between gap-x-3 rounded-uva-md border border-uva-divider px-3 py-2"
                }
              >
                <span className="font-codigo break-all tabular-nums">
                  [{indice}] {entrada}
                </span>
                <span className="text-uva-text-faint">
                  {esLaUsada ? "la que se usa" : indice === 0 ? "la escribe el cliente" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p>
        <strong className="text-uva-text">Cómo comprobarlo:</strong> abre{" "}
        <code className="font-codigo text-uva-text">ifconfig.me</code> en otra pestaña y compara tu IP pública con la IP
        usada. Con Cloudflare delante deben coincidir y la fuente debe ser{" "}
        <code className="font-codigo">CF-Connecting-IP</code>. Si sale una IP de Cloudflare, todos los usuarios estarían
        compartiendo el mismo límite.
      </p>

      {crudo ? (
        <details>
          <summary className="cursor-pointer text-uva-text-faint">Cabecera cruda</summary>
          <p className="font-codigo mt-1.5 break-all">{crudo}</p>
        </details>
      ) : null}
    </div>
  );
}
