"use client";

import { useState, type ReactNode } from "react";
import { Info, Pencil, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AdminCard } from "@/components/admin/AdminCard";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SwitchEstado } from "@/components/admin/SwitchEstado";
import { useAdminToast } from "@/components/admin/Toast";
import { PlanFormDialog } from "@/components/admin/planes/PlanFormDialog";
import { toggleActivoPlan } from "@/actions/admin/planes";
import { ahorroEnMeses, formatearPrecio, meta, periodo, type PlanRow } from "@/lib/planes";
import { comoPlanPublico, DIAS_AVISO_VENCE, mesesDe, referenciaDe } from "@/lib/admin/planes-tipos";
import type { VentasDePlan, VentasPlanes } from "@/lib/admin/planes-ventas";
import type { PlanAdmin } from "@/lib/admin/planes";
import { cn } from "@/lib/utils";

const SIN_VENTAS: VentasDePlan = { vigentes: 0, vencen: 0, ventas30: 0 };

/** A la venta primero, en el orden de la página de precios; los retirados al final. */
function ordenar(planes: PlanAdmin[]) {
  return [...planes].sort((a, b) => Number(b.activo) - Number(a.activo) || a.orden - b.orden);
}

export function PlanesTable({
  planes,
  ventas,
  cobroActivo,
  encabezado,
  resumen,
}: {
  planes: PlanAdmin[];
  /** Null con el cobro apagado. */
  ventas: VentasPlanes | null;
  cobroActivo: boolean;
  encabezado: ReactNode;
  resumen: ReactNode;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<PlanAdmin | null>(null);
  const [retirando, setRetirando] = useState<PlanAdmin | null>(null);
  const showToast = useAdminToast();

  const siguienteOrden = planes.length > 0 ? Math.max(...planes.map((plan) => plan.orden)) + 1 : 1;
  const aLaVenta = planes.filter((plan) => plan.activo);
  const referencia = referenciaDe(aLaVenta.map(comoPlanPublico));
  const ventasDe = (plan: PlanAdmin) => ventas?.porPlan[plan.id] ?? SIN_VENTAS;

  function abrirCrear() {
    setEditando(null);
    setFormOpen(true);
  }

  function abrirEditar(plan: PlanAdmin) {
    setEditando(plan);
    setFormOpen(true);
  }

  async function cambiarVenta(plan: PlanAdmin, activo: boolean) {
    const resultado = await toggleActivoPlan(plan.id, activo);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(activo ? `${plan.nombre} vuelve a estar a la venta.` : `Retiraste ${plan.nombre}. Ya no se puede comprar.`);
  }

  // Poner a la venta no tiene vuelta atrás que temer; retirar sí pide
  // confirmación, porque saca el plan de la página de precios.
  const onSwitch = (plan: PlanAdmin, activo: boolean) => (activo ? cambiarVenta(plan, true) : setRetirando(plan));

  const vigentesRetirando = retirando ? ventasDe(retirando).vigentes : 0;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-[28rem]">{encabezado}</div>
        {planes.length > 0 && (
          <Button type="button" variant="primary" className="max-sm:w-full" onClick={abrirCrear}>
            <Plus aria-hidden />
            Nuevo plan
          </Button>
        )}
      </div>

      {!cobroActivo && (
        <div role="note" className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3 rounded-uva-lg border border-uva-line-strong bg-uva-surface p-4 sm:px-5">
          <Info className="mt-0.5 size-5 text-uva-accent-ink" aria-hidden />
          <div>
            <p className="font-bold text-uva-text">Los planes todavía no se venden</p>
            <p className="mt-0.5 max-w-[80ch] text-uva-detalle text-uva-text-muted">
              El cobro está apagado: la página de precios está oculta y hoy se entra con códigos de
              invitación. Puedes dejar los planes listos; se venden con estos precios el día que se
              encienda el cobro.
            </p>
          </div>
        </div>
      )}

      {planes.length > 0 && resumen}

      {planes.length === 0 ? (
        <AdminCard className="items-center gap-1.5 px-5 py-10 text-center">
          <p className="text-uva-titulo-4 text-uva-text">Todavía no hay planes</p>
          <p className="max-w-[46ch] text-uva-detalle text-uva-text-muted">
            Crea el primero: un precio y los días de acceso que da. Es lo que el estudiante compra en la
            página de precios.
          </p>
          <Button type="button" variant="primary" className="mt-3" onClick={abrirCrear}>
            <Plus aria-hidden />
            Nuevo plan
          </Button>
        </AdminCard>
      ) : (
        <section aria-label="Lista de planes" className="flex flex-col gap-3.5">
          <p className="max-w-[80ch] text-uva-detalle text-uva-text-muted">
            Salen en este orden en la página de precios.
            {cobroActivo &&
              " Aquí solo cuentan las membresías pagadas: las otorgadas a mano y las de códigos se ven en Usuarios y en Códigos."}
          </p>

          <AdminCard flush>
            <ul className="flex flex-col pointer-fine:md:hidden">
              {ordenar(planes).map((plan) => (
                <li key={plan.id} className="flex flex-col gap-3 border-b border-uva-divider px-4 py-4 last:border-b-0 sm:px-5">
                  <Nombre plan={plan} />
                  <Precio plan={plan} referencia={referencia} />
                  {cobroActivo && (
                    <div className="flex flex-wrap gap-x-7 gap-y-2">
                      <Vigentes ventas={ventasDe(plan)} />
                      <Ventas30 ventas={ventasDe(plan)} />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <EnVenta plan={plan} onCambio={onSwitch} />
                    <BotonEditar plan={plan} onEditar={abrirEditar} />
                  </div>
                </li>
              ))}
            </ul>

            <Table contenedorClassName="hidden pointer-fine:md:block" etiqueta="Tabla de planes">
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Precio</TableHead>
                  {cobroActivo && <TableHead>Vigentes</TableHead>}
                  {cobroActivo && <TableHead>Ventas</TableHead>}
                  <TableHead>Página de precios</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenar(planes).map((plan) => {
                  return (
                    <TableRow key={plan.id}>
                      <TableCell className="min-w-56 whitespace-normal">
                        <Nombre plan={plan} />
                      </TableCell>
                      <TableCell>
                        <Precio plan={plan} referencia={referencia} />
                      </TableCell>
                      {cobroActivo && (
                        <TableCell>
                          <Vigentes ventas={ventasDe(plan)} />
                        </TableCell>
                      )}
                      {cobroActivo && (
                        <TableCell>
                          <Ventas30 ventas={ventasDe(plan)} />
                        </TableCell>
                      )}
                      <TableCell>
                        <EnVenta plan={plan} onCambio={onSwitch} />
                      </TableCell>
                      <TableCell className="text-right">
                        <BotonEditar plan={plan} onEditar={abrirEditar} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </AdminCard>
        </section>
      )}

      <PlanFormDialog
        key={editando?.id ?? "nuevo"}
        open={formOpen}
        onOpenChange={setFormOpen}
        plan={editando}
        planes={planes}
        siguienteOrden={siguienteOrden}
        conVentas={!!editando && (ventasDe(editando).vigentes > 0 || ventasDe(editando).ventas30 > 0)}
        cobroActivo={cobroActivo}
      />

      <ConfirmDialog
        open={retirando !== null}
        onOpenChange={(open) => !open && setRetirando(null)}
        title={`¿Retirar ${retirando?.nombre ?? "el plan"}?`}
        description={
          <>
            {cobroActivo
              ? "Deja de aparecer en la página de precios y ya no se puede comprar."
              : "No se venderá cuando se encienda el cobro."}
            {vigentesRetirando > 0 &&
              ` ${vigentesRetirando === 1 ? "La membresía pagada sigue" : `Las ${vigentesRetirando} membresías pagadas siguen`} hasta su fecha.`}{" "}
            Tampoco sale en «Otorgar membresía», en Usuarios. Puedes volver a ponerlo a la venta cuando quieras.
            {retirando?.activo && aLaVenta.length === 1 && (
              <span className="mt-2 block font-bold text-uva-warning-text">
                Es el único plan a la venta: la página de precios quedará sin planes.
              </span>
            )}
          </>
        }
        confirmLabel="Retirar plan"
        destructive
        onConfirm={async () => {
          if (retirando) await cambiarVenta(retirando, false);
        }}
      />
    </div>
  );
}

function Nombre({ plan }: { plan: PlanAdmin }) {
  const fila = comoPlanPublico(plan);
  return (
    <div className="min-w-0">
      <p className="m-0 flex flex-wrap items-center gap-2 font-bold text-uva-text">
        {plan.nombre}
        {!plan.activo && <StatusBadge tone="neutral">Retirado</StatusBadge>}
      </p>
      {/* Sin descripción, la página de precios pone una automática: se
          muestra cuál en vez de un "—". */}
      <p className={cn("mt-0.5 max-w-[46ch] text-uva-detalle text-uva-text-muted", !plan.descripcion && "italic")}>
        {plan.descripcion ?? `Sin descripción: se muestra «${meta(fila)}»`}
      </p>
    </div>
  );
}

/** El precio como lo escribe la página de precios, con las mismas funciones. */
function Precio({ plan, referencia }: { plan: PlanAdmin; referencia: PlanRow | null }) {
  const fila = comoPlanPublico(plan);
  const meses = mesesDe(plan.duracionDias);
  const ahorro = plan.activo && referencia ? ahorroEnMeses(fila, referencia) : null;
  return (
    <div className="flex flex-col items-start gap-1">
      <p className="m-0 font-mono font-extrabold whitespace-nowrap text-uva-text">
        {formatearPrecio(plan.precioCentavos, plan.moneda)}
        <span className="font-sans text-uva-detalle font-medium text-uva-text-muted">{periodo(plan.duracionDias)}</span>
      </p>
      {meses > 1 && (
        <p className="m-0 text-uva-detalle whitespace-nowrap text-uva-text-muted">
          Equivale a {formatearPrecio(Math.round(plan.precioCentavos / meses / 100) * 100, plan.moneda)} al mes
        </p>
      )}
      {ahorro && (
        <span className="rounded-full bg-uva-accent-soft px-2 py-0.5 text-uva-etiqueta font-bold text-uva-accent-text">{ahorro}</span>
      )}
    </div>
  );
}

function Vigentes({ ventas }: { ventas: VentasDePlan }) {
  return (
    <p className="m-0 text-uva-detalle whitespace-nowrap text-uva-text">
      <span className="font-mono text-uva-cuerpo font-bold">{ventas.vigentes}</span>
      <span className="block text-uva-text-muted">{ventas.vigentes === 1 ? "pagada vigente" : "pagadas vigentes"}</span>
      {ventas.vencen > 0 && (
        <span className="block font-bold text-uva-warning-text">
          {ventas.vencen} {ventas.vencen === 1 ? "vence" : "vencen"} en {DIAS_AVISO_VENCE} días
        </span>
      )}
    </p>
  );
}

function Ventas30({ ventas }: { ventas: VentasDePlan }) {
  return (
    <p className="m-0 text-uva-detalle whitespace-nowrap text-uva-text">
      <span className="font-mono text-uva-cuerpo font-bold">{ventas.ventas30}</span>
      <span className="block text-uva-text-muted">{ventas.ventas30 === 1 ? "venta" : "ventas"} en 30 días</span>
    </p>
  );
}

function EnVenta({ plan, onCambio }: { plan: PlanAdmin; onCambio: (plan: PlanAdmin, activo: boolean) => void }) {
  return (
    <SwitchEstado
      checked={plan.activo}
      onCheckedChange={(activo) => onCambio(plan, activo)}
      etiquetas={["A la venta", "Retirado"]}
      acciones={[`Poner ${plan.nombre} a la venta`, `Retirar ${plan.nombre}`]}
    />
  );
}

function BotonEditar({ plan, onEditar }: { plan: PlanAdmin; onEditar: (plan: PlanAdmin) => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Editar ${plan.nombre}`}
      title="Editar plan"
      className="text-uva-muted-2 hover:text-uva-accent-ink"
      onClick={() => onEditar(plan)}
    >
      <Pencil className="size-4" />
    </Button>
  );
}
