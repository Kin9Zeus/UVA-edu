import type { DiagnosticoIp } from "@/lib/clientIp";

/**
 * Muestra la cadena real de `x-forwarded-for` que llega desde la
 * infraestructura, para poder fijar TRUSTED_PROXY_HOPS midiendo en vez de
 * suponiendo (AUDIT-2026-09-04.md, P1-2 y "Lo que no pude verificar" #3).
 *
 * De esa variable sale la clave de los dos límites por IP del producto, y
 * equivocarla hacia arriba los vuelve a dejar en manos del atacante — por
 * eso el número tiene que salir de una petición real, y por eso esto vive
 * en el panel en vez de en un log temporal que alguien olvida quitar.
 *
 * Va bajo /admin, que el proxy ya restringe a rol ADMINISTRADOR
 * (src/lib/supabase/proxy.ts): la única IP que un administrador ve acá es
 * la de su propia conexión.
 */
export function DiagnosticoRed({ diagnostico }: { diagnostico: DiagnosticoIp }) {
  const { crudo, cadena, saltos, saltosConfigurados, indiceUsado, ipUsada } = diagnostico;

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[13px] leading-relaxed text-uva-muted">
        Cadena <code className="font-mono text-uva-text">x-forwarded-for</code> de{" "}
        <strong className="text-uva-text">esta misma petición</strong>. Sirve para
        confirmar cuántos proxies hay delante de la aplicación, que es lo que
        configura <code className="font-mono text-uva-text">TRUSTED_PROXY_HOPS</code>.
      </p>

      {cadena.length === 0 ? (
        <p className="rounded-uva-md border border-uva-divider px-3 py-2.5 font-mono text-xs text-uva-text-faint">
          Sin cabecera — no hay ningún proxy delante. Normal en desarrollo local.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {cadena.map((entrada, indice) => {
            const esLaUsada = indice === indiceUsado;
            return (
              <li
                key={`${indice}-${entrada}`}
                className={
                  esLaUsada
                    ? "flex items-center justify-between gap-3 rounded-uva-md border border-uva-accent px-3 py-2 font-mono text-xs text-uva-text"
                    : "flex items-center justify-between gap-3 rounded-uva-md border border-uva-divider px-3 py-2 font-mono text-xs text-uva-muted-2"
                }
              >
                <span className="tabular-nums">
                  [{indice}] {entrada}
                </span>
                <span className="text-[10px] font-semibold tracking-[0.04em] whitespace-nowrap">
                  {esLaUsada ? "← LA QUE SE USA" : indice === 0 ? "la escribe el cliente" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <dl className="flex flex-col gap-1 text-[13px] text-uva-muted">
        <div className="flex gap-2">
          <dt className="text-uva-text-faint">TRUSTED_PROXY_HOPS:</dt>
          <dd className="font-mono text-uva-text tabular-nums">
            {saltos}
            {saltosConfigurados ? "" : " (por defecto, sin configurar)"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-uva-text-faint">IP usada para los límites:</dt>
          <dd className="font-mono text-uva-text">{ipUsada}</dd>
        </div>
      </dl>

      <p className="text-[13px] leading-relaxed text-uva-muted">
        <strong className="text-uva-text">Cómo leerlo:</strong> abre{" "}
        <code className="font-mono text-uva-text">ifconfig.me</code> en otra pestaña
        para ver tu IP pública real y compárala con el valor resaltado. Si coinciden,
        el número es correcto. Si tu IP aparece{" "}
        <em>una posición más arriba</em>, sube{" "}
        <code className="font-mono text-uva-text">TRUSTED_PROXY_HOPS</code> a{" "}
        {saltos + 1}. Nunca lo subas sin haber hecho esta comparación: pasarse
        hace que se lea justo el valor que puede escribir un atacante.
      </p>

      {crudo ? (
        <details className="text-[13px] text-uva-muted">
          <summary className="cursor-pointer text-uva-text-faint">Cabecera cruda</summary>
          <p className="mt-1.5 font-mono text-xs break-all text-uva-muted-2">{crudo}</p>
        </details>
      ) : null}
    </div>
  );
}
