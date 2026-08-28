"use client";

import { useState } from "react";
import { Copy, Check, Pencil, Trash2 } from "lucide-react";
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
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SwitchEstado } from "@/components/admin/SwitchEstado";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/Toast";
import { CodigoFormDialog } from "@/components/admin/codigos/CodigoFormDialog";
import {
  eliminarCodigoInvitacion,
  toggleActivoCodigoInvitacion,
} from "@/actions/admin/codigosInvitacion";
import { formatFecha } from "@/lib/admin/format";
import type { CodigoInvitacion } from "@/lib/admin/codigosInvitacion";
import type { EstadoCodigo } from "@/lib/codigoInvitacion";

const TONO_ESTADO: Record<EstadoCodigo, "success" | "neutral" | "warning" | "error"> = {
  ACTIVO: "success",
  INACTIVO: "neutral",
  VENCIDO: "warning",
  AGOTADO: "warning",
};

const ETIQUETA_ESTADO: Record<EstadoCodigo, string> = {
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
  VENCIDO: "Vencido",
  AGOTADO: "Agotado",
};

export function CodigosTable({ codigos }: { codigos: CodigoInvitacion[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<CodigoInvitacion | null>(null);
  const [borrando, setBorrando] = useState<CodigoInvitacion | null>(null);
  // Código recién generado: se muestra destacado arriba para copiarlo, ya
  // que es el motivo por el que se entró a esta pantalla.
  const [recienCreado, setRecienCreado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const showToast = useAdminToast();

  function abrirCrear() {
    setEditando(null);
    setFormOpen(true);
  }

  function abrirEditar(codigo: CodigoInvitacion) {
    setEditando(codigo);
    setFormOpen(true);
  }

  async function handleCopiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(codigo);
      setTimeout(() => setCopiado((actual) => (actual === codigo ? null : actual)), 2000);
    } catch {
      showToast("No pudimos copiar. Selecciona el código y cópialo a mano.", "error");
    }
  }

  async function handleToggle(codigo: CodigoInvitacion, activo: boolean) {
    const resultado = await toggleActivoCodigoInvitacion(codigo.id, activo);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(activo ? "Código activado." : "Código desactivado.");
  }

  async function handleEliminar() {
    if (!borrando) return;
    const resultado = await eliminarCodigoInvitacion(borrando.id);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast("Código eliminado.");
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex justify-end">
        <Button type="button" variant="primary" onClick={abrirCrear}>
          + Nuevo código
        </Button>
      </div>

      {recienCreado && (
        <div className="rounded-uva-md border border-uva-accent/40 bg-uva-accent-soft px-4 py-3.5">
          <p className="text-xs font-semibold text-uva-accent-text">
            Código generado. Compártelo con quien va a recibir el acceso:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-uva-md bg-uva-surface-2 px-3 py-2 font-mono text-[15px] font-semibold tracking-[0.08em] text-uva-text">
              {recienCreado}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-auto"
              onClick={() => handleCopiar(recienCreado)}
            >
              {copiado === recienCreado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado === recienCreado ? "Copiado" : "Copiar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto w-auto text-uva-muted"
              onClick={() => setRecienCreado(null)}
            >
              Listo
            </Button>
          </div>
        </div>
      )}

      <AdminCard flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Acceso</TableHead>
              <TableHead>Usos</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado por</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {codigos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-uva-muted-2">
                  No hay códigos de invitación todavía.
                </TableCell>
              </TableRow>
            )}
            {codigos.map((codigo) => (
              <TableRow key={codigo.id}>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => handleCopiar(codigo.codigo)}
                    title="Copiar código"
                    className="flex items-center gap-1.5 font-mono text-[13px] font-semibold tracking-[0.06em] text-uva-text hover:text-uva-accent-text"
                  >
                    {codigo.codigo}
                    {copiado === codigo.codigo ? (
                      <Check className="size-3.5 text-uva-accent" />
                    ) : (
                      <Copy className="size-3.5 text-uva-muted-2" />
                    )}
                  </button>
                </TableCell>
                <TableCell className="text-uva-muted">{codigo.duracionDias} días</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {codigo.vecesUsado}
                  <span className="text-uva-muted-2">/{codigo.limiteUsos}</span>
                </TableCell>
                <TableCell className="font-mono text-[12px] text-uva-muted-2 tabular-nums">
                  {formatFecha(codigo.fechaVencimiento)}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={TONO_ESTADO[codigo.estado]}>
                    {ETIQUETA_ESTADO[codigo.estado]}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-[12px] text-uva-muted-2">{codigo.creadoPor}</TableCell>
                <TableCell className="text-right">
                  {/* `justify-end` con un tercer botón condicional corría todo
                      el grupo hacia la derecha cuando la papelera no aparecía:
                      al ser un bloque anclado al borde, cambiar su ancho movía
                      switch y editar de columna entre una fila y otra. Con un
                      grid de 3 columnas fijas cada botón vive siempre en la
                      misma posición; cuando no hay papelera, la última celda
                      queda vacía (mismo ancho reservado) en vez de desaparecer. */}
                  <div className="grid grid-cols-[auto_auto_28px] items-center justify-end gap-1.5">
                    <SwitchEstado
                      checked={codigo.activo}
                      onCheckedChange={(checked) => handleToggle(codigo, checked)}
                      etiquetas={["", ""]}
                      acciones={["Activar código", "Desactivar código "]}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar código"
                      title="Editar vencimiento y límite de usos"
                      className="text-uva-muted-2 hover:text-uva-accent"
                      onClick={() => abrirEditar(codigo)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {/* Solo se ofrece borrar lo que nunca se canjeó: un código
                        usado dejaría suscripciones sin rastro de su origen
                        (la FK es ON DELETE SET NULL). Para esos, el
                        interruptor de al lado. */}
                    {codigo.vecesUsado === 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Eliminar código"
                        title="Eliminar código"
                        className="text-uva-muted-2 hover:text-uva-accent"
                        onClick={() => setBorrando(codigo)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminCard>

      <CodigoFormDialog
        key={editando?.id ?? "nuevo"}
        open={formOpen}
        onOpenChange={setFormOpen}
        codigo={editando}
        onCreado={(codigo) => {
          setRecienCreado(codigo);
          setCopiado(null);
        }}
      />

      <ConfirmDialog
        open={borrando !== null}
        onOpenChange={(open) => !open && setBorrando(null)}
        title="Eliminar código"
        description={`¿Seguro que quieres eliminar "${borrando?.codigo}"? Nunca se canjeó, así que no afecta a ninguna suscripción.`}
        onConfirm={handleEliminar}
      />
    </div>
  );
}
