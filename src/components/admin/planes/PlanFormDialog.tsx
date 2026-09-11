"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crearPlan, actualizarPlan } from "@/actions/admin/planes";
import { MONEDAS_PLAN, NIVELES_ACCESO_PLAN, type PlanInput } from "@/lib/admin/planes-tipos";
import { useAdminToast } from "@/components/admin/Toast";
import type { PlanAdmin } from "@/lib/admin/planes";

const ETIQUETA_NIVEL: Record<(typeof NIVELES_ACCESO_PLAN)[number], string> = {
  TOTAL: "Total (todo el catálogo)",
  BASICO: "Básico",
};

export function PlanFormDialog({
  open,
  onOpenChange,
  plan,
  siguienteOrden,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: PlanAdmin | null;
  /** Orden sugerido para un plan nuevo — al final de la lista actual. */
  siguienteOrden: number;
}) {
  const [nombre, setNombre] = useState(plan?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(plan?.descripcion ?? "");
  const [precio, setPrecio] = useState(plan ? String(plan.precioCentavos / 100) : "");
  const [moneda, setMoneda] = useState<(typeof MONEDAS_PLAN)[number]>(
    (plan?.moneda as (typeof MONEDAS_PLAN)[number]) ?? "COP",
  );
  const [duracionDias, setDuracionDias] = useState(plan ? String(plan.duracionDias) : "30");
  const [nivelAcceso, setNivelAcceso] = useState<(typeof NIVELES_ACCESO_PLAN)[number]>(
    (plan?.nivelAcceso as (typeof NIVELES_ACCESO_PLAN)[number]) ?? "TOTAL",
  );
  const [orden, setOrden] = useState(String(plan?.orden ?? siguienteOrden));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showToast = useAdminToast();

  function resetAndClose() {
    setError(null);
    onOpenChange(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const input: PlanInput = {
      nombre,
      descripcion,
      precio: Number(precio),
      moneda,
      duracionDias: Number(duracionDias),
      nivelAcceso,
      orden: Number(orden),
    };

    const resultado = plan ? await actualizarPlan(plan.id, input) : await crearPlan(input);
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }

    showToast(plan ? "Plan actualizado." : "Plan creado.");
    resetAndClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
        else onOpenChange(next);
      }}
    >
      <DialogContent className="w-[460px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{plan ? "Editar plan" : "Nuevo plan"}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3.5">
            {error && (
              <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="plan-nombre">Nombre</Label>
              <Input
                id="plan-nombre"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Mensual, Anual…"
                required
              />
            </div>

            <div>
              <Label htmlFor="plan-descripcion">Descripción</Label>
              <Textarea
                id="plan-descripcion"
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
                className="min-h-[60px]"
                placeholder="Lo que ve el estudiante debajo del nombre del plan"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="plan-precio">Precio</Label>
                <Input
                  id="plan-precio"
                  type="number"
                  min="1"
                  step="1"
                  value={precio}
                  onChange={(event) => setPrecio(event.target.value)}
                  placeholder="89900"
                  required
                />
              </div>
              <div>
                <Label htmlFor="plan-moneda">Moneda</Label>
                <Select value={moneda} onValueChange={(value) => setMoneda(value as (typeof MONEDAS_PLAN)[number])}>
                  <SelectTrigger id="plan-moneda" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONEDAS_PLAN.map((codigo) => (
                      <SelectItem key={codigo} value={codigo}>
                        {codigo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="plan-duracion">Duración (días)</Label>
                <Input
                  id="plan-duracion"
                  type="number"
                  min="1"
                  step="1"
                  value={duracionDias}
                  onChange={(event) => setDuracionDias(event.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="plan-orden">Orden</Label>
                <Input
                  id="plan-orden"
                  type="number"
                  min="0"
                  step="1"
                  value={orden}
                  onChange={(event) => setOrden(event.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="plan-nivel">Nivel de acceso</Label>
              <Select
                value={nivelAcceso}
                onValueChange={(value) => setNivelAcceso(value as (typeof NIVELES_ACCESO_PLAN)[number])}
              >
                <SelectTrigger id="plan-nivel" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIVELES_ACCESO_PLAN.map((nivel) => (
                    <SelectItem key={nivel} value={nivel}>
                      {ETIQUETA_NIVEL[nivel]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
