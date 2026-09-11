"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
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
import { SwitchEstado } from "@/components/admin/SwitchEstado";
import { useAdminToast } from "@/components/admin/Toast";
import { PlanFormDialog } from "@/components/admin/planes/PlanFormDialog";
import { toggleActivoPlan } from "@/actions/admin/planes";
import { formatMoneda } from "@/lib/admin/format";
import type { PlanAdmin } from "@/lib/admin/planes";

export function PlanesTable({ planes }: { planes: PlanAdmin[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<PlanAdmin | null>(null);
  const showToast = useAdminToast();

  const siguienteOrden = planes.length > 0 ? Math.max(...planes.map((plan) => plan.orden)) + 1 : 1;

  function abrirCrear() {
    setEditando(null);
    setFormOpen(true);
  }

  function abrirEditar(plan: PlanAdmin) {
    setEditando(plan);
    setFormOpen(true);
  }

  async function handleToggle(plan: PlanAdmin, activo: boolean) {
    const resultado = await toggleActivoPlan(plan.id, activo);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(activo ? "Plan activado." : "Plan desactivado.");
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex justify-end">
        <Button type="button" variant="primary" className="w-full sm:w-auto" onClick={abrirCrear}>
          + Nuevo plan
        </Button>
      </div>

      <AdminCard flush>
        {planes.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-uva-muted-2">No hay planes todavía.</p>
        )}

        {planes.length > 0 && (
          <div className="flex flex-col pointer-fine:md:hidden">
            {planes.map((plan) => (
              <div key={plan.id} className="flex flex-col gap-2 border-b border-uva-divider px-5 py-3.5 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => abrirEditar(plan)}
                    className="text-left text-sm font-semibold text-uva-text hover:text-uva-accent-text"
                  >
                    {plan.nombre}
                  </button>
                  <SwitchEstado
                    checked={plan.activo}
                    onCheckedChange={(checked) => handleToggle(plan, checked)}
                    etiquetas={["Activo", "Inactivo"]}
                    acciones={["Activar plan", "Desactivar plan"]}
                  />
                </div>
                <p className="font-mono text-[12px] text-uva-muted-2 tabular-nums">
                  {formatMoneda(plan.precioCentavos, plan.moneda)} · {plan.duracionDias} días
                </p>
                {plan.suscripcionesVigentes > 0 && (
                  <p className="text-xs text-uva-muted">
                    {plan.suscripcionesVigentes} suscripción{plan.suscripcionesVigentes === 1 ? "" : "es"} vigente
                    {plan.suscripcionesVigentes === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {planes.length > 0 && (
          <Table className="hidden pointer-fine:md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead>Suscripciones vigentes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {planes.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => abrirEditar(plan)}
                      className="text-left font-semibold text-uva-text hover:text-uva-accent-text"
                    >
                      {plan.nombre}
                    </button>
                    {plan.descripcion && (
                      <p className="mt-0.5 max-w-[260px] text-[12px] text-uva-muted-2">{plan.descripcion}</p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {formatMoneda(plan.precioCentavos, plan.moneda)}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">{plan.duracionDias} días</TableCell>
                  <TableCell className="text-uva-muted">{plan.nivelAcceso ?? "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums">{plan.suscripcionesVigentes}</TableCell>
                  <TableCell>
                    <SwitchEstado
                      checked={plan.activo}
                      onCheckedChange={(checked) => handleToggle(plan, checked)}
                      etiquetas={["Activo", "Inactivo"]}
                      acciones={["Activar plan", "Desactivar plan"]}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar plan"
                      title="Editar plan"
                      className="text-uva-muted-2 hover:text-uva-accent"
                      onClick={() => abrirEditar(plan)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminCard>

      <PlanFormDialog
        key={editando?.id ?? "nuevo"}
        open={formOpen}
        onOpenChange={setFormOpen}
        plan={editando}
        siguienteOrden={siguienteOrden}
      />
    </div>
  );
}
