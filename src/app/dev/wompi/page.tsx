import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { simuladorActivo } from "@/lib/pagos/simulador";
import { formatearPrecio } from "@/lib/planes";
import { SimuladorControles } from "@/components/dev/SimuladorControles";

export const metadata: Metadata = { title: "U.V.A. — Simulador de pago" };

/**
 * Pantalla que reemplaza al Web Checkout de Wompi mientras no hay cuenta de
 * comercio. Ver src/lib/pagos/simulador.ts para el porqué.
 *
 * Vive en `/dev/` y NO dentro de (public) ni (student) a propósito: no debe
 * heredar el header, el sidebar ni la navegación del producto. No es una
 * pantalla de U.V.A, es un sustituto de una pantalla ajena.
 *
 * `notFound()` sin el simulador activo: en producción esta ruta no existe.
 */
export default async function SimuladorWompiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!simuladorActivo()) notFound();

  const params = await searchParams;
  const leer = (clave: string) => {
    const valor = params[clave];
    return typeof valor === "string" ? valor : "";
  };

  const referencia = leer("ref");
  const monto = Number(leer("monto"));
  const moneda = leer("moneda") || "COP";
  const plan = leer("plan");
  const retorno = leer("retorno");

  if (!referencia || !Number.isInteger(monto) || monto <= 0 || !retorno) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[520px] flex-col justify-center px-5 py-12">
      <div className="mb-5 rounded-uva-md border border-dashed border-uva-accent-2-text/40 bg-uva-accent-2-soft/20 px-4 py-3">
        <p className="m-0 font-mono text-[11px] tracking-[0.1em] text-uva-accent-2-text uppercase">
          Simulador local
        </p>
        <p className="m-0 mt-1 text-[12.5px] text-uva-text-muted">
          Wompi no está conectado. Esta pantalla ocupa el lugar del Web
          Checkout; el webhook, la firma y la conciliación son los reales.
        </p>
      </div>

      <div className="rounded-uva-md border border-uva-divider bg-uva-surface p-6">
        <h1 className="mb-1 font-heading text-xl text-uva-text">Confirmar pago</h1>
        <p className="m-0 mb-6 text-sm text-uva-text-muted">{plan || "Plan"}</p>

        <dl className="mb-6 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-uva-text-muted">Total a pagar</dt>
            <dd className="font-mono text-base tabular-nums text-uva-text">
              {formatearPrecio(monto, moneda)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-uva-text-muted">Referencia</dt>
            <dd className="font-mono text-[11.5px] text-uva-text-faint">{referencia}</dd>
          </div>
        </dl>

        <SimuladorControles
          referencia={referencia}
          montoCentavos={monto}
          moneda={moneda}
          urlRetorno={retorno}
        />
      </div>
    </main>
  );
}
