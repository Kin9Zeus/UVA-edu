"use client";

import { useState } from "react";
import { Check } from "lucide-react";
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
import {
  comoPlanPublico,
  MONEDAS_PLAN,
  NIVELES_ACCESO_PLAN,
  referenciaDe,
  type PlanInput,
} from "@/lib/admin/planes-tipos";
import {
  ahorroEnMeses,
  BENEFICIOS_POR_DEFECTO,
  BENEFICIOS_POR_NIVEL,
  formatearPrecio,
  meta,
  periodo,
  sharedBenefits,
} from "@/lib/planes";
import { useAdminToast } from "@/components/admin/Toast";
import type { PlanAdmin } from "@/lib/admin/planes";

/**
 * `nivel_acceso` no limita el acceso: con cualquier plan se entra a todo el
 * catálogo. Solo decide cuántos beneficios anuncia la página de precios
 * (`BENEFICIOS_POR_NIVEL`), así que se nombra por lo que hace.
 */
const ETIQUETA_NIVEL: Record<(typeof NIVELES_ACCESO_PLAN)[number], string> = {
  TOTAL: `Los ${sharedBenefits.length} beneficios`,
  BASICO: `Solo los ${BENEFICIOS_POR_NIVEL.BASICO} primeros`,
};

const ETIQUETA_MONEDA: Record<(typeof MONEDAS_PLAN)[number], string> = {
  COP: "Pesos (COP)",
  USD: "Dólares (USD)",
};

/** La tarjeta de la página de precios con lo que va escrito, calculada como allá (home/Pricing.tsx). */
function VistaPrevia({ plan, otros }: { plan: Omit<PlanAdmin, "activo" | "orden">; otros: PlanAdmin[] }) {
  const fila = comoPlanPublico(plan);
  const completo = plan.precioCentavos > 0 && plan.duracionDias > 0;
  const referencia = referenciaDe([...otros.filter((o) => o.activo && o.id !== plan.id).map(comoPlanPublico), fila]);
  const ahorro = completo && referencia ? ahorroEnMeses(fila, referencia) : null;
  const beneficios = sharedBenefits.slice(0, BENEFICIOS_POR_NIVEL[plan.nivelAcceso ?? ""] ?? BENEFICIOS_POR_DEFECTO);
  return (
    <div className="flex flex-col gap-1.5 rounded-uva-md border border-uva-divider bg-uva-bg px-3.5 py-3">
      <p className="m-0 text-uva-detalle font-bold text-uva-text-muted">Así se ve en la página de precios</p>
      <div className="flex flex-col gap-1.5 rounded-uva-md border border-uva-divider bg-uva-surface p-4">
        <p className="m-0 flex items-start justify-between gap-2 font-extrabold text-uva-text">
          <span className="min-w-0 break-words">{plan.nombre.trim() || "Nombre del plan"}</span>
          {ahorro && (
            <span className="shrink-0 rounded-full bg-uva-accent-soft px-2 py-0.5 text-uva-etiqueta font-bold text-uva-accent-text">
              {ahorro}
            </span>
          )}
        </p>
        {completo ? (
          <p className="m-0 font-mono text-uva-titulo-3 font-extrabold text-uva-text">
            {formatearPrecio(plan.precioCentavos, plan.moneda)}
            <span className="font-sans text-uva-detalle font-medium text-uva-text-muted">{periodo(plan.duracionDias)}</span>
          </p>
        ) : (
          <p className="m-0 text-uva-detalle text-uva-text-muted">Escribe el precio y la duración.</p>
        )}
        {completo && <p className="m-0 text-uva-detalle text-uva-text-muted">{meta(fila)}</p>}
        <ul className="mt-1 flex flex-col gap-1 text-uva-detalle text-uva-text">
          {beneficios.map((beneficio) => (
            <li key={beneficio} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-uva-accent-ink" aria-hidden />
              {beneficio}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PlanFormDialog({
  open,
  onOpenChange,
  plan,
  planes,
  siguienteOrden,
  conVentas,
  cobroActivo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: PlanAdmin | null;
  /** Todos los planes: el ahorro de la vista previa se mide contra el más corto a la venta. */
  planes: PlanAdmin[];
  /** Orden sugerido para un plan nuevo — al final de la lista actual. */
  siguienteOrden: number;
  /** El plan que se edita tiene membresías pagadas o ventas recientes. */
  conVentas: boolean;
  cobroActivo: boolean;
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

    showToast(
      plan
        ? `Guardaste los cambios de ${input.nombre.trim()}.`
        : `Creaste ${input.nombre.trim()}.${cobroActivo ? "" : " Se venderá cuando se encienda el cobro."}`,
    );
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
            <DialogTitle>{plan ? `Editar ${plan.nombre}` : "Nuevo plan"}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3.5">
            {error && (
              <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-uva-detalle text-uva-error-text">
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
                placeholder="Acceso completo al catálogo, facturado cada mes."
              />
              <p className="mt-1 text-uva-detalle text-uva-text-faint">
                Va debajo del nombre. Si la dejas vacía, se muestra «Facturado cada N días».
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="plan-precio">Precio</Label>
                <Input
                  id="plan-precio"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={precio}
                  onChange={(event) => setPrecio(event.target.value)}
                  placeholder="89900 o 69.99"
                  required
                />
                {/* step="0.01" (no "1"): un COP como 89900 no necesita
                    centavos, pero un USD como 69.99 sí — el input HTML
                    valida contra `step` al enviar, así que con step="1" el
                    navegador rechazaba cualquier valor con decimales antes
                    de que la Server Action (que sí los acepta, ver
                    validar() en actions/admin/planes.ts) llegara a verlo. */}
                <p className="mt-1 text-uva-detalle text-uva-text-faint">Admite centavos: 69.99, 89900.</p>
              </div>
              <div>
                <Label htmlFor="plan-moneda">Moneda</Label>
                <Select items={ETIQUETA_MONEDA} value={moneda} onValueChange={(value) => setMoneda(value as (typeof MONEDAS_PLAN)[number])}>
                  <SelectTrigger id="plan-moneda" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONEDAS_PLAN.map((codigo) => (
                      <SelectItem key={codigo} value={codigo}>
                        {ETIQUETA_MONEDA[codigo]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="plan-duracion">Duración en días</Label>
                <Input
                  id="plan-duracion"
                  type="number"
                  min="1"
                  step="1"
                  value={duracionDias}
                  onChange={(event) => setDuracionDias(event.target.value)}
                  required
                />
                <p className="mt-1 text-uva-detalle text-uva-text-faint">
                  {Number(duracionDias) > 0 ? `Se muestra como «${periodo(Number(duracionDias))}».` : "Los días de acceso de cada compra."}
                </p>
              </div>
              <div>
                <Label htmlFor="plan-orden">Posición</Label>
                <Input
                  id="plan-orden"
                  type="number"
                  min="0"
                  step="1"
                  value={orden}
                  onChange={(event) => setOrden(event.target.value)}
                  required
                />
                <p className="mt-1 text-uva-detalle text-uva-text-faint">El 1 sale primero en la página de precios.</p>
              </div>
            </div>

            <div>
              <Label htmlFor="plan-nivel">Beneficios que se anuncian</Label>
              <Select
                items={ETIQUETA_NIVEL}
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
              <p className="mt-1 text-uva-detalle text-uva-text-faint">
                Solo cambia la lista de la página de precios. Con cualquier plan se entra a todo el catálogo.
              </p>
            </div>

            <VistaPrevia
              plan={{
                id: plan?.id ?? "nuevo",
                nombre,
                descripcion: descripcion.trim() || null,
                precioCentavos: Math.round(Number(precio) * 100) || 0,
                moneda,
                duracionDias: Math.floor(Number(duracionDias)) || 0,
                nivelAcceso,
              }}
              otros={planes}
            />

            {plan && conVentas && (
              <p className="border-l-3 border-uva-divider pl-2.5 text-uva-detalle text-uva-text-muted">
                Quien ya pagó conserva su precio y sus días. Los cambios aplican a las compras nuevas.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Guardando…" : plan ? "Guardar cambios" : "Crear plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
