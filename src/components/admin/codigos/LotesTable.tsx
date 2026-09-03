"use client";

import { useState } from "react";
import { Copy, Check, Trash2, Download, ListChecks } from "lucide-react";
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
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminToast } from "@/components/admin/Toast";
import { LoteFormDialog } from "@/components/admin/codigos/LoteFormDialog";
import { RedimidoresButton } from "@/components/admin/codigos/RedimidoresButton";
import {
  eliminarCodigoInvitacion,
  toggleActivoCodigoInvitacion,
} from "@/actions/admin/codigosInvitacion";
import { exportarCodigosInvitacionCsv } from "@/actions/admin/exportarCodigosInvitacion";
import { formatFecha } from "@/lib/admin/format";
import type { CodigoInvitacion } from "@/lib/admin/codigosInvitacion";
import type { LoteCodigosInvitacion } from "@/lib/admin/lotesCodigosInvitacion";
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

/**
 * Opción "Lote de códigos" (rev.md), alternativa a "Código único con cupo
 * N" (CodigosTable). Recibe solo los códigos con `idLote` no nulo — el
 * llamador (CodigosPanel) separa los dos conjuntos.
 */
export function LotesTable({
  lotes,
  codigos,
}: {
  lotes: LoteCodigosInvitacion[];
  codigos: CodigoInvitacion[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [loteAbierto, setLoteAbierto] = useState<LoteCodigosInvitacion | null>(null);
  const [borrando, setBorrando] = useState<CodigoInvitacion | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [exportandoLote, setExportandoLote] = useState<string | null>(null);
  const showToast = useAdminToast();

  const codigosDelLoteAbierto = loteAbierto
    ? codigos.filter((codigo) => codigo.idLote === loteAbierto.id)
    : [];

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
    showToast(
      activo
        ? "Código activado. Ya se puede volver a canjear."
        : "Código desactivado. Si ya se había canjeado, quien lo usó conserva su acceso.",
    );
  }

  async function handleEliminar() {
    if (!borrando) return;
    const resultado = await eliminarCodigoInvitacion(borrando.id);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast("Código eliminado.");
    setBorrando(null);
  }

  async function handleExportarLote(loteId: string) {
    setExportandoLote(loteId);
    try {
      const respuesta = await exportarCodigosInvitacionCsv(loteId);
      if (respuesta.error || !respuesta.csv || !respuesta.nombreArchivo) {
        showToast(respuesta.error ?? "No pudimos generar la exportación.", "error");
        return;
      }
      const blob = new Blob([respuesta.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = respuesta.nombreArchivo;
      enlace.click();
      URL.revokeObjectURL(url);
      showToast("Exportación descargada.");
    } finally {
      setExportandoLote(null);
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex justify-end">
        <Button type="button" variant="primary" className="w-full sm:w-auto" onClick={() => setFormOpen(true)}>
          + Nuevo lote
        </Button>
      </div>

      <AdminCard flush>
        {lotes.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-uva-muted-2">
            No hay lotes de códigos todavía.
          </p>
        )}

        {/* Mismo criterio que CodigosTable: 7 columnas no caben sin scroll
            horizontal en un touch. */}
        {lotes.length > 0 && (
          <div className="flex flex-col pointer-fine:md:hidden">
            {lotes.map((lote) => (
              <div
                key={lote.id}
                className="flex flex-col gap-2 border-b border-uva-divider px-5 py-3.5 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px] font-semibold text-uva-text">
                    {lote.cantidad} código(s)
                  </span>
                  <span className="shrink-0 font-mono text-[12px] text-uva-muted-2 tabular-nums">
                    Vence {formatFecha(lote.fechaVencimiento)}
                  </span>
                </div>
                <p className="font-mono text-[12px] text-uva-muted-2 tabular-nums">
                  {lote.duracionDias} días de acceso · {lote.canjeados}/{lote.cantidad} canjeados ·{" "}
                  {lote.activos} activos
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-uva-muted-2">Creado por {lote.creadoPor}</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-auto gap-1.5 text-uva-muted-2 hover:text-uva-accent"
                      onClick={() => setLoteAbierto(lote)}
                    >
                      <ListChecks className="size-4" />
                      Ver códigos
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Exportar CSV de este lote"
                      title="Exportar CSV de este lote"
                      className="text-uva-muted-2 hover:text-uva-accent pointer-coarse:p-3"
                      onClick={() => handleExportarLote(lote.id)}
                      disabled={exportandoLote === lote.id}
                    >
                      <Download className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {lotes.length > 0 && (
        <Table className="hidden pointer-fine:md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Lote</TableHead>
              <TableHead>Acceso</TableHead>
              <TableHead>Canjeados</TableHead>
              <TableHead>Activos</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Creado por</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lotes.map((lote) => (
              <TableRow key={lote.id}>
                <TableCell className="font-mono text-[13px] font-semibold text-uva-text">
                  {lote.totalActual} código(s)
                  {/* `cantidad` es lo que se pidió generar al crear el lote,
                      fijo para siempre (auditoría) — cuando ya no coincide
                      con lo que queda es porque se eliminó alguno sin usar,
                      y vale la pena que quede a la vista por qué el número
                      no es "redondo". */}
                  {lote.totalActual !== lote.cantidad && (
                    <span className="ml-1 font-sans text-[11px] font-normal text-uva-muted-2">
                      (de {lote.cantidad} originales)
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-uva-muted">{lote.duracionDias} días</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {lote.canjeados}
                  <span className="text-uva-muted-2">/{lote.totalActual}</span>
                </TableCell>
                <TableCell className="font-mono tabular-nums text-uva-muted">{lote.activos}</TableCell>
                <TableCell className="font-mono text-[12px] text-uva-muted-2 tabular-nums">
                  {formatFecha(lote.fechaVencimiento)}
                </TableCell>
                <TableCell className="text-[12px] text-uva-muted-2">{lote.creadoPor}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-auto gap-1.5 text-uva-muted-2 hover:text-uva-accent"
                      onClick={() => setLoteAbierto(lote)}
                    >
                      <ListChecks className="size-4" />
                      Ver códigos
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Exportar CSV de este lote"
                      title="Exportar CSV de este lote"
                      className="text-uva-muted-2 hover:text-uva-accent"
                      onClick={() => handleExportarLote(lote.id)}
                      disabled={exportandoLote === lote.id}
                    >
                      <Download className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </AdminCard>

      <LoteFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <Dialog open={loteAbierto !== null} onOpenChange={(open) => !open && setLoteAbierto(null)}>
        <DialogContent className="w-[620px]">
          <DialogHeader>
            <DialogTitle>
              Códigos del lote{loteAbierto ? ` (${codigosDelLoteAbierto.length})` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[420px] overflow-y-auto">
            {/* El diálogo se clampa a `calc(100%-2rem)` en mobile (~320-350px)
                y este contenedor solo tenía scroll vertical: la tabla de 4
                columnas se salía del propio modal en vez de solo verse
                apretada. */}
            <div className="flex flex-col pointer-fine:md:hidden">
              {codigosDelLoteAbierto.map((codigo) => (
                <div
                  key={codigo.id}
                  className="flex flex-col gap-2 border-b border-uva-divider py-2.5 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopiar(codigo.codigo)}
                      title="Copiar código"
                      className="flex items-center gap-1.5 font-mono text-[12.5px] font-semibold tracking-[0.05em] text-uva-text hover:text-uva-accent-text"
                    >
                      {codigo.codigo}
                      {copiado === codigo.codigo ? (
                        <Check className="size-3.5 text-uva-accent" />
                      ) : (
                        <Copy className="size-3.5 text-uva-muted-2" />
                      )}
                    </button>
                    <StatusBadge tone={TONO_ESTADO[codigo.estado]} className="shrink-0">
                      {ETIQUETA_ESTADO[codigo.estado]}
                    </StatusBadge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <RedimidoresButton
                      codigoId={codigo.id}
                      codigo={codigo.codigo}
                      vecesUsado={codigo.vecesUsado}
                    />
                    <div className="grid grid-cols-[auto_28px] items-center gap-1.5">
                      <SwitchEstado
                        checked={codigo.activo}
                        onCheckedChange={(checked) => handleToggle(codigo, checked)}
                        etiquetas={["", ""]}
                        acciones={["Activar código", "Desactivar código"]}
                      />
                      {codigo.vecesUsado === 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Eliminar código"
                          title="Eliminar código"
                          className="text-uva-muted-2 hover:text-uva-accent pointer-coarse:p-3"
                          onClick={() => setBorrando(codigo)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Table className="hidden pointer-fine:md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Canjeado por</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {codigosDelLoteAbierto.map((codigo) => (
                  <TableRow key={codigo.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleCopiar(codigo.codigo)}
                        title="Copiar código"
                        className="flex items-center gap-1.5 font-mono text-[12.5px] font-semibold tracking-[0.05em] text-uva-text hover:text-uva-accent-text"
                      >
                        {codigo.codigo}
                        {copiado === codigo.codigo ? (
                          <Check className="size-3.5 text-uva-accent" />
                        ) : (
                          <Copy className="size-3.5 text-uva-muted-2" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={TONO_ESTADO[codigo.estado]}>
                        {ETIQUETA_ESTADO[codigo.estado]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <RedimidoresButton
                        codigoId={codigo.id}
                        codigo={codigo.codigo}
                        vecesUsado={codigo.vecesUsado}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="grid grid-cols-[auto_28px] items-center justify-end gap-1.5">
                        <SwitchEstado
                          checked={codigo.activo}
                          onCheckedChange={(checked) => handleToggle(codigo, checked)}
                          etiquetas={["", ""]}
                          acciones={["Activar código", "Desactivar código"]}
                        />
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
          </div>
        </DialogContent>
      </Dialog>

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
