import { FUNCIONES_PLATAFORMA } from "@/content/marketing";

export function ProductBand() {
  return (
    <section
      id="producto"
      className="border-y border-uva-divider bg-uva-band-bg px-[clamp(20px,4vw,56px)] py-[clamp(56px,8vw,96px)]"
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-11 flex flex-col items-center gap-5 text-center">
          <h2 className="m-0 text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.02em] text-uva-text">
            Lo que encuentras al entrar
          </h2>
        </div>

        <div className="grid grid-cols-1 items-center gap-[clamp(32px,6vw,64px)] min-[900px]:grid-cols-2">
          <ul className="flex flex-col gap-5">
            {FUNCIONES_PLATAFORMA.map((funcion) => (
              <li className="flex gap-2.5" key={funcion.titulo}>
                <span
                  className="shrink-0 font-bold text-uva-accent-ink"
                  aria-hidden="true"
                >
                  ▸
                </span>
                <div>
                  <p className="mb-0.5 text-sm font-semibold text-uva-text">
                    {funcion.titulo}
                  </p>
                  <p className="m-0 text-[12.5px] text-uva-text-muted">
                    {funcion.descripcion}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div
            role="img"
            aria-label="Vista previa de la plataforma U.V.A."
            className="order-[-1] h-[240px] rounded-uva-lg border border-uva-divider bg-uva-surface-2 bg-[repeating-linear-gradient(135deg,var(--uva-stripe)_0_2px,transparent_2px_9px)] min-[900px]:order-none min-[900px]:h-[340px]"
          />
        </div>
      </div>
    </section>
  );
}
