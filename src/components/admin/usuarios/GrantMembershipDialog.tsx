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

type Plan = { id: string; nombre: string; precio_centavos: number; moneda: string };

export function GrantMembershipDialog({
  open,
  onOpenChange,
  usuarioId,
  planActual,
  planes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuarioId: string;
  planActual: string | null;
  planes: Plan[];
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
    showToast(`Membresía "${planElegido.nombre}" otorgada.`);
    cerrar();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : cerrar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Otorgar membresía</DialogTitle>
          {paso === "elegir" && <DialogDescription>Elige el plan que quieres asignar manualmente.</DialogDescription>}
        </DialogHeader>

        {error && (
          <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
            {error}
          </div>
        )}

        {paso === "elegir" && (
          <div className="flex flex-col gap-2">
            {planes.length === 0 && (
              <p className="text-[13.5px] text-uva-muted-2">No hay planes activos configurados.</p>
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
                  "flex w-full items-center justify-between rounded-uva-md border border-uva-divider bg-uva-surface px-4 py-2.5 text-left text-[13.5px] font-semibold text-uva-text hover:bg-uva-hover",
                )}
              >
                <span>{plan.nombre}</span>
                <span className="font-mono text-[12px] font-normal text-uva-muted-2 tabular-nums">
                  {formatMoneda(plan.precio_centavos, plan.moneda)}
                </span>
              </button>
            ))}
          </div>
        )}

        {paso === "confirmar" && planElegido && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-uva-text-muted">
              Plan actual: <span className="text-uva-text">{planActual ?? "Ninguno"}</span>
            </p>
            <p className="text-uva-text-muted">
              Nuevo plan: <span className="text-uva-accent-text">{planElegido.nombre}</span> (
              {formatMoneda(planElegido.precio_centavos, planElegido.moneda)})
            </p>
            <p className="text-uva-text-faint">
              La suscripción quedará en estado Activa de inmediato, sin pasar por Stripe/Wompi. El
              estudiante la verá en su perfil como &ldquo;Acceso otorgado por U.V.A.&rdquo;, sin
              historial de pagos.
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
              {pending ? "Otorgando…" : "Confirmar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
