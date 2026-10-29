"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Ban, CirclePlay, Copy, Download, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/Toast";
import { CodigoFormDialog } from "@/components/admin/codigos/CodigoFormDialog";
import { descargarCsvLote } from "@/components/admin/codigos/descargarCsv";
import {
  eliminarCodigoInvitacion,
  obtenerCanjes,
  toggleActivoCodigoInvitacion,
  type CanjeCodigo,
} from "@/actions/admin/codigosInvitacion";
import { formatFecha } from "@/lib/admin/format";
import type { CodigoInvitacion } from "@/lib/admin/codigosInvitacion";
import type { LoteCodigosInvitacion } from "@/lib/admin/lotesCodigosInvitacion";
import type { EstadoCodigo } from "@/lib/codigoInvitacion";
import { cn } from "@/lib/utils";

type Filtro = "activos" | "terminados" | "todos";

/** Un código compartido o un lote entero: los dos son una fila de la lista. */
type Fila =
  | { tipo: "codigo"; id: string; estado: EstadoCodigo; fechaVencimiento: string; diasParaVencer: number; codigo: CodigoInvitacion }
  | { tipo: "lote"; id: string; estado: EstadoCodigo; fechaVencimiento: string; diasParaVencer: number; lote: LoteCodigosInvitacion };

type Vista = { tipo: "quien"; codigo: CodigoInvitacion } | { tipo: "lote"; lote: LoteCodigosInvitacion } | null;

/** Hasta este número de días, "vence en N días" se pinta como aviso. */
const DIAS_AVISO = 7;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const ETIQUETA_ESTADO: Record<EstadoCodigo, string> = {
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
  VENCIDO: "Vencido",
  AGOTADO: "Agotado",
};

/** Activos primero (el que vence antes, arriba); después los terminados, el más reciente arriba. */
function ordenar(filas: Fila[]) {
  return [...filas].sort((a, b) => {
    const activoA = a.estado === "ACTIVO", activoB = b.estado === "ACTIVO";
    if (activoA !== activoB) return activoA ? -1 : 1;
    return activoA
      ? a.fechaVencimiento.localeCompare(b.fechaVencimiento)
      : b.fechaVencimiento.localeCompare(a.fechaVencimiento);
  });
}

/**
 * Lista de `/admin/codigos`: códigos compartidos y lotes juntos, cada fila
 * dice cuál es. Antes vivían en dos pestañas y una quedaba escondida.
 *
 * Ya no hay suscripción en tiempo real (retirada en D-13 de
 * AUDIT-2026-09-08-base-de-datos.md: costaba miles de decodificaciones de WAL
 * por un canje que puede esperar a recargar). Lo que hace el propio
 * administrador se ve al instante por `revalidatePath`.
 */
export function CodigosLista({
  codigos,
  lotes,
  codigosDeLote,
  estudianPorCodigo,
  encabezado,
  resumen,
}: {
  /** Solo los compartidos (sin lote). */
  codigos: CodigoInvitacion[];
  lotes: LoteCodigosInvitacion[];
  codigosDeLote: CodigoInvitacion[];
  estudianPorCodigo: Record<string, number>;
  encabezado: ReactNode;
  resumen: ReactNode;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<CodigoInvitacion | null>(null);
  const [desactivando, setDesactivando] = useState<CodigoInvitacion | null>(null);
  const [borrando, setBorrando] = useState<CodigoInvitacion | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("activos");
  const [vista, setVista] = useState<Vista>(null);
  // Cada "Nuevo código" monta el formulario de cero.
  const [aperturas, setAperturas] = useState(0);
  const [canjes, setCanjes] = useState<CanjeCodigo[] | null>(null);
  const pedido = useRef(0);
  const showToast = useAdminToast();

  const filas: Fila[] = [
    ...codigos.map((codigo) => ({
      tipo: "codigo" as const,
      id: codigo.id,
      estado: codigo.estado,
      fechaVencimiento: codigo.fechaVencimiento,
      diasParaVencer: codigo.diasParaVencer,
      codigo,
    })),
    ...lotes.map((lote) => ({
      tipo: "lote" as const,
      id: lote.id,
      estado: lote.estado,
      fechaVencimiento: lote.fechaVencimiento,
      diasParaVencer: lote.diasParaVencer,
      lote,
    })),
  ];
  const activos = filas.filter((f) => f.estado === "ACTIVO").length;
  const visibles = ordenar(filas).filter((f) =>
    filtro === "todos" ? true : filtro === "activos" ? f.estado === "ACTIVO" : f.estado !== "ACTIVO",
  );

  const estudian = (fila: Fila) =>
    fila.tipo === "codigo"
      ? (estudianPorCodigo[fila.id] ?? 0)
      : codigosDeLote.filter((c) => c.idLote === fila.id).reduce((suma, c) => suma + (estudianPorCodigo[c.id] ?? 0), 0);

  function abrirCrear() {
    setEditando(null);
    setAperturas((n) => n + 1);
    setFormOpen(true);
  }

  function abrirEditar(codigo: CodigoInvitacion) {
    setEditando(codigo);
    setFormOpen(true);
  }

  async function abrirCanjes(nueva: NonNullable<Vista>, ids: string[]) {
    const este = ++pedido.current;
    setVista(nueva);
    setCanjes(null);
    const resultado = await obtenerCanjes(ids);
    if (este !== pedido.current) return;
    if (resultado.error || !resultado.canjes) {
      showToast(resultado.error ?? "No pudimos cargar quiénes canjearon.", "error");
      setVista(null);
      return;
    }
    setCanjes(resultado.canjes);
  }

  function cerrarCanjes() {
    pedido.current += 1;
    setVista(null);
  }

  async function copiar(texto: string, aviso: string) {
    try {
      await navigator.clipboard.writeText(texto);
      // El aviso es la confirmación para todos, también para el lector de pantalla.
      showToast(aviso);
    } catch {
      showToast("No pudimos copiar. Selecciona el código y cópialo a mano.", "error");
    }
  }

  async function descargar(loteId: string) {
    const fallo = await descargarCsvLote(loteId);
    showToast(fallo ?? "Descargaste el CSV del lote.", fallo ? "error" : undefined);
  }

  async function cambiarActivo(codigo: CodigoInvitacion, activo: boolean) {
    const resultado = await toggleActivoCodigoInvitacion(codigo.id, activo);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    // Desactivar y quitar el acceso son dos cosas distintas (rev.md).
    showToast(
      activo
        ? `Activaste ${codigo.codigo}. Ya se puede canjear otra vez.`
        : `Desactivaste ${codigo.codigo}. Quien ya lo canjeó conserva su acceso.`,
    );
  }

  async function handleEliminar() {
    if (!borrando) return;
    const resultado = await eliminarCodigoInvitacion(borrando.id);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(`Eliminaste ${borrando.codigo}.`);
  }

  const onCopiarCodigo = (codigo: string) => copiar(codigo, `Código ${codigo} copiado.`);
  const acciones = {
    onEditar: abrirEditar,
    onDesactivar: setDesactivando,
    onActivar: (codigo: CodigoInvitacion) => cambiarActivo(codigo, true),
    onEliminar: setBorrando,
    onVerLote: (lote: LoteCodigosInvitacion) =>
      abrirCanjes(
        { tipo: "lote", lote },
        codigosDeLote.filter((c) => c.idLote === lote.id && c.vecesUsado > 0).map((c) => c.id),
      ),
    onDescargar: descargar,
  };
  const verQuien = (codigo: CodigoInvitacion) => abrirCanjes({ tipo: "quien", codigo }, [codigo.id]);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-[28rem]">{encabezado}</div>
        {filas.length > 0 && (
          <Button type="button" variant="primary" className="max-sm:w-full" onClick={abrirCrear}>
            <Plus aria-hidden />
            Nuevo código
          </Button>
        )}
      </div>

      {filas.length > 0 && resumen}

      {filas.length === 0 ? (
        <AdminCard className="items-center gap-1.5 px-5 py-10 text-center">
          <p className="text-uva-titulo-4 text-uva-text">Todavía no hay códigos</p>
          <p className="max-w-[46ch] text-uva-detalle text-uva-text-muted">
            Crea uno para invitar a alguien: un código para varias personas o un código para cada una.
          </p>
          <Button type="button" variant="primary" className="mt-3" onClick={abrirCrear}>
            <Plus aria-hidden />
            Nuevo código
          </Button>
        </AdminCard>
      ) : (
        <section aria-label="Lista de códigos" className="flex flex-col gap-3.5">
          <div role="group" aria-label="Qué códigos mostrar" className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-uva-md border border-uva-divider bg-uva-surface p-1">
            {(
              [
                ["activos", `Activos (${activos})`],
                ["terminados", `Terminados (${filas.length - activos})`],
                ["todos", "Todos"],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={filtro === valor}
                onClick={() => setFiltro(valor)}
                className={cn(
                  "min-h-11 rounded-uva-sm px-2.5 text-uva-detalle font-semibold whitespace-nowrap text-uva-text-muted sm:px-3 md:pointer-fine:min-h-9",
                  filtro === valor && "bg-uva-surface-2 font-bold text-uva-text",
                )}
              >
                {texto}
              </button>
            ))}
          </div>

          {/* Junto a la lista y no solo en el aviso: es lo que hay que saber ANTES de desactivar. */}
          <p className="max-w-[80ch] text-uva-detalle text-uva-text-muted">
            Desactivar un código impide nuevos canjes, pero quien ya lo canjeó conserva su acceso. Para quitarle el
            acceso a alguien, hazlo desde su ficha en Usuarios.
          </p>

          <AdminCard flush>
            {visibles.length === 0 && (
              <div className="flex flex-col items-center gap-1 px-5 py-9 text-center">
                <p className="font-bold text-uva-text">
                  {filtro === "activos" ? "Ningún código activo" : "Ningún código terminado"}
                </p>
                <p className="max-w-[50ch] text-uva-detalle text-uva-text-muted">
                  {filtro === "activos"
                    ? "Nadie puede entrar con un código ahora mismo. Crea uno, o edita la fecha de uno vencido."
                    : "Aquí aparecen los códigos vencidos, agotados o desactivados."}
                </p>
              </div>
            )}

            {/* En una pantalla táctil va en tarjetas, igual que el resto del panel. */}
            {visibles.length > 0 && (
              <ul className="flex flex-col pointer-fine:md:hidden">
                {visibles.map((fila) => (
                  <li key={fila.id} className="flex flex-col gap-3 border-b border-uva-divider px-4 py-4 last:border-b-0 sm:px-5">
                    <div className="flex items-start justify-between gap-2">
                      <Identidad fila={fila} onCopiar={onCopiarCodigo} />
                      <Estado estado={fila.estado} />
                    </div>
                    <Vence fila={fila} />
                    <Canjes fila={fila} estudian={estudian(fila)} onVerQuien={verQuien} />
                    <Acciones fila={fila} {...acciones} />
                  </li>
                ))}
              </ul>
            )}

            {visibles.length > 0 && (
              <Table contenedorClassName="hidden pointer-fine:md:block" etiqueta="Tabla de códigos de invitación">
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Canjes</TableHead>
                    <TableHead>Se puede canjear hasta</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((fila) => (
                    <TableRow key={fila.id}>
                      <TableCell className="max-w-56 whitespace-normal">
                        <Identidad fila={fila} onCopiar={onCopiarCodigo} />
                      </TableCell>
                      <TableCell className="min-w-40 whitespace-normal">
                        <Canjes fila={fila} estudian={estudian(fila)} onVerQuien={verQuien} />
                      </TableCell>
                      <TableCell>
                        <Vence fila={fila} />
                      </TableCell>
                      <TableCell>
                        <Estado estado={fila.estado} />
                      </TableCell>
                      <TableCell>
                        <Acciones fila={fila} {...acciones} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </AdminCard>
        </section>
      )}

      <CodigoFormDialog key={editando?.id ?? `nuevo-${aperturas}`} open={formOpen} onOpenChange={setFormOpen} codigo={editando} />

      <ConfirmDialog
        open={desactivando !== null}
        onOpenChange={(open) => !open && setDesactivando(null)}
        title={`¿Desactivar ${desactivando?.codigo ?? "el código"}?`}
        description={`Nadie más podrá canjearlo. ${
          !desactivando || desactivando.vecesUsado === 0
            ? "Nadie lo ha canjeado todavía."
            : desactivando.vecesUsado === 1
              ? "La persona que ya lo canjeó conserva su acceso."
              : `Las ${desactivando.vecesUsado} personas que ya lo canjearon conservan su acceso.`
        } Puedes volver a activarlo cuando quieras.`}
        confirmLabel="Desactivar"
        destructive
        onConfirm={() => (desactivando ? cambiarActivo(desactivando, false) : undefined)}
      />

      <ConfirmDialog
        open={borrando !== null}
        onOpenChange={(open) => !open && setBorrando(null)}
        title={`¿Eliminar ${borrando?.codigo ?? "el código"}?`}
        description="Nadie lo ha canjeado, así que no le quita el acceso a nadie. Esto no se puede deshacer."
        confirmLabel="Eliminar código"
        destructive
        onConfirm={handleEliminar}
      />

      <QuienCanjeoDialog
        codigo={vista?.tipo === "quien" ? vista.codigo : null}
        canjes={canjes}
        onClose={cerrarCanjes}
      />

      <LoteDialog
        key={vista?.tipo === "lote" ? vista.lote.id : "ninguno"}
        lote={vista?.tipo === "lote" ? vista.lote : null}
        codigos={vista?.tipo === "lote" ? codigosDeLote.filter((c) => c.idLote === vista.lote.id) : []}
        canjes={canjes}
        onClose={cerrarCanjes}
        onCopiar={copiar}
        onDescargar={descargar}
        onCambiarActivo={cambiarActivo}
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

function Identidad({ fila, onCopiar }: { fila: Fila; onCopiar: (codigo: string) => void }) {
  if (fila.tipo === "lote") {
    return (
      <div className="min-w-0">
        <p className="m-0 font-bold text-uva-text">Lote de {plural(fila.lote.cantidad, "código", "códigos")}</p>
        <p className="m-0 mt-0.5 text-uva-detalle text-uva-text-muted">
          {plural(fila.lote.duracionDias, "día", "días")} de acceso, uno por persona
        </p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <BotonCodigo codigo={fila.codigo.codigo} onCopiar={onCopiar} />
      <p className="m-0 mt-1 text-uva-detalle text-uva-text-muted">
        {plural(fila.codigo.duracionDias, "día", "días")} de acceso, creado por {fila.codigo.creadoPor}
      </p>
    </div>
  );
}

function Canjes({
  fila,
  estudian,
  onVerQuien,
}: {
  fila: Fila;
  estudian: number;
  onVerQuien: (codigo: CodigoInvitacion) => void;
}) {
  const usados = fila.tipo === "lote" ? fila.lote.canjeados : fila.codigo.vecesUsado;
  const total = fila.tipo === "lote" ? fila.lote.totalActual : fila.codigo.limiteUsos;
  const porcentaje = total > 0 ? Math.min(100, (usados / total) * 100) : 0;
  const texto = (
    <>
      <span className="font-mono font-bold">{usados}</span> de{" "}
      {fila.tipo === "lote" ? plural(total, "código canjeado", "códigos canjeados") : plural(total, "persona", "personas")}
    </>
  );
  return (
    <div className="flex flex-col gap-1.5">
      {fila.tipo === "codigo" && usados > 0 ? (
        <button
          type="button"
          onClick={() => onVerQuien(fila.codigo)}
          className="-mx-1 -my-1 flex min-h-11 flex-col items-start rounded-uva-sm px-1 py-1 text-left text-uva-detalle text-uva-text hover:bg-uva-hover md:pointer-fine:min-h-0"
        >
          <span>{texto}</span>
          <span className="font-semibold text-uva-accent-text">Ver quién</span>
        </button>
      ) : (
        <p className="m-0 text-uva-detalle text-uva-text">{texto}</p>
      )}
      {/* La barra repite lo que ya dice el texto: es para verlo de un vistazo. */}
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-uva-divider">
        <div className={cn("h-full rounded-full", usados >= total ? "bg-uva-muted-2" : "bg-uva-accent")} style={{ width: `${porcentaje}%` }} />
      </div>
      {usados > 0 && (
        <p className="m-0 text-uva-detalle text-uva-text-muted">
          {estudian > 0 ? plural(estudian, "empezó a estudiar", "empezaron a estudiar") : "Nadie ha empezado a estudiar"}
        </p>
      )}
    </div>
  );
}

function Vence({ fila }: { fila: Fila }) {
  const dias = fila.diasParaVencer;
  const nota = {
    VENCIDO: "Ya venció",
    AGOTADO: fila.tipo === "lote" ? "Todos canjeados" : "Sin cupos",
    INACTIVO: "Desactivado",
    ACTIVO: dias <= 1 ? "Vence hoy o mañana" : `${dias <= DIAS_AVISO ? "Vence en" : "en"} ${dias} días`,
  }[fila.estado];
  const aviso = fila.estado === "ACTIVO" && dias <= DIAS_AVISO;
  return (
    <p className="m-0 text-uva-detalle whitespace-nowrap text-uva-text">
      <span className="font-mono">{formatFecha(fila.fechaVencimiento)}</span>
      <span className={cn("block", aviso ? "font-bold text-uva-warning-text" : "text-uva-text-muted")}>{nota}</span>
    </p>
  );
}

/** Solo Activo en verde: lo demás ya no sirve para entrar y no pide nada. */
function Estado({ estado }: { estado: EstadoCodigo }) {
  return (
    <StatusBadge tone={estado === "ACTIVO" ? "success" : "neutral"} className="shrink-0">
      {ETIQUETA_ESTADO[estado]}
    </StatusBadge>
  );
}

const HUECO = "size-7 max-sm:size-11 pointer-coarse:size-11";
const ICONO = "text-uva-muted-2 hover:text-uva-accent-ink";

/**
 * Las acciones de una fila, cada una siempre en el mismo sitio: un hueco del
 * mismo tamaño ocupa el lugar de la que falta (mismo criterio que Cupones).
 */
function Acciones({
  fila,
  onEditar,
  onDesactivar,
  onActivar,
  onEliminar,
  onVerLote,
  onDescargar,
}: {
  fila: Fila;
  onEditar: (codigo: CodigoInvitacion) => void;
  onDesactivar: (codigo: CodigoInvitacion) => void;
  onActivar: (codigo: CodigoInvitacion) => void;
  onEliminar: (codigo: CodigoInvitacion) => void;
  onVerLote: (lote: LoteCodigosInvitacion) => void;
  onDescargar: (loteId: string) => void;
}) {
  if (fila.tipo === "lote") {
    const { lote } = fila;
    return (
      <div className="flex items-center justify-end gap-1">
        <Button type="button" variant="ghost" size="sm" className="w-auto gap-1.5 text-uva-text hover:text-uva-accent-ink max-sm:min-h-11 pointer-coarse:min-h-11" onClick={() => onVerLote(lote)}>
          <ListChecks className="size-4 text-uva-muted-2" aria-hidden />
          Ver códigos
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Descargar el CSV del lote de ${lote.cantidad} códigos`}
          title="Descargar CSV"
          className={ICONO}
          onClick={() => onDescargar(lote.id)}
        >
          <Download className="size-4" />
        </Button>
      </div>
    );
  }

  const { codigo } = fila;
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Editar ${codigo.codigo}`}
        title="Editar personas y fecha"
        className={ICONO}
        onClick={() => onEditar(codigo)}
      >
        <Pencil className="size-4" />
      </Button>
      {codigo.activo ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Desactivar ${codigo.codigo}`}
          title="Desactivar"
          className={ICONO}
          onClick={() => onDesactivar(codigo)}
        >
          <Ban className="size-4" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Activar ${codigo.codigo}`}
          title="Activar"
          className={ICONO}
          onClick={() => onActivar(codigo)}
        >
          <CirclePlay className="size-4" />
        </Button>
      )}
      {/* Solo se borra lo que nunca se canjeó: la FK de `suscripciones` es
          ON DELETE SET NULL y el acceso quedaría sin rastro de su origen. */}
      {codigo.vecesUsado === 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Eliminar ${codigo.codigo}`}
          title="Eliminar"
          className={ICONO}
          onClick={() => onEliminar(codigo)}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : (
        <span aria-hidden className={HUECO} />
      )}
    </div>
  );
}

function Persona({ canje }: { canje: CanjeCodigo }) {
  return (
    <span className="flex min-w-0 flex-col">
      {canje.slug ? (
        <Link href={`/admin/usuarios/${canje.slug}`} className="truncate font-bold text-uva-text hover:text-uva-accent-text hover:underline">
          {canje.nombre}
        </Link>
      ) : (
        <b className="truncate font-bold text-uva-text">{canje.nombre}</b>
      )}
      <span className="truncate text-uva-detalle text-uva-text-muted">{canje.correo}</span>
    </span>
  );
}

function Estudio({ canje }: { canje: CanjeCodigo }) {
  return (
    <span className="shrink-0 text-right text-uva-detalle text-uva-text-muted">
      {formatFecha(canje.canjeadoEn)}
      <span className={cn("block", canje.clases > 0 && "text-uva-text")}>
        {canje.clases > 0 ? `Vio ${plural(canje.clases, "clase", "clases")}` : "No ha visto clases"}
      </span>
    </span>
  );
}

function Cargando() {
  return <p className="m-0 px-4 py-6 text-center text-uva-detalle text-uva-text-muted">Cargando…</p>;
}

function QuienCanjeoDialog({
  codigo,
  canjes,
  onClose,
}: {
  codigo: CodigoInvitacion | null;
  canjes: CanjeCodigo[] | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={codigo !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[520px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quién canjeó {codigo?.codigo}</DialogTitle>
          <DialogDescription>
            {codigo && `${codigo.vecesUsado} de ${plural(codigo.limiteUsos, "persona", "personas")}, la más reciente primero.`}
          </DialogDescription>
        </DialogHeader>
        <ul className="m-0 flex max-h-[50dvh] list-none flex-col overflow-y-auto rounded-uva-md border border-uva-divider p-0">
          {canjes === null ? (
            <li>
              <Cargando />
            </li>
          ) : (
            canjes.map((canje) => (
              <li key={canje.usuarioId} className="flex items-center justify-between gap-3 border-b border-uva-divider px-3.5 py-2.5 last:border-b-0">
                <Persona canje={canje} />
                <Estudio canje={canje} />
              </li>
            ))
          )}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LoteDialog({
  lote,
  codigos,
  canjes,
  onClose,
  onCopiar,
  onDescargar,
  onCambiarActivo,
}: {
  lote: LoteCodigosInvitacion | null;
  codigos: CodigoInvitacion[];
  canjes: CanjeCodigo[] | null;
  onClose: () => void;
  onCopiar: (texto: string, aviso: string) => void;
  onDescargar: (loteId: string) => void;
  onCambiarActivo: (codigo: CodigoInvitacion, activo: boolean) => void;
}) {
  const sinCanjear = codigos.filter((c) => c.vecesUsado === 0);
  const canjeados = codigos.filter((c) => c.vecesUsado > 0);
  const [pestana, setPestana] = useState<"sin" | "con" | null>(null);
  const vista = pestana ?? (sinCanjear.length > 0 ? "sin" : "con");
  const porCodigo = new Map((canjes ?? []).map((canje) => [canje.idCodigo, canje]));
  const paraRepartir = sinCanjear.filter((c) => c.estado === "ACTIVO");

  return (
    <Dialog
      open={lote !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[620px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {lote && `Lote de ${plural(lote.cantidad, "código", "códigos")} del ${formatFecha(lote.creadoEn)}`}
          </DialogTitle>
          <DialogDescription>
            {lote && `${plural(lote.duracionDias, "día", "días")} de acceso. Se pueden canjear hasta el ${formatFecha(lote.fechaVencimiento)}.`}
          </DialogDescription>
        </DialogHeader>

        <div role="group" aria-label="Qué códigos del lote mostrar" className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-uva-md border border-uva-divider bg-uva-surface p-1">
          {(
            [
              ["sin", `Sin canjear (${sinCanjear.length})`],
              ["con", `Canjeados (${canjeados.length})`],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={vista === valor}
              onClick={() => setPestana(valor)}
              className={cn(
                "min-h-11 rounded-uva-sm px-3 text-uva-detalle font-semibold whitespace-nowrap text-uva-text-muted md:pointer-fine:min-h-9",
                vista === valor && "bg-uva-surface-2 font-bold text-uva-text",
              )}
            >
              {texto}
            </button>
          ))}
        </div>

        <ul className="m-0 flex max-h-[45dvh] list-none flex-col overflow-y-auto rounded-uva-md border border-uva-divider p-0">
          {vista === "sin" &&
            (sinCanjear.length === 0 ? (
              <li className="px-4 py-6 text-center text-uva-detalle text-uva-text-muted">Ya se canjearon todos.</li>
            ) : (
              sinCanjear.map((codigo) => (
                <li key={codigo.id} className="flex items-center justify-between gap-3 border-b border-uva-divider px-3.5 py-1.5 last:border-b-0">
                  <span className="flex min-w-0 items-center gap-2 pl-2">
                    <BotonCodigo codigo={codigo.codigo} onCopiar={(c) => onCopiar(c, `Código ${c} copiado.`)} />
                    {!codigo.activo && <span className="text-uva-detalle text-uva-text-muted">Desactivado</span>}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${codigo.activo ? "Desactivar" : "Activar"} ${codigo.codigo}`}
                    title={codigo.activo ? "Desactivar" : "Activar"}
                    className={ICONO}
                    onClick={() => onCambiarActivo(codigo, !codigo.activo)}
                  >
                    {codigo.activo ? <Ban className="size-4" /> : <CirclePlay className="size-4" />}
                  </Button>
                </li>
              ))
            ))}
          {vista === "con" &&
            (canjeados.length === 0 ? (
              <li className="px-4 py-6 text-center text-uva-detalle text-uva-text-muted">
                Nadie ha canjeado un código de este lote.
              </li>
            ) : canjes === null ? (
              <li>
                <Cargando />
              </li>
            ) : (
              canjeados.map((codigo) => {
                const canje = porCodigo.get(codigo.id);
                return (
                  <li key={codigo.id} className="flex items-center justify-between gap-3 border-b border-uva-divider px-3.5 py-2.5 last:border-b-0">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-codigo text-uva-detalle font-semibold tracking-[0.04em] text-uva-text-muted">{codigo.codigo}</span>
                      {canje && <Persona canje={canje} />}
                    </span>
                    {canje && <Estudio canje={canje} />}
                  </li>
                );
              })
            ))}
        </ul>

        <DialogFooter>
          {vista === "sin" && paraRepartir.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onCopiar(
                  paraRepartir.map((c) => c.codigo).join("\n"),
                  `Copiaste los ${paraRepartir.length} códigos sin canjear, uno por línea.`,
                )
              }
            >
              <Copy aria-hidden />
              Copiar los {paraRepartir.length} sin canjear
            </Button>
          )}
          {lote && (
            <Button type="button" variant="outline" onClick={() => onDescargar(lote.id)}>
              <Download aria-hidden />
              Descargar CSV
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
