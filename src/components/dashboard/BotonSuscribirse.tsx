"use client";

import { useState } from "react";
import { TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { iniciarCheckout } from "@/actions/suscripciones/checkout";
import { validarCodigoCupon, type DesgloseVisible } from "@/actions/cupones/validar";

/**
 * "Elegir plan" + cupón opcional, desde la pantalla de Planes.
 *
 * No hay `router.refresh()` al final como en `CanjearCodigoForm`: cuando el
 * checkout sale bien esta página deja de existir — `iniciarCheckout` termina
 * en un `redirect()` del servidor hacia el Web Checkout de Wompi. Solo se
 * vuelve de esta función cuando algo impidió cobrar, y entonces lo que llega
 * es un `error`.
 *
 * El cupón se valida contra el servidor antes de pagar para que el estudiante
 * vea el descuento aplicado y no descubra el precio real en la pasarela. Ese
 * desglose sale de la misma función que después firma el monto
 * (`calcularDesglose`), así que lo que se muestra aquí es exactamente lo que
 * se va a cobrar.
 */
export function BotonSuscribirse({
  idPlan,
  nombrePlan,
  destacado,
}: {
  idPlan: string;
  nombrePlan: string;
  destacado: boolean;
}) {
  const [mostrarCupon, setMostrarCupon] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [desglose, setDesglose] = useState<DesgloseVisible | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);
  const [pagando, setPagando] = useState(false);

  const idCupon = `cupon-${idPlan}`;

  async function comprobarCupon() {
    setValidando(true);
    setError(null);
    const resultado = await validarCodigoCupon(idPlan, codigo);
    setValidando(false);

    if (resultado.ok) {
      setDesglose(resultado.desglose);
    } else {
      setDesglose(null);
      setError(resultado.error);
    }
  }

  async function pagar() {
    setPagando(true);
    setError(null);

    // Solo se manda el cupón si quedó validado: mandar un código que ya falló
    // haría que el Server Action lo rechazara otra vez, con el mismo mensaje
    // que el estudiante ya vio.
    const resultado = await iniciarCheckout(idPlan, desglose ? codigo : undefined);

    // Solo se llega aquí si NO hubo redirect, es decir, si algo falló.
    setPagando(false);
    if (resultado?.error) setError(resultado.error);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={destacado ? "uva-primary" : "uva-secondary"}
        size="uva"
        onClick={pagar}
        disabled={pagando || validando}
      >
        {pagando ? "Llevándote a pagar…" : `Elegir ${nombrePlan}`}
      </Button>

      {!mostrarCupon ? (
        <button
          type="button"
          onClick={() => setMostrarCupon(true)}
          className="inline-flex items-center justify-center gap-1.5 text-[12.5px] text-uva-text-muted underline-offset-2 hover:text-uva-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
        >
          <TicketPercent className="size-3.5" aria-hidden />
          Tengo un cupón
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor={idCupon} className="text-[12.5px] text-uva-text-muted">
            Código de cupón
          </Label>
          <div className="flex gap-2">
            <Input
              id={idCupon}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="LANZAMIENTO"
              autoComplete="off"
              disabled={validando || pagando}
              className="h-9 text-sm"
            />
            <Button
              type="button"
              variant="uva-secondary"
              onClick={comprobarCupon}
              disabled={validando || pagando || codigo.trim().length === 0}
              className="h-9 shrink-0 px-3 text-sm"
            >
              {validando ? "…" : "Aplicar"}
            </Button>
          </div>
        </div>
      )}

      {desglose && (
        <dl className="flex flex-col gap-1 rounded-uva-md border border-uva-divider bg-uva-surface px-3 py-2.5 text-[12.5px]">
          <div className="flex justify-between text-uva-text-muted">
            <dt>Precio</dt>
            <dd className="font-mono tabular-nums">{desglose.subtotal}</dd>
          </div>
          <div className="flex justify-between text-uva-accent-2-text">
            <dt>Cupón {codigo}</dt>
            <dd className="font-mono tabular-nums">−{desglose.descuento}</dd>
          </div>
          <div className="flex justify-between border-t border-uva-divider pt-1.5 font-semibold text-uva-text">
            <dt>Total</dt>
            <dd className="font-mono tabular-nums">{desglose.total}</dd>
          </div>
        </dl>
      )}

      {error && (
        <p
          role="alert"
          className="m-0 rounded-uva-md bg-uva-error-soft px-3 py-2 text-[12.5px] text-uva-error-text"
        >
          {error}
        </p>
      )}
    </div>
  );
}
