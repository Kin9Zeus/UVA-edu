"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Cifra } from "@/components/admin/GraficaSemanas";
import { CurvaAvance, mayorCaida, type PuntoCurva } from "@/components/admin/cursos/CurvaAvance";
import { DIAS_SIN_AVANZAR } from "@/lib/admin/avance";
import type { EstudianteDeCurso, ModuloDetalle } from "@/lib/admin/cursoDetalle";

/* "Acceso general" es lo que da acceso a todo el catálogo (código de
   invitación, cortesía de U.V.A. o plan pagado); "Cortesía" es solo este
   curso. Antes decía "Membresía", que no es como se llama en Usuarios. */
const ACCESO_ITEMS = { todos: "Todo acceso", MEMBRESIA: "Acceso general", CORTESIA: "Cortesía de este curso" };

type Estado = EstudianteDeCurso["estado"] | "SIN_AVANZAR";
const ESTADO_ITEMS = {
  todos: "Todo estado",
  EN_PROGRESO: "En progreso",
  SIN_AVANZAR: "Dejó de avanzar",
  EXAMEN_PENDIENTE: "Examen pendiente",
  COMPLETADO: "Completado",
};

/* "Examen pendiente": terminó las clases pero el curso exige examen final y
   no lo ha aprobado. "Dejó de avanzar": en progreso y DIAS_SIN_AVANZAR o más
   sin tocar una clase. */
const ESTADO_BADGE = {
  EN_PROGRESO: { tone: "accent", etiqueta: "En progreso" },
  SIN_AVANZAR: { tone: "warning", etiqueta: "Dejó de avanzar" },
  EXAMEN_PENDIENTE: { tone: "warning", etiqueta: "Examen pendiente" },
  COMPLETADO: { tone: "success", etiqueta: "Completado" },
} as const;

const DIA = 86_400_000;

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "U";
}

function estadoDe(estudiante: EstudianteDeCurso, ahora: number): Estado {
  if (estudiante.estado !== "EN_PROGRESO" || !estudiante.ultimaVez) return estudiante.estado;
  return ahora - new Date(estudiante.ultimaVez).getTime() >= DIAS_SIN_AVANZAR * DIA ? "SIN_AVANZAR" : "EN_PROGRESO";
}

function haceCuanto(fecha: string | null, ahora: number) {
  if (!fecha) return "No ha empezado";
  const dias = Math.floor((ahora - new Date(fecha).getTime()) / DIA);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  return `Hace ${dias} días`;
}

function acceso(estudiante: EstudianteDeCurso) {
  if (estudiante.tipoAcceso === "MEMBRESIA") return "Acceso general";
  return estudiante.activo ? "Cortesía" : "Cortesía quitada";
}

/** Las clases con video, en orden, numeradas como en Contenido. */
export function puntosDeCurva(modulos: ModuloDetalle[]): PuntoCurva[] {
  return modulos.flatMap((modulo, m) =>
    modulo.lecciones
      .map((leccion, l) => ({ leccion, numero: `${m + 1}.${l + 1}` }))
      .filter(({ leccion }) => leccion.estadoProcesamiento === "LISTO")
      .map(({ leccion, numero }) => ({
        numero,
        titulo: leccion.titulo,
        modulo: m + 1,
        nombreModulo: modulo.titulo,
        terminaron: leccion.terminaron,
        seQuedaron: leccion.seQuedaron,
      })),
  );
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function EstudiantesTab({
  estudiantes,
  modulos,
}: {
  estudiantes: EstudianteDeCurso[];
  modulos: ModuloDetalle[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroAcceso, setFiltroAcceso] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  // Fijo al montar: los "hace N días" no cambian mientras se mira la pantalla.
  const [ahora] = useState(() => Date.now());

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return estudiantes.filter((estudiante) => {
      const coincideBusqueda = !texto || estudiante.nombre.toLowerCase().includes(texto);
      const coincideAcceso = filtroAcceso === "todos" || estudiante.tipoAcceso === filtroAcceso;
      const coincideEstado = filtroEstado === "todos" || estadoDe(estudiante, ahora) === filtroEstado;
      return coincideBusqueda && coincideAcceso && coincideEstado;
    });
  }, [estudiantes, busqueda, filtroAcceso, filtroEstado, ahora]);

  const puntos = puntosDeCurva(modulos);
  const caida = mayorCaida(puntos);
  const empezaron = estudiantes.filter((estudiante) => estudiante.ultimaVez).length;
  const recientes = estudiantes.filter((e) => e.ultimaVez && ahora - new Date(e.ultimaVez).getTime() < 7 * DIA).length;
  const terminaron = estudiantes.filter((estudiante) => estudiante.terminoClases).length;
  const conExamen = estudiantes.some((estudiante) => estudiante.aproboExamen !== null);
  const aprobaron = estudiantes.filter((estudiante) => estudiante.aproboExamen).length;
  const sinExamen = estudiantes.filter((estudiante) => estudiante.terminoClases && estudiante.aproboExamen === false).length;
  const sinAvanzar = estudiantes.filter((estudiante) => estadoDe(estudiante, ahora) === "SIN_AVANZAR").length;
  const seQuedaron = puntos.filter((punto) => punto.seQuedaron > 0).sort((a, b) => b.seQuedaron - a.seQuedaron);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="estudiantes-curva" className="rounded-uva-lg border border-uva-divider bg-uva-surface">
        <div className="min-w-0 border-b border-uva-divider p-4 sm:p-5 lg:px-6">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="estudiantes-curva" className="m-0 text-uva-cuerpo font-extrabold text-uva-text">
              Hasta qué clase llega la gente
            </h2>
            {puntos.length >= 2 && empezaron > 0 && (
              <p aria-hidden className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-uva-detalle text-uva-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-uva-xs bg-uva-serie-1" />
                  Terminaron la clase
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full border-2 border-uva-accent-2-text" />
                  Alguien se quedó ahí
                </span>
              </p>
            )}
          </div>
          {puntos.length < 2 || empezaron === 0 ? (
            <div className="grid justify-items-center gap-1 px-3 py-7 text-center">
              <p className="m-0 font-bold text-uva-text">
                {puntos.length < 2 ? "Falta contenido para la curva" : "Nadie ha empezado este curso"}
              </p>
              <p className="m-0 max-w-[44ch] text-uva-detalle text-uva-text-muted">
                {puntos.length < 2
                  ? "Sale cuando el curso tenga al menos dos clases con video listo."
                  : "Cuando alguien termine una clase, aquí se ve hasta dónde llega la gente."}
              </p>
            </div>
          ) : (
            <>
              <CurvaAvance puntos={puntos} />
              <p className="m-0 mt-3 rounded-uva-md bg-uva-bg px-3 py-2.5 text-uva-detalle text-uva-text">
                {caida !== null ? (
                  <>
                    Donde más gente se pierde: <b>{puntos[caida - 1].titulo}</b> → <b>{puntos[caida].titulo}</b>, de{" "}
                    {puntos[caida - 1].terminaron} a {puntos[caida].terminaron} personas.
                  </>
                ) : (
                  "Nadie se ha perdido entre una clase y la siguiente."
                )}{" "}
                {seQuedaron.length > 0 && (
                  <>
                    Se quedaron (la empezaron y llevan {DIAS_SIN_AVANZAR} días o más sin terminarla):{" "}
                    {seQuedaron.map((punto, i) => (
                      <span key={punto.numero}>
                        {i > 0 && ", "}
                        <b>{punto.titulo}</b> ({punto.seQuedaron})
                      </span>
                    ))}
                    .
                  </>
                )}
              </p>
            </>
          )}
        </div>
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          <Cifra enFila valor={String(empezaron)} etiqueta="empezaron" nota={`${recientes} estudiaron en los últimos 7 días`} />
          <Cifra
            enFila
            valor={String(terminaron)}
            etiqueta="terminaron las clases"
            nota={empezaron > 0 ? `${Math.round((terminaron / empezaron) * 100)} % de los que empezaron` : "Nadie ha empezado"}
          />
          {conExamen ? (
            <Cifra
              enFila
              valor={String(aprobaron)}
              etiqueta="aprobaron el examen"
              nota={sinExamen > 0 ? `${plural(sinExamen, "terminó y no lo ha aprobado", "terminaron y no lo han aprobado")}` : "Todos los que terminaron"}
            />
          ) : (
            <Cifra enFila valor="Sin examen" etiqueta="certificado al terminar las clases" nota="El curso no exige examen final" pequena />
          )}
          <Cifra
            enFila
            valor={String(sinAvanzar)}
            etiqueta="dejaron de avanzar"
            nota={`${DIAS_SIN_AVANZAR} días o más sin tocar una clase`}
            alerta={sinAvanzar > 0}
          />
        </dl>
      </section>

      <section aria-labelledby="estudiantes-lista" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="estudiantes-lista" className="text-uva-titulo-4 text-uva-text">
            {plural(estudiantes.length, "persona", "personas")}
          </h2>
          <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
            <div className="relative min-w-0 max-sm:basis-full sm:w-60">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-uva-text-faint" aria-hidden />
              <Input
                placeholder="Buscar por nombre"
                aria-label="Buscar por nombre"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select items={ESTADO_ITEMS} value={filtroEstado} onValueChange={(value) => setFiltroEstado(value ?? "todos")}>
              <SelectTrigger aria-label="Estado"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                {Object.entries(ESTADO_ITEMS).map(([valor, texto]) => (
                  <SelectItem key={valor} value={valor}>
                    {texto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select items={ACCESO_ITEMS} value={filtroAcceso} onValueChange={(value) => setFiltroAcceso(value ?? "todos")}>
              <SelectTrigger aria-label="Acceso"><SelectValue placeholder="Acceso" /></SelectTrigger>
              <SelectContent>
                {Object.entries(ACCESO_ITEMS).map(([valor, texto]) => (
                  <SelectItem key={valor} value={valor}>
                    {texto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <AdminCard flush>
          {filtrados.length === 0 && (
            <p className="m-0 px-5 py-6 text-center text-uva-detalle text-uva-text-muted">
              {estudiantes.length === 0 ? "Nadie ha empezado este curso ni tiene cortesía." : "No hay personas que coincidan."}
            </p>
          )}

          {/* Misma regla que la lista de cursos: en táctil, tarjetas; la
              tabla solo con mouse. */}
          {filtrados.length > 0 && (
            <ul className="m-0 flex list-none flex-col p-0 pointer-fine:md:hidden">
              {filtrados.map((estudiante) => {
                const estado = ESTADO_BADGE[estadoDe(estudiante, ahora)];
                return (
                  <li
                    key={estudiante.inscripcionId ?? estudiante.usuarioId}
                    className="flex flex-col gap-2.5 border-b border-uva-divider px-4 py-4 last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/admin/usuarios/${estudiante.usuarioSlug}`} className="flex min-h-11 min-w-0 items-center gap-2.5">
                        <Avatar size="sm" className="shrink-0 bg-uva-divider">
                          <AvatarFallback className="bg-uva-divider text-uva-detalle text-uva-text">
                            {iniciales(estudiante.nombre)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                          <span className="block font-bold break-words text-uva-text">{estudiante.nombre}</span>
                          <span className="block text-uva-detalle text-uva-text-muted">{haceCuanto(estudiante.ultimaVez, ahora)}</span>
                        </span>
                      </Link>
                      <StatusBadge tone={estado.tone} className="shrink-0">
                        {estado.etiqueta}
                      </StatusBadge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={estudiante.progreso} aria-label={`Avance de ${estudiante.nombre}`} className="flex-1" />
                      <span className="w-12 shrink-0 text-right font-mono text-uva-etiqueta whitespace-nowrap text-uva-text-muted tabular-nums">
                        {estudiante.progreso} %
                      </span>
                    </div>
                    <p className="m-0 text-uva-detalle text-uva-text-muted">{acceso(estudiante)}</p>
                  </li>
                );
              })}
            </ul>
          )}

          {filtrados.length > 0 && (
            <Table contenedorClassName="hidden pointer-fine:md:block" etiqueta="Tabla de estudiantes del curso">
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead>Avance</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última vez</TableHead>
                  <TableHead>Acceso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((estudiante) => {
                  const estado = ESTADO_BADGE[estadoDe(estudiante, ahora)];
                  return (
                    <TableRow key={estudiante.inscripcionId ?? estudiante.usuarioId}>
                      <TableCell>
                        <Link href={`/admin/usuarios/${estudiante.usuarioSlug}`} className="flex items-center gap-2.5 hover:text-uva-accent-text">
                          <Avatar size="sm" className="bg-uva-divider">
                            <AvatarFallback className="bg-uva-divider text-uva-detalle text-uva-text">
                              {iniciales(estudiante.nombre)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-bold text-uva-text">{estudiante.nombre}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <Progress value={estudiante.progreso} aria-label={`Avance de ${estudiante.nombre}`} className="w-24" />
                          <span className="font-mono text-uva-etiqueta whitespace-nowrap tabular-nums">{estudiante.progreso} %</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={estado.tone}>{estado.etiqueta}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-uva-detalle">{haceCuanto(estudiante.ultimaVez, ahora)}</TableCell>
                      <TableCell className="text-uva-detalle">{acceso(estudiante)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </AdminCard>
      </section>
    </div>
  );
}
