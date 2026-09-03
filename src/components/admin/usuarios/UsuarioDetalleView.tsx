"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminToast } from "@/components/admin/Toast";
import { GrantMembershipDialog } from "@/components/admin/usuarios/GrantMembershipDialog";
import { GrantCourtesyDialog } from "@/components/admin/usuarios/GrantCourtesyDialog";
import { RevokeAccessDialog } from "@/components/admin/usuarios/RevokeAccessDialog";
import { quitarCortesia, revocarMembresia } from "@/actions/admin/usuarios";
import { formatFecha } from "@/lib/admin/format";
import type { UsuarioDetalle } from "@/lib/admin/usuarioDetalle";
import {
  ETIQUETA_TIPO_ACCESO,
  ETIQUETA_ESTADO_SUSCRIPCION,
  TONO_ESTADO_SUSCRIPCION,
  suscripcionEstaVigentePorEstado,
} from "@/lib/estadoAcceso";

/** Misma etiqueta que ve el estudiante en su tarjeta "Tu acceso" (perfil), para que admin y estudiante hablen el mismo idioma. */
function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "U";
}

/** Etiqueta gris de 11px que el mockup antepone a cada badge de la cabecera. */
function EtiquetaBadge({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-uva-muted-2">{children}</span>;
}

export function UsuarioDetalleView({
  usuario,
  planes,
  cursosDisponibles,
}: {
  usuario: UsuarioDetalle;
  planes: { id: string; nombre: string; precio_centavos: number; moneda: string }[];
  cursosDisponibles: { id: string; titulo: string }[];
}) {
  const [membresiaOpen, setMembresiaOpen] = useState(false);
  const [cortesiaOpen, setCortesiaOpen] = useState(false);
  const [revocandoMembresia, setRevocandoMembresia] = useState(false);
  const [quitando, setQuitando] = useState<{ inscripcionId: string; titulo: string } | null>(null);
  const showToast = useAdminToast();

  // Solo se puede revocar una membresía manual todavía activa (f4accesos.md
  // no diseña cancelación para las de Stripe/Wompi, y una ya CANCELADA/
  // VENCIDA no tiene nada que revocar).
  const suscripcionVigente = suscripcionEstaVigentePorEstado(usuario.suscripcionEstado);
  const puedeRevocarMembresia = usuario.suscripcionEsManual && suscripcionVigente;

  async function handleQuitarCortesia(motivo: string) {
    if (!quitando) return { error: "Selecciona qué cortesía revocar." };
    const resultado = await quitarCortesia(quitando.inscripcionId, usuario.id, motivo);
    if (!resultado.error) showToast("Cortesía revocada.");
    return resultado;
  }

  async function handleRevocarMembresia(motivo: string) {
    if (!usuario.suscripcionId) return { error: "No encontramos la membresía." };
    const resultado = await revocarMembresia(usuario.suscripcionId, usuario.id, motivo);
    if (!resultado.error) showToast("Membresía revocada.");
    return resultado;
  }

  return (
    <div className="flex max-w-[900px] flex-col gap-5">
      {/* El mockup no lleva este enlace; se conserva como salida al listado. */}
      <Link
        href="/admin/usuarios"
        className="-mb-2 flex w-fit items-center gap-1.5 text-sm text-uva-muted-2 hover:text-uva-text"
      >
        <ArrowLeft className="size-4" />
        Volver a usuarios
      </Link>

      {/* Cabecera: el mockup la dibuja suelta sobre el fondo, sin tarjeta.
          Nombre y badges van en filas separadas — juntos en una sola
          `flex-wrap` (hasta 5 piezas: 4 pares etiqueta+badge más la fecha)
          envolvían en cualquier orden en mobile, igual que le pasaba a la
          cabecera de CursoDetalleView antes de agruparla. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3.5">
          <Avatar className="size-[52px] shrink-0 bg-uva-divider after:hidden">
            <AvatarFallback className="bg-uva-divider font-heading text-base font-bold text-uva-muted">
              {iniciales(usuario.nombre)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-heading text-[19px] font-bold tracking-[-0.02em] text-uva-text">
              {usuario.nombre}
            </h1>
            <p className="text-[12.5px] text-uva-muted">
              {usuario.correo} · {usuario.rol === "ADMINISTRADOR" ? "Administrador" : "Estudiante"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <div className="flex items-center gap-[5px]">
            <EtiquetaBadge>Cuenta:</EtiquetaBadge>
            <StatusBadge tone={usuario.estado === "ACTIVO" ? "success" : "error"}>
              {usuario.estado === "ACTIVO" ? "Activo" : "Suspendido"}
            </StatusBadge>
          </div>
          <div className="flex items-center gap-[5px]">
            <EtiquetaBadge>Plan:</EtiquetaBadge>
            {/* Antes siempre gris, sin importar si seguía vigente — mismo plan
                se veía igual de "activo" que uno ya cancelado hace meses. */}
            <StatusBadge tone={usuario.planActual && suscripcionVigente ? "accent" : "neutral"}>
              {usuario.planActual ?? "—"}
            </StatusBadge>
          </div>
          {/* El listado de usuarios ya mostraba este estado; la ficha no lo
              traía, así que revocar una membresía manual (revocarMembresia,
              deja CANCELADA) no se notaba aquí — solo desaparecía el botón
              "Revocar membresía", sin ninguna confirmación visual. */}
          {usuario.suscripcionEstado && (
            <div className="flex items-center gap-[5px]">
              <EtiquetaBadge>Estado:</EtiquetaBadge>
              <StatusBadge tone={TONO_ESTADO_SUSCRIPCION[usuario.suscripcionEstado]}>
                {ETIQUETA_ESTADO_SUSCRIPCION[usuario.suscripcionEstado]}
              </StatusBadge>
            </div>
          )}
          {/* Solo mientras siga vigente: "Acceso otorgado" junto a "Cancelada"
              leía como si el acceso siguiera en pie después de revocarlo. */}
          {usuario.tipoAccesoSuscripcion && suscripcionVigente && (
            <div className="flex items-center gap-[5px]">
              <EtiquetaBadge>Acceso:</EtiquetaBadge>
              <StatusBadge tone="accent">{ETIQUETA_TIPO_ACCESO[usuario.tipoAccesoSuscripcion]}</StatusBadge>
            </div>
          )}
          <div className="text-[12px] text-uva-muted-2 sm:ml-auto">
            Registrado {formatFecha(usuario.fechaRegistro)}
          </div>
        </div>
      </div>

      {/* Cuándo empieza y cuándo se le acaba la suscripción actual: antes no
          se mostraba en ningún sitio del panel — ni siquiera se traía de la
          base (el registro de arriba es cuándo se creó la CUENTA, no cuándo
          empezó a tener acceso). "Vence" para código/cortesía (no hay cobro
          automático detrás); "Renueva" para una suscripción de pago. */}
      {usuario.suscripcionInicio && (
        <p className="-mt-2 text-[12px] text-uva-muted-2">
          Suscripción desde {formatFecha(usuario.suscripcionInicio)}
          {usuario.suscripcionEstado === "CANCELADA" ? (
            // Revocada a mano (revocarMembresia): no tiene sentido seguir
            // diciendo "vence"/"renueva" en futuro de algo que un admin ya
            // cerró. El motivo que escribió queda visible aquí mismo — es
            // la trazabilidad que ve el admin sin tener que ir a la base.
            <> · cancelada{usuario.suscripcionMotivoCancelacion ? ` — ${usuario.suscripcionMotivoCancelacion}` : ""}</>
          ) : (
            usuario.suscripcionFin && (
              <>
                {" "}
                · {usuario.tipoAccesoSuscripcion ? "vence" : "renueva"}{" "}
                {formatFecha(usuario.suscripcionFin)}
              </>
            )
          )}
        </p>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="primary"
          className="w-full sm:w-auto"
          onClick={() => setMembresiaOpen(true)}
        >
          Otorgar membresía
        </Button>
        <Button type="button" className="w-full sm:w-auto" onClick={() => setCortesiaOpen(true)}>
          Ofrecer curso de cortesía
        </Button>
        {puedeRevocarMembresia && (
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={() => setRevocandoMembresia(true)}
          >
            Revocar membresía
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminCard className="gap-1">
          <div className="text-[11.5px] text-uva-muted">Cursos inscritos</div>
          <div className="font-mono text-[22px] font-bold tabular-nums">
            {usuario.metricas.cursosInscritos}
          </div>
        </AdminCard>
        <AdminCard className="gap-1">
          <div className="text-[11.5px] text-uva-muted">Completados</div>
          <div className="font-mono text-[22px] font-bold tabular-nums">
            {usuario.metricas.cursosCompletados}
          </div>
        </AdminCard>
        <AdminCard className="gap-1">
          <div className="text-[11.5px] text-uva-muted">Progreso promedio</div>
          <div className="font-mono text-[22px] font-bold tabular-nums">
            {usuario.metricas.progresoPromedio}%
          </div>
        </AdminCard>
        <AdminCard className="gap-1">
          <div className="text-[11.5px] text-uva-muted">Última actividad</div>
          <div className="mt-1 text-[13px]">
            {usuario.metricas.ultimaActividad
              ? formatFecha(usuario.metricas.ultimaActividad)
              : "Sin actividad"}
          </div>
        </AdminCard>
      </div>

      <AdminCard flush className="gap-0">
        <div className="px-[18px] pt-4 pb-1">
          <h2 className="font-heading text-[15px] font-bold tracking-[-0.02em] text-uva-text">
            Cursos del usuario
          </h2>
        </div>

        {usuario.cursos.length === 0 && (
          <p className="px-[18px] py-4 text-center text-sm text-uva-muted-2">
            Este usuario no está inscrito en ningún curso.
          </p>
        )}

        {/* Mismo criterio que las demás tablas del panel: 6 columnas (una un
            botón de acción) no caben sin scroll horizontal en un touch. */}
        {usuario.cursos.length > 0 && (
          <div className="flex flex-col pointer-fine:md:hidden">
            {usuario.cursos.map((curso) => (
              <div
                key={curso.inscripcionId ?? curso.cursoId}
                className="flex flex-col gap-2 border-t border-uva-divider px-[18px] py-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/admin/cursos/${curso.cursoId}`}
                    className="text-sm font-semibold text-uva-text hover:text-uva-accent-text"
                  >
                    {curso.titulo}
                  </Link>
                  <StatusBadge
                    tone={curso.estado === "COMPLETADO" ? "success" : "neutral"}
                    className="shrink-0"
                  >
                    {curso.estado === "COMPLETADO" ? "Completado" : "En progreso"}
                  </StatusBadge>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    role="progressbar"
                    aria-valuenow={curso.progreso}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progreso de ${curso.titulo}`}
                    className="h-1.5 w-full rounded-full bg-uva-divider"
                  >
                    <div className="h-full rounded-full bg-uva-accent" style={{ width: `${curso.progreso}%` }} />
                  </div>
                  <span className="shrink-0 font-mono text-xs text-uva-muted-2 tabular-nums">
                    {curso.progreso}%
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge tone={curso.tipoAcceso === "CORTESIA" ? "warning" : "neutral"}>
                    {curso.tipoAcceso === "CORTESIA" ? "Cortesía" : "Membresía"}
                  </StatusBadge>
                  {curso.tipoAcceso === "CORTESIA" && !curso.activo && (
                    <span title={curso.motivoRevocacion ?? undefined}>
                      <StatusBadge tone="error">Revocada</StatusBadge>
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-uva-muted-2">
                    {curso.ultimaActividad ? formatFecha(curso.ultimaActividad) : "Sin actividad"}
                  </span>
                  {curso.tipoAcceso === "CORTESIA" && curso.activo && curso.inscripcionId && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        setQuitando({ inscripcionId: curso.inscripcionId!, titulo: curso.titulo })
                      }
                    >
                      Quitar cortesía
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {usuario.cursos.length > 0 && (
        <Table className="hidden pointer-fine:md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Curso</TableHead>
              <TableHead>Progreso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Modo de obtención</TableHead>
              <TableHead>Última actividad</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuario.cursos.map((curso) => (
              <TableRow key={curso.inscripcionId ?? curso.cursoId}>
                <TableCell className="font-semibold">
                  <Link
                    href={`/admin/cursos/${curso.cursoId}`}
                    className="text-uva-text hover:text-uva-accent-text"
                  >
                    {curso.titulo}
                  </Link>
                </TableCell>
                <TableCell className="min-w-[140px]">
                  <div className="flex items-center gap-2">
                    {/* Barra plana de 6px, como en el mockup */}
                    <div
                      role="progressbar"
                      aria-valuenow={curso.progreso}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Progreso de ${curso.titulo}`}
                      className="h-1.5 w-full rounded-full bg-uva-divider"
                    >
                      <div
                        className="h-full rounded-full bg-uva-accent"
                        style={{ width: `${curso.progreso}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-uva-muted-2 tabular-nums">
                      {curso.progreso}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={curso.estado === "COMPLETADO" ? "success" : "neutral"}>
                    {curso.estado === "COMPLETADO" ? "Completado" : "En progreso"}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge tone={curso.tipoAcceso === "CORTESIA" ? "warning" : "neutral"}>
                      {curso.tipoAcceso === "CORTESIA" ? "Cortesía" : "Membresía"}
                    </StatusBadge>
                    {curso.tipoAcceso === "CORTESIA" && !curso.activo && (
                      <span title={curso.motivoRevocacion ?? undefined}>
                        <StatusBadge tone="error">Revocada</StatusBadge>
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-[12px] text-uva-muted-2">
                  {curso.ultimaActividad ? formatFecha(curso.ultimaActividad) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {curso.tipoAcceso === "CORTESIA" && curso.activo && curso.inscripcionId && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        setQuitando({ inscripcionId: curso.inscripcionId!, titulo: curso.titulo })
                      }
                    >
                      Quitar cortesía
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </AdminCard>

      <GrantMembershipDialog
        open={membresiaOpen}
        onOpenChange={setMembresiaOpen}
        usuarioId={usuario.id}
        planActual={usuario.planActual}
        planes={planes}
      />
      <GrantCourtesyDialog
        open={cortesiaOpen}
        onOpenChange={setCortesiaOpen}
        usuarioId={usuario.id}
        cursos={cursosDisponibles}
      />
      <RevokeAccessDialog
        open={quitando !== null}
        onOpenChange={(open) => !open && setQuitando(null)}
        title="Revocar cortesía"
        usuarioNombre={usuario.nombre}
        recurso={quitando ? `el curso de cortesía "${quitando.titulo}"` : ""}
        onConfirm={handleQuitarCortesia}
      />
      <RevokeAccessDialog
        open={revocandoMembresia}
        onOpenChange={setRevocandoMembresia}
        title="Revocar membresía"
        usuarioNombre={usuario.nombre}
        recurso="su membresía manual"
        onConfirm={handleRevocarMembresia}
      />
    </div>
  );
}
