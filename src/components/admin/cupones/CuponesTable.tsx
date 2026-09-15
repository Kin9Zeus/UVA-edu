"use client";

import { useState } from "react";
import { CalendarX, Check, Copy, Pencil, Trash2 } from "lucide-react";
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
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/Toast";
import { CuponFormDialog } from "@/components/admin/cupones/CuponFormDialog";
import { eliminarCupon, vencerCuponAhora } from "@/actions/admin/cupones";
import { formatFecha, formatMoneda } from "@/lib/admin/format";
import type { EstadoCupon } from "@/lib/admin/cupones-tipos";
import type { CuponAdmin } from "@/lib/admin/cupones";

const TONO_ESTADO: Record<EstadoCupon, "success" | "warning"> = {
  ACTIVO: "success",
  VENCIDO: "warning",
  AGOTADO: "warning",
};

const ETIQUETA_ESTADO: Record<EstadoCupon, string> = {
  ACTIVO: "Activo",
  VENCIDO: "Vencido",
  AGOTADO: "Agotado",
};

/**
 * El descuento en la unidad que le corresponde. `valor` guarda porcentaje o
 * centavos según `tipoDescuento` (una columna, dos unidades — lo advierte
 * schema.prisma), así que pintarlo sin ramificar mostraría "$20" donde va
 * "20%".
 *
 * El monto fijo se formatea en COP porque la columna no guarda moneda y el
 * catálogo se cobra en pesos; ver la nota del formulario.
 */
function descuento(cupon: CuponAdmin): string {
  return cupon.tipoDescuento === "PORCENTAJE"
    ? `${cupon.valor}%`
    : formatMoneda(cupon.valor, "COP");
}

export function CuponesTable({ cupones }: { cupones: CuponAdmin[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<CuponAdmin | null>(null);
  const [venciendo, setVenciendo] = useState<CuponAdmin | null>(null);
  const [borrando, setBorrando] = useState<CuponAdmin | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const showToast = useAdminToast();

  function abrirCrear() {
    setEditando(null);
    setFormOpen(true);
  }

  function abrirEditar(cupon: CuponAdmin) {
    setEditando(cupon);
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

  async function handleVencer() {
    if (!venciendo) return;
    const resultado = await vencerCuponAhora(venciendo.id);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast("Cupón vencido. Deja de aplicarse desde ya; los cobros anteriores no cambian.");
  }

  async function handleEliminar() {
    if (!borrando) return;
    const resultado = await eliminarCupon(borrando.id);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast("Cupón eliminado.");
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex justify-end">
        <Button type="button" variant="primary" className="w-full sm:w-auto" onClick={abrirCrear}>
          + Nuevo cupón
        </Button>
      </div>

      {/* Vive junto a la tabla y no solo en el toast, igual que el aviso de
          Códigos: es la diferencia que hay que saber ANTES de tocar nada. */}
      <p className="text-[12.5px] text-uva-muted-2">
        Un cupón descuenta sobre el precio de un plan: no da acceso por sí solo, siempre hay un
        pago detrás. Para regalar acceso sin cobrar están los códigos de invitación.
      </p>

      <AdminCard flush>
        {cupones.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-uva-muted-2">
            No hay cupones todavía.
          </p>
        )}

        {/* Mismo criterio que el resto del panel: 7 columnas con tres
            acciones no caben sin scroll horizontal en un touch. */}
        {cupones.length > 0 && (
          <div className="flex flex-col pointer-fine:md:hidden">
            {cupones.map((cupon) => (
              <div
                key={cupon.id}
                className="flex flex-col gap-2 border-b border-uva-divider px-5 py-3.5 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopiar(cupon.codigo)}
                    title="Copiar código"
                    className="flex min-w-0 items-center gap-1.5 font-mono text-[13px] font-semibold tracking-[0.06em] text-uva-text hover:text-uva-accent-text"
                  >
                    <span className="truncate">{cupon.codigo}</span>
                    {copiado === cupon.codigo ? (
                      <Check className="size-3.5 shrink-0 text-uva-accent" />
                    ) : (
                      <Copy className="size-3.5 shrink-0 text-uva-muted-2" />
                    )}
                  </button>
                  <StatusBadge tone={TONO_ESTADO[cupon.estado]} className="shrink-0">
                    {ETIQUETA_ESTADO[cupon.estado]}
                  </StatusBadge>
                </div>
                <p className="font-mono text-[12px] text-uva-muted-2 tabular-nums">
                  −{descuento(cupon)} · {cupon.vecesUsado}/{cupon.limiteUsos ?? "∞"} usos
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] text-uva-muted-2 tabular-nums">
                    Vence {formatFecha(cupon.fechaVencimiento)}
                  </span>
                  <Acciones
                    cupon={cupon}
                    onEditar={abrirEditar}
                    onVencer={setVenciendo}
                    onEliminar={setBorrando}
                    tactil
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {cupones.length > 0 && (
          <Table className="hidden pointer-fine:md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descuento</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cupones.map((cupon) => (
                <TableRow key={cupon.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleCopiar(cupon.codigo)}
                      title="Copiar código"
                      className="flex items-center gap-1.5 font-mono text-[13px] font-semibold tracking-[0.06em] whitespace-nowrap text-uva-text hover:text-uva-accent-text"
                    >
                      {cupon.codigo}
                      {copiado === cupon.codigo ? (
                        <Check className="size-3.5 text-uva-accent" />
                      ) : (
                        <Copy className="size-3.5 text-uva-muted-2" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-mono whitespace-nowrap tabular-nums text-uva-text">
                    −{descuento(cupon)}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {cupon.vecesUsado}
                    <span className="text-uva-muted-2">/{cupon.limiteUsos ?? "∞"}</span>
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-uva-muted-2 tabular-nums">
                    {formatFecha(cupon.fechaVencimiento)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={TONO_ESTADO[cupon.estado]}>
                      {ETIQUETA_ESTADO[cupon.estado]}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-uva-muted-2 tabular-nums">
                    {formatFecha(cupon.creadoEn)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Acciones
                      cupon={cupon}
                      onEditar={abrirEditar}
                      onVencer={setVenciendo}
                      onEliminar={setBorrando}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminCard>

      <CuponFormDialog
        key={editando?.id ?? "nuevo"}
        open={formOpen}
        onOpenChange={setFormOpen}
        cupon={editando}
      />

      <ConfirmDialog
        open={venciendo !== null}
        onOpenChange={(open) => !open && setVenciendo(null)}
        title="Vencer cupón"
        description={`"${venciendo?.codigo}" dejará de aplicarse desde este momento. Quienes ya lo usaron conservan su descuento, y puedes volver a abrirlo editándole la fecha.`}
        confirmLabel="Vencer ahora"
        onConfirm={handleVencer}
      />

      <ConfirmDialog
        open={borrando !== null}
        onOpenChange={(open) => !open && setBorrando(null)}
        title="Eliminar cupón"
        description={`¿Seguro que quieres eliminar "${borrando?.codigo}"? Nunca se usó, así que no afecta a ningún cobro.`}
        onConfirm={handleEliminar}
      />
    </div>
  );
}

/**
 * Las tres acciones de una fila, en un grid de ancho fijo.
 *
 * Grid y no `flex justify-end` por lo mismo que `CodigosTable`: dos de los
 * tres botones son condicionales, y un bloque anclado a la derecha que cambia
 * de ancho mueve los demás de columna entre una fila y otra. Con tres celdas
 * fijas cada botón vive siempre en el mismo sitio y la que sobra queda vacía.
 */
function Acciones({
  cupon,
  onEditar,
  onVencer,
  onEliminar,
  tactil = false,
}: {
  cupon: CuponAdmin;
  onEditar: (cupon: CuponAdmin) => void;
  onVencer: (cupon: CuponAdmin) => void;
  onEliminar: (cupon: CuponAdmin) => void;
  /** Área de toque ampliada para la tarjeta de móvil. */
  tactil?: boolean;
}) {
  const clase = `text-uva-muted-2 hover:text-uva-accent${tactil ? " pointer-coarse:p-3" : ""}`;

  return (
    <div className="grid grid-cols-[28px_28px_28px] items-center justify-end gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Editar cupón"
        title="Editar descuento, vencimiento y límite"
        className={clase}
        onClick={() => onEditar(cupon)}
      >
        <Pencil className="size-4" />
      </Button>

      {/* Solo tiene sentido sobre uno vigente: vencer el que ya está vencido o
          agotado no cambiaría nada, y un botón que no hace nada se lee como
          que algo falló. */}
      {cupon.estado === "ACTIVO" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Vencer cupón ahora"
          title="Vencer ahora"
          className={clase}
          onClick={() => onVencer(cupon)}
        >
          <CalendarX className="size-4" />
        </Button>
      ) : (
        <span aria-hidden="true" />
      )}

      {/* Solo se ofrece borrar lo que nunca se usó: las dos referencias a
          `cupones` son ON DELETE SET NULL, así que borrar uno usado dejaría
          cobros con descuento y sin rastro de su origen. Para esos, vencer. */}
      {cupon.vecesUsado === 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Eliminar cupón"
          title="Eliminar cupón"
          className={clase}
          onClick={() => onEliminar(cupon)}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}
