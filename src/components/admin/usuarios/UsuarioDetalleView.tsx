"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Gift, CreditCard } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/Toast";
import { GrantMembershipDialog } from "@/components/admin/usuarios/GrantMembershipDialog";
import { GrantCourtesyDialog } from "@/components/admin/usuarios/GrantCourtesyDialog";
import { quitarCortesia } from "@/actions/admin/usuarios";
import { formatFecha } from "@/lib/admin/format";
import type { UsuarioDetalle } from "@/lib/admin/usuarioDetalle";

const SUSCRIPCION_LABEL: Record<string, string> = {
  ACTIVA: "Activa",
  PAST_DUE: "Pago pendiente",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
};

const SUSCRIPCION_TONO: Record<string, "success" | "warning" | "error"> = {
  ACTIVA: "success",
  PAST_DUE: "warning",
  VENCIDA: "error",
  CANCELADA: "error",
};

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "U";
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
  const [quitando, setQuitando] = useState<{ inscripcionId: string; titulo: string } | null>(null);
  const showToast = useAdminToast();

  async function handleQuitarCortesia() {
    if (!quitando) return;
    const resultado = await quitarCortesia(quitando.inscripcionId, usuario.id);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast("Cortesía retirada.");
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/usuarios" className="flex w-fit items-center gap-1.5 text-sm text-uva-text-faint hover:text-uva-text">
        <ArrowLeft className="size-4" />
        Volver a usuarios
      </Link>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-5">
          <Avatar size="lg" className="size-16 bg-uva-divider">
            <AvatarFallback className="bg-uva-divider text-lg text-uva-text">
              {iniciales(usuario.nombre)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-lg text-uva-text">{usuario.nombre}</h1>
            <p className="text-sm text-uva-text-faint">
              {usuario.correo} · {usuario.rol === "ADMINISTRADOR" ? "Administrador" : "Estudiante"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge tone={usuario.estado === "ACTIVO" ? "success" : "error"}>
                Cuenta: {usuario.estado === "ACTIVO" ? "Activo" : "Suspendido"}
              </StatusBadge>
              <StatusBadge tone={usuario.suscripcionEstado ? SUSCRIPCION_TONO[usuario.suscripcionEstado] : "neutral"}>
                Suscripción: {usuario.suscripcionEstado ? SUSCRIPCION_LABEL[usuario.suscripcionEstado] : "Ninguna"}
              </StatusBadge>
              <StatusBadge tone="accent">Plan: {usuario.planActual ?? "Ninguno"}</StatusBadge>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setMembresiaOpen(true)}>
              <CreditCard className="size-4" />
              Otorgar membresía
            </Button>
            <Button type="button" variant="outline" onClick={() => setCortesiaOpen(true)}>
              <Gift className="size-4" />
              Ofrecer curso de cortesía
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-xs text-uva-text-faint">Cursos inscritos</p>
            <p className="font-mono text-2xl text-uva-text tabular-nums">{usuario.metricas.cursosInscritos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-uva-text-faint">Completados</p>
            <p className="font-mono text-2xl text-uva-text tabular-nums">{usuario.metricas.cursosCompletados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-uva-text-faint">Progreso promedio</p>
            <p className="font-mono text-2xl text-uva-text tabular-nums">{usuario.metricas.progresoPromedio}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-uva-text-faint">Última actividad</p>
            <p className="text-lg text-uva-text">
              {usuario.metricas.ultimaActividad ? formatFecha(usuario.metricas.ultimaActividad) : "Sin actividad"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <h2 className="mb-3 text-sm font-medium text-uva-text">Cursos del usuario</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Obtenido por</TableHead>
                <TableHead>Última actividad</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuario.cursos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-uva-text-faint">
                    Este usuario no está inscrito en ningún curso.
                  </TableCell>
                </TableRow>
              )}
              {usuario.cursos.map((curso) => (
                <TableRow key={curso.inscripcionId}>
                  <TableCell>
                    <Link href={`/admin/cursos/${curso.cursoId}`} className="text-uva-text hover:text-uva-accent-text">
                      {curso.titulo}
                    </Link>
                  </TableCell>
                  <TableCell className="min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <Progress value={curso.progreso} className="w-24" />
                      <span className="font-mono text-xs tabular-nums">{curso.progreso}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={curso.estado === "COMPLETADO" ? "success" : "accent"}>
                      {curso.estado === "COMPLETADO" ? "Completado" : "En progreso"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={curso.tipoAcceso === "CORTESIA" ? "warning" : "neutral"}>
                      {curso.tipoAcceso === "CORTESIA" ? "Cortesía" : "Membresía"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-uva-text-faint tabular-nums">
                    {curso.ultimaActividad ? formatFecha(curso.ultimaActividad) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {curso.tipoAcceso === "CORTESIA" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuitando({ inscripcionId: curso.inscripcionId, titulo: curso.titulo })}
                      >
                        Quitar cortesía
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
      <ConfirmDialog
        open={quitando !== null}
        onOpenChange={(open) => !open && setQuitando(null)}
        title="Quitar cortesía"
        description={`¿Retirar el acceso de cortesía a "${quitando?.titulo}"? El usuario perderá el acceso a este curso.`}
        confirmLabel="Quitar acceso"
        destructive
        onConfirm={handleQuitarCortesia}
      />
    </div>
  );
}
