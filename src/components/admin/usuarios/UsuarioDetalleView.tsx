"use client";

import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Cifra, GraficaSemanas } from "@/components/admin/GraficaSemanas";
import { GrantMembershipDialog } from "@/components/admin/usuarios/GrantMembershipDialog";
import { GrantCourtesyDialog } from "@/components/admin/usuarios/GrantCourtesyDialog";
import { RevokeAccessDialog } from "@/components/admin/usuarios/RevokeAccessDialog";
import { ExtenderAccesoDialog } from "@/components/admin/usuarios/ExtenderAccesoDialog";
import {
  quitarCortesia,
  revocarMembresia,
  cambiarRolProfesor,
  actualizarEspecialidadProfesor,
  suspenderActivarUsuario,
} from "@/actions/admin/usuarios";
import { quitarSegundoFactorDeAdmin } from "@/actions/admin/segundoFactor";
import { formatFecha } from "@/lib/admin/format";
import { diasCalendario, nombrePasarela, textoAcceso } from "@/lib/admin/acceso-texto";
import type { UsuarioDetalle } from "@/lib/admin/usuarioDetalle";
import type { SerieGrafica } from "@/lib/admin/grafica";
import { cn } from "@/lib/utils";

/* Tres estados desde Revf5 (docs/functional-spec.md Flujo 07): un curso con
   todas las clases vistas cuyo examen final no está aprobado no está
   completo — no tiene certificado. Mismas etiquetas que usa la pestaña
   Estudiantes del detalle de curso. */
const ESTADO_CURSO_BADGE = {
  EN_PROGRESO: { tone: "neutral", etiqueta: "En progreso" },
  EXAMEN_PENDIENTE: { tone: "warning", etiqueta: "Examen pendiente" },
  COMPLETADO: { tone: "success", etiqueta: "Completado" },
} as const;

const ROL_LABEL = { ESTUDIANTE: "Estudiante", PROFESOR: "Profesor", ADMINISTRADOR: "Administrador" } as const;

const SERIES_DIAS: SerieGrafica[] = [{ clave: "dias", nombre: "Días que estudió", color: "var(--uva-serie-1)" }];

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "U";
}

function Bloque({ titulo, insignia, children }: { titulo: string; insignia?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-uva-lg border border-uva-divider bg-uva-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-uva-cuerpo font-extrabold text-uva-text">{titulo}</h2>
        {insignia}
      </div>
      {children}
    </section>
  );
}

const Linea = ({ children, alerta }: { children: React.ReactNode; alerta?: boolean }) => (
  <p className={cn("m-0 text-uva-detalle", alerta ? "font-bold text-uva-warning-text" : "text-uva-text-muted")}>{children}</p>
);

export function UsuarioDetalleView({
  usuario,
  planes,
  cursosDisponibles,
  conCobro,
  ahora,
  segundoFactor = null,
}: {
  usuario: UsuarioDetalle;
  planes: { id: string; nombre: string; precio_centavos: number; moneda: string; duracion_dias: number }[];
  cursosDisponibles: { id: string; titulo: string }[];
  conCobro: boolean;
  /** Del servidor: los "hace N días" no cambian entre el render del servidor y el del navegador. */
  ahora: string;
  /**
   * Solo si la cuenta es de un administrador (FASE 8.1). `dispositivos` es
   * `null` si no se pudo comprobar; `esUnoMismo`, si es la ficha de quien mira.
   */
  segundoFactor?: { dispositivos: number | null; esUnoMismo: boolean } | null;
}) {
  const [dialogo, setDialogo] = useState<
    "dar" | "cortesia" | "revocar" | "extender" | "profesor" | "quitarProfesor" | "suspender" | "quitar2fa" | null
  >(null);
  const [quitando, setQuitando] = useState<{ inscripcionId: string; titulo: string } | null>(null);
  const [rol, setRol] = useState(usuario.rol);
  const [cuenta, setCuenta] = useState(usuario.estado);
  const [especialidad, setEspecialidad] = useState(usuario.especialidad ?? "");
  // Lo último confirmado por el servidor, para no dejar el botón activo
  // sobre un valor que ya está guardado.
  const [especialidadGuardada, setEspecialidadGuardada] = useState(usuario.especialidad ?? "");
  const [pendienteEspecialidad, setPendienteEspecialidad] = useState(false);
  const showToast = useAdminToast();
  const [dispositivos2fa, setDispositivos2fa] = useState(segundoFactor?.dispositivos ?? null);
  const cerrar = (abierto: boolean) => !abierto && setDialogo(null);

  const esAdministrador = rol === "ADMINISTRADOR";
  const acceso = usuario.acceso;
  const actual = usuario.accesoActual;
  const vigente = acceso !== null && (acceso.estado === "ACTIVA" || acceso.estado === "PAST_DUE");
  const gratuito = actual !== null && (actual.proveedor === "manual" || actual.proveedor === "invitacion");
  const texto = textoAcceso(acceso, rol, ahora, conCobro);

  async function cambiarRol(esProfesor: boolean) {
    const resultado = await cambiarRolProfesor(usuario.id, esProfesor);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    setRol(esProfesor ? "PROFESOR" : "ESTUDIANTE");
    showToast(esProfesor ? `${usuario.nombre} ahora es profesor. Ya lo puedes elegir en un curso.` : `${usuario.nombre} ya no es profesor.`);
  }

  async function cambiarCuenta(nueva: "ACTIVO" | "SUSPENDIDO") {
    const resultado = await suspenderActivarUsuario(usuario.id, nueva);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    setCuenta(nueva);
    showToast(nueva === "SUSPENDIDO" ? "Cuenta suspendida." : "Cuenta activada.");
  }

  async function quitarSegundoFactor() {
    const resultado = await quitarSegundoFactorDeAdmin(usuario.id);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    setDispositivos2fa(0);
    showToast(`Quitamos la verificación de ${usuario.nombre}. La próxima vez que entre tendrá que activarla de nuevo.`);
  }

  async function handleGuardarEspecialidad() {
    setPendienteEspecialidad(true);
    const resultado = await actualizarEspecialidadProfesor(usuario.id, especialidad);
    setPendienteEspecialidad(false);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    setEspecialidadGuardada(especialidad.trim());
    setEspecialidad(especialidad.trim());
    showToast("Especialidad guardada.");
  }

  async function handleQuitarCortesia(motivo: string) {
    if (!quitando) return { error: "Elige qué cortesía quitar." };
    const resultado = await quitarCortesia(quitando.inscripcionId, usuario.id, motivo);
    if (!resultado.error) showToast("Cortesía quitada.");
    return resultado;
  }

  async function handleRevocar(motivo: string) {
    if (!actual) return { error: "No encontramos el acceso." };
    const resultado = await revocarMembresia(actual.id, usuario.id, motivo);
    if (!resultado.error) showToast("Acceso revocado.");
    return resultado;
  }

  /* ---------- Acceso ---------- */
  const como =
    actual && actual.proveedor === "invitacion"
      ? actual.deLote || !actual.codigo
        ? "Entró con un código de lote."
        : (
            <>
              Entró con el código <span className="font-codigo text-uva-text">{actual.codigo}</span>.
            </>
          )
      : actual && actual.proveedor === "manual"
        ? "Se lo dio un administrador."
        : null;

  const botonCortesia = (
    <Button type="button" className="w-full sm:w-auto" onClick={() => setDialogo("cortesia")}>
      Dar un curso de cortesía
    </Button>
  );

  const bloqueAcceso = esAdministrador ? (
    <Bloque titulo="Acceso" insignia={<StatusBadge tone="accent">Permanente</StatusBadge>}>
      <Linea>Es administrador: ve todo el catálogo sin necesitar acceso.</Linea>
    </Bloque>
  ) : (
    <Bloque titulo="Acceso" insignia={<StatusBadge tone={texto.tono}>{texto.etiqueta}</StatusBadge>}>
      {como && <Linea>{como}</Linea>}
      {texto.lineas.map((linea) => (
        <Linea key={linea.texto} alerta={linea.alerta}>
          {linea.texto}
          {linea.texto.startsWith("Se le acaba") && acceso?.fin ? `, el ${formatFecha(acceso.fin)}` : ""}.
        </Linea>
      ))}
      {acceso?.origen === "PAGO" && vigente && acceso.proveedor === "wompi" && (
        <Linea>Wompi no cobra solo: para seguir, tiene que volver a comprar.</Linea>
      )}
      {acceso?.origen === "PAGO" && vigente && (
        <Linea>Un acceso pagado no se revoca desde el panel: se cancela o se reembolsa en {nombrePasarela(acceso.proveedor)}.</Linea>
      )}
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {vigente && gratuito && (
          <Button type="button" variant="primary" className="w-full sm:w-auto" onClick={() => setDialogo("extender")}>
            Dar más días
          </Button>
        )}
        {!vigente && (
          <Button type="button" variant="primary" className="w-full sm:w-auto" onClick={() => setDialogo("dar")}>
            Dar acceso
          </Button>
        )}
        {botonCortesia}
        {vigente && gratuito && (
          <Button type="button" variant="destructive" className="w-full sm:w-auto" onClick={() => setDialogo("revocar")}>
            Revocar acceso
          </Button>
        )}
      </div>
    </Bloque>
  );

  /* ---------- Rol y cuenta ---------- */
  const bloqueCuenta = (
    <Bloque titulo="Rol y cuenta">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-uva-detalle text-uva-text-muted">
          Rol: <span className="font-semibold text-uva-text">{ROL_LABEL[rol]}</span>
        </p>
        {!esAdministrador && (
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => setDialogo(rol === "PROFESOR" ? "quitarProfesor" : "profesor")}
          >
            {rol === "PROFESOR" ? "Quitar rol de profesor" : "Hacer profesor"}
          </Button>
        )}
      </div>
      {/* La especialidad sale bajo su nombre en la tarjeta pública de "quién
          dicta el curso" (curso_instructores_publico). */}
      {rol === "PROFESOR" && (
        <div className="flex flex-col gap-2">
          <div>
            <Label htmlFor="usuario-especialidad">Especialidad</Label>
            <Input
              id="usuario-especialidad"
              value={especialidad}
              maxLength={200}
              onChange={(event) => setEspecialidad(event.target.value)}
              placeholder="Modelado BIM y coordinación de disciplinas"
              aria-describedby="usuario-especialidad-ayuda"
            />
            <p id="usuario-especialidad-ayuda" className="mt-1.5 mb-0 text-uva-detalle text-uva-text-muted">
              Sale bajo su nombre en la página pública de los cursos que dicta.
            </p>
          </div>
          <div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={pendienteEspecialidad || especialidad.trim() === especialidadGuardada}
              onClick={handleGuardarEspecialidad}
            >
              {pendienteEspecialidad ? "Guardando…" : "Guardar especialidad"}
            </Button>
          </div>
        </div>
      )}
      <hr className="my-1 border-uva-divider" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-uva-detalle text-uva-text-muted">
          Cuenta: <span className="font-semibold text-uva-text">{cuenta === "ACTIVO" ? "Activa" : "Suspendida"}</span>
        </p>
        {!esAdministrador &&
          (cuenta === "ACTIVO" ? (
            <Button type="button" variant="destructive" className="w-full sm:w-auto" onClick={() => setDialogo("suspender")}>
              Suspender cuenta
            </Button>
          ) : (
            <Button type="button" className="w-full sm:w-auto" onClick={() => cambiarCuenta("ACTIVO")}>
              Activar cuenta
            </Button>
          ))}
      </div>
      {segundoFactor && (
        <>
          <hr className="my-1 border-uva-divider" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-uva-detalle text-uva-text-muted">
              Verificación en dos pasos:{" "}
              <span className="font-semibold text-uva-text">
                {dispositivos2fa === null
                  ? "No pudimos comprobarla"
                  : dispositivos2fa === 0
                    ? "Sin activar"
                    : `Activa (${dispositivos2fa} dispositivo${dispositivos2fa === 1 ? "" : "s"})`}
              </span>
            </p>
            {segundoFactor.esUnoMismo ? (
              <p className="m-0 text-uva-detalle text-uva-text-muted">La tuya se cambia en Mi perfil.</p>
            ) : (
              dispositivos2fa !== null &&
              dispositivos2fa > 0 && (
                <Button type="button" variant="destructive" className="w-full sm:w-auto" onClick={() => setDialogo("quitar2fa")}>
                  Quitar su verificación
                </Button>
              )
            )}
          </div>
        </>
      )}
    </Bloque>
  );

  /* ---------- Cómo estudia ---------- */
  const { estudio, metricas } = usuario;
  const nunca = metricas.ultimaActividad === null;
  const diasDesdeUltima = metricas.ultimaActividad ? diasCalendario(metricas.ultimaActividad, ahora) : null;
  const ultimoCurso = usuario.cursos
    .filter((c) => c.ultimaActividad)
    .sort((a, b) => (b.ultimaActividad ?? "").localeCompare(a.ultimaActividad ?? ""))[0];
  const cursosConClases = usuario.cursos.filter((c) => c.progreso > 0).length;

  const resumen = (
    <section aria-labelledby="usuario-estudio" className="rounded-uva-lg border border-uva-divider bg-uva-surface">
      <div className="min-w-0 border-b border-uva-divider p-4 sm:p-5 lg:px-6">
        <h2 id="usuario-estudio" className="mb-3 text-uva-cuerpo font-extrabold text-uva-text">
          Días que estudió cada semana
        </h2>
        <div className="relative">
          <GraficaSemanas
            semanas={estudio.semanas}
            series={SERIES_DIAS}
            etiqueta="Días que estudió por semana, últimas 12 semanas"
            resumenSemana={(semana) => plural(semana.total, "día", "días")}
            formato={(valor) => plural(valor, "día", "días")}
            sinDatos="No estudió"
          />
          {estudio.semanas.every((s) => s.total === 0) && (
            <div className="absolute inset-x-6 top-2 bottom-8 grid place-content-center gap-1 text-center">
              <p className="m-0 font-bold text-uva-text">
                {nunca ? "Todavía no ha visto ninguna clase" : "No estudió en estas 12 semanas"}
              </p>
              <p className="m-0 max-w-[42ch] text-uva-detalle text-uva-text-muted">
                Cada barra es cuántos días de esa semana vio al menos una clase.
              </p>
            </div>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 lg:grid-cols-4">
        <Cifra
          enFila
          valor={String(estudio.dias30)}
          etiqueta={estudio.dias30 === 1 ? "día que estudió en 30 días" : "días que estudió en 30 días"}
          nota={estudio.racha > 1 ? `Lleva ${estudio.racha} días seguidos` : nunca ? "Nunca ha estudiado" : "Sin días seguidos ahora"}
        />
        <Cifra
          enFila
          pequena
          valor={diasDesdeUltima === null ? "Nunca" : diasDesdeUltima <= 0 ? "Hoy" : diasDesdeUltima === 1 ? "Ayer" : `Hace ${diasDesdeUltima} días`}
          etiqueta="última vez que estudió"
          nota={ultimoCurso ? ultimoCurso.titulo : `Se registró el ${formatFecha(usuario.fechaRegistro)}`}
          alerta={vigente && (diasDesdeUltima === null || diasDesdeUltima >= 14)}
        />
        <Cifra
          enFila
          valor={String(usuario.clasesTerminadas)}
          etiqueta={usuario.clasesTerminadas === 1 ? "clase terminada" : "clases terminadas"}
          nota={cursosConClases > 0 ? `En ${plural(cursosConClases, "curso", "cursos")}` : "Ninguna todavía"}
        />
        <Cifra
          enFila
          valor={String(metricas.cursosCompletados)}
          etiqueta={metricas.cursosCompletados === 1 ? "curso terminado" : "cursos terminados"}
          nota={metricas.cursosInscritos > 0 ? `De ${plural(metricas.cursosInscritos, "curso empezado", "cursos empezados")}` : "No ha empezado ninguno"}
        />
      </dl>
    </section>
  );

  /* ---------- Accesos y pagos ---------- */
  const conPagos = conCobro || usuario.totalPagado !== null;
  const historial = !esAdministrador && (
    <section aria-labelledby="usuario-historial" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="usuario-historial" className="m-0 text-uva-titulo-4 font-extrabold text-uva-text">
          {conPagos ? "Accesos y pagos" : "Accesos"}
        </h2>
        {usuario.totalPagado && (
          <p className="m-0 text-uva-detalle text-uva-text-muted">
            Ha pagado en total <span className="font-mono font-bold text-uva-text">{usuario.totalPagado}</span>
          </p>
        )}
      </div>
      <AdminCard flush>
        {usuario.historial.length === 0 ? (
          <p className="m-0 px-5 py-6 text-center text-uva-detalle text-uva-text-muted">
            Nunca ha tenido acceso{conCobro ? " ni ha pagado" : ""}.
          </p>
        ) : (
          <ol className="m-0 list-none p-0">
            {usuario.historial.map((evento, i) => (
              <li
                key={`${evento.fecha}-${i}`}
                className="flex flex-col gap-1 border-b border-uva-divider px-5 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="shrink-0 font-mono text-uva-detalle whitespace-nowrap text-uva-text-muted tabular-nums sm:w-36">
                  {formatFecha(evento.fecha)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold break-words text-uva-text">{evento.titulo}</span>
                  <span className="text-uva-detalle break-words text-uva-text-muted">{evento.detalle}</span>
                </span>
                {evento.resultado && (
                  <StatusBadge tone={evento.resultado === "Aprobado" ? "success" : "error"} className="self-start sm:self-center">
                    {evento.resultado}
                  </StatusBadge>
                )}
              </li>
            ))}
          </ol>
        )}
      </AdminCard>
    </section>
  );

  /* ---------- Cursos ---------- */
  const botonQuitar = (curso: UsuarioDetalle["cursos"][number]) =>
    curso.tipoAcceso === "CORTESIA" &&
    curso.activo &&
    curso.inscripcionId && (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setQuitando({ inscripcionId: curso.inscripcionId!, titulo: curso.titulo })}
      >
        Quitar cortesía
      </Button>
    );
  const accesoCurso = (curso: UsuarioDetalle["cursos"][number]) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge tone={curso.tipoAcceso === "CORTESIA" ? "warning" : "neutral"}>
        {curso.tipoAcceso === "CORTESIA" ? "Cortesía" : "Con su acceso"}
      </StatusBadge>
      {curso.tipoAcceso === "CORTESIA" && !curso.activo && (
        <span title={curso.motivoRevocacion ?? undefined}>
          <StatusBadge tone="error">Quitada</StatusBadge>
        </span>
      )}
    </div>
  );
  const ultimaVez = (fecha: string | null) => {
    if (!fecha) return "Nunca";
    const d = diasCalendario(fecha, ahora);
    return d <= 0 ? "Hoy" : d === 1 ? "Ayer" : `Hace ${d} días`;
  };

  const cursos = (
    <section aria-labelledby="usuario-cursos" className="flex flex-col gap-3">
      <h2 id="usuario-cursos" className="m-0 text-uva-titulo-4 font-extrabold text-uva-text">
        Cursos
      </h2>
      <AdminCard flush>
        {usuario.cursos.length === 0 && (
          <div className="grid justify-items-center gap-1 px-5 py-8 text-center">
            <p className="m-0 font-bold text-uva-text">No ha empezado ningún curso</p>
            <p className="m-0 max-w-[46ch] text-uva-detalle text-uva-text-muted">
              Aparecen aquí cuando ve la primera clase de un curso, o cuando le das uno de cortesía.
            </p>
          </div>
        )}

        {usuario.cursos.length > 0 && (
          <ul className="m-0 flex list-none flex-col p-0 pointer-fine:md:hidden">
            {usuario.cursos.map((curso) => (
              <li key={curso.inscripcionId ?? curso.cursoId} className="flex flex-col gap-2 border-b border-uva-divider px-5 py-4 last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/admin/cursos/${curso.cursoSlug ?? curso.cursoId}`}
                    className="font-semibold text-uva-text hover:text-uva-accent-text"
                  >
                    {curso.titulo}
                  </Link>
                  <StatusBadge tone={ESTADO_CURSO_BADGE[curso.estado].tone} className="shrink-0">
                    {ESTADO_CURSO_BADGE[curso.estado].etiqueta}
                  </StatusBadge>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={curso.progreso} aria-label={`Avance en ${curso.titulo}`} />
                  <span className="shrink-0 font-mono text-uva-detalle text-uva-text-muted tabular-nums">{curso.progreso} %</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {accesoCurso(curso)}
                  <span className="text-uva-detalle text-uva-text-muted">Última vez: {ultimaVez(curso.ultimaActividad).toLowerCase()}</span>
                </div>
                {botonQuitar(curso) && <div>{botonQuitar(curso)}</div>}
              </li>
            ))}
          </ul>
        )}

        {usuario.cursos.length > 0 && (
          <Table contenedorClassName="hidden pointer-fine:md:block" etiqueta="Cursos de la persona">
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acceso</TableHead>
                <TableHead>Última vez</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuario.cursos.map((curso) => (
                <TableRow key={curso.inscripcionId ?? curso.cursoId}>
                  <TableCell className="max-w-64 font-semibold whitespace-normal">
                    <Link
                      href={`/admin/cursos/${curso.cursoSlug ?? curso.cursoId}`}
                      className="text-uva-text hover:text-uva-accent-text"
                    >
                      {curso.titulo}
                    </Link>
                  </TableCell>
                  <TableCell className="min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <Progress value={curso.progreso} aria-label={`Avance en ${curso.titulo}`} />
                      <span className="font-mono text-uva-detalle text-uva-text-muted tabular-nums">{curso.progreso} %</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={ESTADO_CURSO_BADGE[curso.estado].tone}>{ESTADO_CURSO_BADGE[curso.estado].etiqueta}</StatusBadge>
                  </TableCell>
                  <TableCell>{accesoCurso(curso)}</TableCell>
                  <TableCell className="text-uva-detalle text-uva-text-muted">{ultimaVez(curso.ultimaActividad)}</TableCell>
                  <TableCell className="text-right">{botonQuitar(curso)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminCard>
    </section>
  );

  return (
    <div className="flex max-w-[1040px] flex-col gap-6">
      <Link
        href="/admin/usuarios"
        className="-mb-2 flex min-h-11 w-fit items-center gap-1.5 text-uva-detalle text-uva-text-muted hover:text-uva-text pointer-fine:min-h-0"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a usuarios
      </Link>

      <header className="flex items-center gap-4">
        <Avatar className="size-14 shrink-0 bg-uva-divider after:hidden">
          {usuario.fotoUrl && <AvatarImage src={usuario.fotoUrl} alt="" />}
          <AvatarFallback className="bg-uva-divider font-heading text-uva-titulo-4 font-bold text-uva-muted">
            {iniciales(usuario.nombre)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="m-0 text-uva-titulo-3 text-balance break-words text-uva-text">{usuario.nombre}</h1>
          {/* El correo puede partirse en cualquier letra; la fecha no. */}
          <p className="m-0 text-uva-detalle text-uva-text-muted">
            <span className="break-all">{usuario.correo}</span> · se registró el{" "}
            <span className="whitespace-nowrap">{formatFecha(usuario.fechaRegistro)}</span>
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {bloqueAcceso}
        {bloqueCuenta}
      </div>

      {resumen}
      {historial}
      {cursos}

      <GrantMembershipDialog
        open={dialogo === "dar"}
        onOpenChange={cerrar}
        usuarioId={usuario.id}
        planActual={usuario.planActual}
        planes={planes}
        conCobro={conCobro}
      />
      <GrantCourtesyDialog open={dialogo === "cortesia"} onOpenChange={cerrar} usuarioId={usuario.id} cursos={cursosDisponibles} />
      {actual && actual.fin && (
        <ExtenderAccesoDialog
          open={dialogo === "extender"}
          onOpenChange={cerrar}
          usuarioId={usuario.id}
          usuarioNombre={usuario.nombre}
          suscripcionId={actual.id}
          fin={actual.fin}
        />
      )}
      <RevokeAccessDialog
        open={quitando !== null}
        onOpenChange={(open) => !open && setQuitando(null)}
        title="Quitar cortesía"
        usuarioNombre={usuario.nombre}
        recurso={quitando ? `el curso de cortesía "${quitando.titulo}"` : ""}
        onConfirm={handleQuitarCortesia}
      />
      <RevokeAccessDialog
        open={dialogo === "revocar"}
        onOpenChange={cerrar}
        title="Revocar acceso"
        usuarioNombre={usuario.nombre}
        recurso="su acceso"
        onConfirm={handleRevocar}
      />
      <ConfirmDialog
        open={dialogo === "profesor"}
        onOpenChange={cerrar}
        title={`¿Hacer profesor a ${usuario.nombre}?`}
        description={
          // La descripción del diálogo es un <p>: nada de listas adentro.
          <span className="flex flex-col gap-2">
            <span>Lo podrás elegir como quien dicta un curso. Su nombre y su especialidad se verán en la página pública de ese curso.</span>
            <span>En la comunidad, sus respuestas llevarán la marca de profesor.</span>
            <span>No le da acceso al panel de administración ni le deja editar cursos. Puedes quitarle el rol cuando quieras.</span>
          </span>
        }
        confirmLabel="Hacer profesor"
        onConfirm={() => cambiarRol(true)}
      />
      <ConfirmDialog
        open={dialogo === "quitarProfesor"}
        onOpenChange={cerrar}
        title={`¿Quitarle el rol de profesor a ${usuario.nombre}?`}
        description={
          <span className="flex flex-col gap-2">
            {usuario.cursosQueDicta.length > 0 ? (
              <span>
                Figura como profesor en {plural(usuario.cursosQueDicta.length, "curso", "cursos")}:{" "}
                <span className="font-semibold text-uva-text">{usuario.cursosQueDicta.map((c) => c.titulo).join(", ")}</span>. Seguirá
                saliendo en {usuario.cursosQueDicta.length === 1 ? "él" : "ellos"}, pero no podrás guardar cambios en{" "}
                {usuario.cursosQueDicta.length === 1 ? "ese curso" : "esos cursos"} hasta elegir a otro profesor.
              </span>
            ) : (
              <span>No figura como profesor en ningún curso.</span>
            )}
            <span>Sus respuestas en la comunidad dejarán de llevar la marca de profesor.</span>
          </span>
        }
        confirmLabel="Quitar rol de profesor"
        destructive
        onConfirm={() => cambiarRol(false)}
      />
      <ConfirmDialog
        open={dialogo === "suspender"}
        onOpenChange={cerrar}
        title={`¿Suspender a ${usuario.nombre}?`}
        description="Se cerrará su sesión y no podrá entrar ni ver sus cursos hasta que la vuelvas a activar. Su avance y sus certificados se conservan."
        confirmLabel="Suspender cuenta"
        destructive
        onConfirm={() => cambiarCuenta("SUSPENDIDO")}
      />
      <ConfirmDialog
        open={dialogo === "quitar2fa"}
        onOpenChange={cerrar}
        title={`¿Quitar la verificación en dos pasos de ${usuario.nombre}?`}
        description="Hazlo solo si perdió su celular y ya confirmaste que es esa persona por otro canal, como una videollamada. Nunca por un mensaje de chat: así es como alguien se hace pasar por otro. La próxima vez que entre tendrá que activarla de nuevo, y quedará en la bitácora. Para confirmar, escribe su correo."
        confirmText={usuario.correo}
        confirmLabel="Quitar su verificación"
        destructive
        onConfirm={quitarSegundoFactor}
      />
    </div>
  );
}
