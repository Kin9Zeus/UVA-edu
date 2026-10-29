"use client";

import { useState, type ReactNode } from "react";
import { CalendarX, Copy, Info, Pencil, Plus, Trash2 } from "lucide-react";
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
import { CuponFormDialog, type PlanVistaPrevia } from "@/components/admin/cupones/CuponFormDialog";
import { eliminarCupon, vencerCuponAhora } from "@/actions/admin/cupones";
import { formatFecha, formatMoneda } from "@/lib/admin/format";
import type { CuponAdmin } from "@/lib/admin/cupones";
import { cn } from "@/lib/utils";

type Filtro = "activos" | "terminados" | "todos";

/** Hasta este número de días, "vence en N días" se pinta como aviso. */
const DIAS_AVISO = 7;

/**
 * El descuento en la unidad que le corresponde. `valor` guarda porcentaje o
 * centavos según `tipoDescuento` (una columna, dos unidades — lo advierte
 * schema.prisma), así que pintarlo sin ramificar mostraría "$20" donde va
 * "20 %".
 *
 * El monto fijo se formatea en COP porque la columna no guarda moneda y el
 * catálogo se cobra en pesos; ver la nota del formulario.
 */
function descuento(cupon: CuponAdmin): string {
  return cupon.tipoDescuento === "PORCENTAJE"
    ? `${cupon.valor} %`
    : formatMoneda(cupon.valor, "COP");
}

/** Activos primero (el que vence antes, arriba); después los terminados, el más reciente arriba. */
function ordenar(cupones: CuponAdmin[]) {
  return [...cupones].sort((a, b) => {
    const activoA = a.estado === "ACTIVO", activoB = b.estado === "ACTIVO";
    if (activoA !== activoB) return activoA ? -1 : 1;
    return activoA
      ? a.fechaVencimiento.localeCompare(b.fechaVencimiento)
      : b.fechaVencimiento.localeCompare(a.fechaVencimiento);
  });
}

export function CuponesTable({
  cupones,
  aplicaron,
  cobroActivo,
  planes,
  encabezado,
  resumen,
}: {
  cupones: CuponAdmin[];
  /** Intentos de pago por cupón; null con el cobro apagado. */
  aplicaron: Record<string, number> | null;
  cobroActivo: boolean;
  planes: PlanVistaPrevia[];
  encabezado: ReactNode;
  resumen: ReactNode;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<CuponAdmin | null>(null);
  const [venciendo, setVenciendo] = useState<CuponAdmin | null>(null);
  const [borrando, setBorrando] = useState<CuponAdmin | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("activos");
  const showToast = useAdminToast();

  const activos = cupones.filter((c) => c.estado === "ACTIVO").length;
  const terminados = cupones.length - activos;
  const visibles = ordenar(cupones).filter((c) =>
    filtro === "todos" ? true : filtro === "activos" ? c.estado === "ACTIVO" : c.estado !== "ACTIVO",
  );

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
      // El aviso es la confirmación para todos, también para el lector de
      // pantalla: el cambio de ícono solo se veía.
      showToast(`Código ${codigo} copiado.`);
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
    showToast(`Venciste ${venciendo.codigo}. Deja de aplicarse desde ya; los pagos anteriores no cambian.`);
  }

  async function handleEliminar() {
    if (!borrando) return;
    const resultado = await eliminarCupon(borrando.id);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(`Eliminaste ${borrando.codigo}.`);
  }

  const acciones = { onEditar: abrirEditar, onVencer: setVenciendo, onEliminar: setBorrando };

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-[28rem]">{encabezado}</div>
        {cupones.length > 0 && (
          <Button type="button" variant="primary" className="max-sm:w-full" onClick={abrirCrear}>
            <Plus aria-hidden />
            Nuevo cupón
          </Button>
        )}
      </div>

      {!cobroActivo && (
        <div role="note" className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3 rounded-uva-lg border border-uva-line-strong bg-uva-surface p-4 sm:px-5">
          <Info className="mt-0.5 size-5 text-uva-accent-ink" aria-hidden />
          <div>
            <p className="font-bold text-uva-text">Los cupones todavía no se pueden usar</p>
            <p className="mt-0.5 max-w-[80ch] text-uva-detalle text-uva-text-muted">
              El cobro está apagado: hoy se entra a la plataforma con códigos de invitación, sin pagar.
              Puedes dejar cupones listos; empiezan a funcionar el día que se encienda el cobro.
            </p>
          </div>
        </div>
      )}

      {cupones.length > 0 && resumen}

      {cupones.length === 0 ? (
        <AdminCard className="items-center gap-1.5 px-5 py-10 text-center">
          <p className="text-uva-titulo-4 text-uva-text">Todavía no hay cupones</p>
          <p className="max-w-[46ch] text-uva-detalle text-uva-text-muted">
            Crea uno para una campaña: un porcentaje o un monto que se descuenta del plan al pagar.
          </p>
          <Button type="button" variant="primary" className="mt-3" onClick={abrirCrear}>
            <Plus aria-hidden />
            Nuevo cupón
          </Button>
        </AdminCard>
      ) : (
        <section aria-label="Lista de cupones" className="flex flex-col gap-3.5">
          <div role="group" aria-label="Qué cupones mostrar" className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-uva-md border border-uva-divider bg-uva-surface p-1">
            {(
              [
                ["activos", `Activos (${activos})`],
                ["terminados", `Terminados (${terminados})`],
                ["todos", "Todos"],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={filtro === valor}
                onClick={() => setFiltro(valor)}
                className={cn(
                  "min-h-11 rounded-uva-sm px-2.5 text-uva-detalle font-semibold whitespace-nowrap sm:px-3 text-uva-text-muted md:pointer-fine:min-h-9",
                  filtro === valor && "bg-uva-surface-2 font-bold text-uva-text",
                )}
              >
                {texto}
              </button>
            ))}
          </div>

          {/* Vive junto a la lista y no solo en el toast, igual que el aviso de
              Códigos: es la diferencia que hay que saber ANTES de tocar nada. */}
          <p className="max-w-[80ch] text-uva-detalle text-uva-text-muted">
            Un cupón descuenta sobre el precio de un plan y siempre hay un pago detrás. Para dar acceso
            sin cobrar están los códigos de invitación.
          </p>

          <AdminCard flush>
            {visibles.length === 0 && (
              <div className="flex flex-col items-center gap-1 px-5 py-9 text-center">
                <p className="font-bold text-uva-text">
                  {filtro === "activos" ? "Ningún cupón activo" : "Ningún cupón terminado"}
                </p>
                <p className="max-w-[50ch] text-uva-detalle text-uva-text-muted">
                  {filtro === "activos"
                    ? "Todos vencieron o se agotaron. Crea uno nuevo, o edita la fecha de uno vencido para reabrirlo."
                    : "Aquí aparecen los cupones vencidos o agotados."}
                </p>
              </div>
            )}

            {/* Mismo criterio que el resto del panel: con varias columnas y tres
                acciones, en una pantalla táctil va en tarjetas. */}
            {visibles.length > 0 && (
              <ul className="flex flex-col pointer-fine:md:hidden">
                {visibles.map((cupon) => (
                  <li key={cupon.id} className="flex flex-col gap-3 border-b border-uva-divider px-4 py-4 last:border-b-0 sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <BotonCodigo codigo={cupon.codigo} onCopiar={handleCopiar} />
                      <Estado cupon={cupon} />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <Descuento cupon={cupon} />
                      <Vence cupon={cupon} alineado="derecha" />
                    </div>
                    <Usos cupon={cupon} />
                    <div className="flex items-center justify-between gap-2">
                      {cobroActivo ? <Pagaron cupon={cupon} aplicaron={aplicaron?.[cupon.id] ?? 0} /> : <span />}
                      <Acciones cupon={cupon} {...acciones} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {visibles.length > 0 && (
              <Table contenedorClassName="hidden pointer-fine:md:block" etiqueta="Tabla de cupones">
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descuento</TableHead>
                    <TableHead>Usos</TableHead>
                    {cobroActivo && <TableHead>Pagaron</TableHead>}
                    <TableHead>Vence</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((cupon) => (
                    <TableRow key={cupon.id}>
                      <TableCell>
                        <BotonCodigo codigo={cupon.codigo} onCopiar={handleCopiar} />
                      </TableCell>
                      <TableCell>
                        <Descuento cupon={cupon} />
                      </TableCell>
                      <TableCell className="min-w-36">
                        <Usos cupon={cupon} />
                      </TableCell>
                      {cobroActivo && (
                        <TableCell>
                          <Pagaron cupon={cupon} aplicaron={aplicaron?.[cupon.id] ?? 0} enTabla />
                        </TableCell>
                      )}
                      <TableCell>
                        <Vence cupon={cupon} />
                      </TableCell>
                      <TableCell>
                        <Estado cupon={cupon} />
                      </TableCell>
                      <TableCell>
                        <Acciones cupon={cupon} {...acciones} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </AdminCard>
        </section>
      )}

      <CuponFormDialog
        key={editando?.id ?? "nuevo"}
        open={formOpen}
        onOpenChange={setFormOpen}
        cupon={editando}
        planes={planes}
        cobroActivo={cobroActivo}
      />

      <ConfirmDialog
        open={venciendo !== null}
        onOpenChange={(open) => !open && setVenciendo(null)}
        title={`¿Vencer ${venciendo?.codigo ?? "el cupón"} ahora?`}
        description="Deja de aplicarse desde este momento. Quienes ya lo usaron conservan su descuento, y puedes reabrirlo editándole la fecha."
        confirmLabel="Vencer ahora"
        destructive
        onConfirm={handleVencer}
      />

      <ConfirmDialog
        open={borrando !== null}
        onOpenChange={(open) => !open && setBorrando(null)}
        title={`¿Eliminar ${borrando?.codigo ?? "el cupón"}?`}
        confirmLabel="Eliminar cupón"
        destructive
        description="Nunca se usó, así que no afecta ningún pago. Esto no se puede deshacer."
        onConfirm={handleEliminar}
      />
    </div>
  );
}

function BotonCodigo({ codigo, onCopiar }: { codigo: string; onCopiar: (codigo: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCopiar(codigo)}
      aria-label={`Copiar el código ${codigo}`}
      title="Copiar código"
      className="-mx-2 -my-1.5 inline-flex min-h-11 min-w-0 items-center gap-2 rounded-uva-sm px-2 py-1.5 font-codigo text-uva-detalle font-semibold tracking-[0.04em] text-uva-text hover:bg-uva-hover hover:text-uva-accent-text md:pointer-fine:min-h-9"
    >
      <span className="truncate whitespace-nowrap">{codigo}</span>
      <Copy className="size-3.5 shrink-0 text-uva-muted-2" aria-hidden />
    </button>
  );
}

function Descuento({ cupon }: { cupon: CuponAdmin }) {
  return (
    <p className="font-mono font-bold whitespace-nowrap text-uva-text">
      {descuento(cupon)}
      <span className="block font-sans text-uva-detalle font-normal text-uva-text-muted">
        {cupon.tipoDescuento === "PORCENTAJE" ? "sobre el precio" : "menos en el precio"}
      </span>
    </p>
  );
}

function Usos({ cupon }: { cupon: CuponAdmin }) {
  const lleno = cupon.limiteUsos !== null && cupon.vecesUsado >= cupon.limiteUsos;
  const porcentaje = cupon.limiteUsos ? Math.min(100, (cupon.vecesUsado / cupon.limiteUsos) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-uva-detalle text-uva-text">
        <span className="font-mono font-bold">{cupon.vecesUsado}</span>{" "}
        {cupon.limiteUsos !== null
          ? `de ${cupon.limiteUsos} usos`
          : `${cupon.vecesUsado === 1 ? "uso" : "usos"}, sin límite`}
      </p>
      {/* La barra repite lo que ya dice el texto: es para verlo de un vistazo. */}
      {cupon.limiteUsos !== null && (
        <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-uva-divider">
          <div className={cn("h-full rounded-full", lleno ? "bg-uva-muted-2" : "bg-uva-accent")} style={{ width: `${porcentaje}%` }} />
        </div>
      )}
    </div>
  );
}

/**
 * "Pagaron" es `veces_usado` (solo cuenta pagos aprobados) frente a los
 * intentos de pago con ese cupón. Muestra si un cupón atrae gente que luego no
 * termina de pagar.
 */
function Pagaron({ cupon, aplicaron, enTabla }: { cupon: CuponAdmin; aplicaron: number; enTabla?: boolean }) {
  if (aplicaron === 0 && cupon.vecesUsado === 0) {
    return <p className="text-uva-detalle text-uva-text-muted">Nadie lo ha aplicado</p>;
  }
  return (
    <p className="text-uva-detalle whitespace-nowrap text-uva-text-muted">
      {!enTabla && "Pagaron "}
      <span className="font-mono font-bold text-uva-text">{cupon.vecesUsado}</span>
      {aplicaron >= cupon.vecesUsado && ` de ${aplicaron}`}
    </p>
  );
}

function Vence({ cupon, alineado }: { cupon: CuponAdmin; alineado?: "derecha" }) {
  const dias = cupon.diasParaVencer;
  const nota =
    cupon.estado === "VENCIDO"
      ? "Ya venció"
      : cupon.estado === "AGOTADO"
        ? "Sin usos disponibles"
        : dias <= 1
          ? "Vence hoy o mañana"
          : `${dias <= DIAS_AVISO ? "Vence en" : "en"} ${dias} días`;
  const aviso = cupon.estado === "ACTIVO" && dias <= DIAS_AVISO;
  return (
    <p className={cn("text-uva-detalle whitespace-nowrap text-uva-text", alineado === "derecha" && "text-right")}>
      <span className="font-mono">{formatFecha(cupon.fechaVencimiento)}</span>
      <span className={cn("block", aviso ? "font-bold text-uva-warning-text" : "text-uva-text-muted")}>{nota}</span>
    </p>
  );
}

/** Vencido y Agotado en gris: ya terminaron, no piden nada. Lo que pide
 *  atención (vence pronto) lo dice la fecha, en amarillo. */
function Estado({ cupon }: { cupon: CuponAdmin }) {
  if (cupon.estado === "ACTIVO") return <StatusBadge tone="success" className="shrink-0">Activo</StatusBadge>;
  return (
    <StatusBadge tone="neutral" className="shrink-0">
      {cupon.estado === "VENCIDO" ? "Vencido" : "Agotado"}
    </StatusBadge>
  );
}

const HUECO = "size-7 max-sm:size-11 pointer-coarse:size-11";

/**
 * Las tres acciones de una fila, cada una siempre en el mismo sitio.
 *
 * Dos de los tres botones son condicionales; un hueco del mismo tamaño ocupa
 * el lugar del que falta para que los demás no cambien de columna entre una
 * fila y otra (mismo criterio que `CodigosTable`).
 */
function Acciones({
  cupon,
  onEditar,
  onVencer,
  onEliminar,
}: {
  cupon: CuponAdmin;
  onEditar: (cupon: CuponAdmin) => void;
  onVencer: (cupon: CuponAdmin) => void;
  onEliminar: (cupon: CuponAdmin) => void;
}) {
  const clase = "text-uva-muted-2 hover:text-uva-accent-ink";
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Editar ${cupon.codigo}`}
        title="Editar descuento, vencimiento y límite"
        className={clase}
        onClick={() => onEditar(cupon)}
      >
        <Pencil className="size-4" />
      </Button>

      {/* Solo tiene sentido sobre uno vigente: vencer el que ya está vencido o
          agotado no cambiaría nada. */}
      {cupon.estado === "ACTIVO" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Vencer ${cupon.codigo} ahora`}
          title="Vencer ahora"
          className={clase}
          onClick={() => onVencer(cupon)}
        >
          <CalendarX className="size-4" />
        </Button>
      ) : (
        <span aria-hidden className={HUECO} />
      )}

      {/* Solo se ofrece borrar lo que nunca se usó: las dos referencias a
          `cupones` son ON DELETE SET NULL, así que borrar uno usado dejaría
          cobros con descuento y sin rastro de su origen. Para esos, vencer. */}
      {cupon.vecesUsado === 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Eliminar ${cupon.codigo}`}
          title="Eliminar cupón"
          className={clase}
          onClick={() => onEliminar(cupon)}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : (
        <span aria-hidden className={HUECO} />
      )}
    </div>
  );
}
