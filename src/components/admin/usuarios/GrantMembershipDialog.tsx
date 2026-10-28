"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { otorgarMembresia } from "@/actions/admin/usuarios";
import { useAdminToast } from "@/components/admin/Toast";
import { formatMoneda } from "@/lib/admin/format";

type Plan = { id: string; nombre: string; precio_centavos: number; moneda: string; duracion_dias: number };

const dias = (plan: Plan) => `${plan.duracion_dias} ${plan.duracion_dias === 1 ? "día" : "días"}`;

export function GrantMembershipDialog({
  open,
  onOpenChange,
  usuarioId,
  planActual,
  planes,
  conCobro,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuarioId: string;
  planActual: string | null;
  planes: Plan[];
  /** Con el cobro apagado el precio no dice nada: se muestran solo los días. */
  conCobro: boolean;
}) {
  const [paso, setPaso] = useState<"elegir" | "confirmar">("elegir");
  const [planElegido, setPlanElegido] = useState<Plan | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showToast = useAdminToast();

  function cerrar() {
    onOpenChange(false);
    setPaso("elegir");
    setPlanElegido(null);
    setError(null);
  }

  async function confirmar() {
    if (!planElegido) return;
    setPending(true);
    setError(null);
    const resultado = await otorgarMembresia(usuarioId, planElegido.id);
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    showToast(`Le diste ${dias(planElegido)} de acceso.`);
    cerrar();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : cerrar())}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dar acceso</DialogTitle>
          {paso === "elegir" && <DialogDescription>Elige cuántos días. Empieza hoy y no se le cobra nada.</DialogDescription>}
        </DialogHeader>

        {error && (
          <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-uva-detalle text-uva-error-text">
            {error}
          </div>
        )}

        {paso === "elegir" && (
          <div className="flex flex-col gap-2">
            {planes.length === 0 && (
              <p className="text-uva-detalle text-uva-muted-2">No hay planes activos configurados.</p>
            )}
            {planes.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => {
                  setPlanElegido(plan);
                  setPaso("confirmar");
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-uva-md border border-uva-divider bg-uva-surface px-4 py-2.5 text-left text-uva-detalle font-semibold text-uva-text hover:bg-uva-hover",
                )}
              >
                <span>{plan.nombre}</span>
                <span className="text-uva-detalle font-normal text-uva-text-muted tabular-nums">
                  {dias(plan)}
                  {conCobro && ` · cuesta ${formatMoneda(plan.precio_centavos, plan.moneda)}`}
                </span>
              </button>
            ))}
          </div>
        )}

        {paso === "confirmar" && planElegido && (
          <div className="flex flex-col gap-3 text-uva-detalle">
            <p className="m-0 text-uva-text-muted">
              Acceso de ahora: <span className="text-uva-text">{planActual ?? "Ninguno"}</span>
            </p>
            <p className="m-0 text-uva-text-muted">
              Le das: <span className="font-semibold text-uva-text">{planElegido.nombre}</span>, {dias(planElegido)}
            </p>
            <p className="m-0 text-uva-text-muted">
              Empieza hoy y no se le cobra nada. Lo verá en su perfil como &ldquo;Acceso otorgado por U.V.A.&rdquo;.
            </p>
          </div>
        )}

        <DialogFooter>
          {paso === "confirmar" && (
            <Button type="button" variant="outline" onClick={() => setPaso("elegir")} disabled={pending}>
              Volver
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={cerrar} disabled={pending}>
            Cancelar
          </Button>
          {paso === "confirmar" && (
            <Button type="button" variant="primary" onClick={confirmar} disabled={pending}>
              {pending ? "Guardando…" : planElegido ? `Dar ${dias(planElegido)}` : "Dar acceso"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
