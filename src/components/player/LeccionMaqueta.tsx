"use client";

import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, FileCheck, List, Loader2, Lock } from "lucide-react";
import { EncabezadoCurso } from "@/components/curso/EncabezadoCurso";
import { MenuCuenta } from "@/components/dashboard/MenuCuenta";
import { SelectorTemaBoton } from "@/components/tema/SelectorTema";
import { RichTextRenderer } from "@/components/editor/RichTextRenderer";
import { ComentariosClase, type SesionComentarios } from "@/components/player/ComentariosClase";
import { NotasTab } from "@/components/player/NotasTab";
import { contarComentarios } from "@/components/player/PlayerTabs";
import { TemarioDrawer } from "@/components/player/TemarioDrawer";
import { VideoFrame } from "@/components/player/VideoFrame";
import type { ControlReproductor } from "@/components/features/VideoPlayer";
import { iniciarProgresoLeccion, marcarLeccion } from "@/actions/progreso/marcar";
import { obtenerUrlRecurso } from "@/actions/cursos/recurso";
import { extensionArchivo, formatTamanoArchivo } from "@/lib/admin/format";
import type { ComentarioConRespuestas } from "@/lib/comentarios";
import { porcentajeLecciones } from "@/lib/examenes/estadoPorCurso";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import type { LeccionPlayer, RecursoLeccion } from "@/lib/leccion";
import type { NotaLeccion } from "@/lib/notas";
import { cn } from "@/lib/utils";

type Pestana = "resumen" | "recursos" | "notas" | "comentarios";
type PanelLateral = "notas" | "comentarios";

/** Desde aquí la clase va en dos columnas y notas y comentarios pasan a la lateral. */
const ESCRITORIO = "(min-width: 1024px)";

const BOTON_PRIMARIO =
  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-uva-md bg-uva-btn px-5 text-center text-uva-cuerpo font-semibold text-uva-on-accent hover:bg-uva-btn-hover hover:no-underline";
const BOTON_SECUNDARIO =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-uva-md border-[1.5px] border-uva-line-strong px-4 text-center text-uva-detalle font-semibold text-uva-text hover:border-uva-text hover:no-underline";

/** Lo que solo existe con la sesión iniciada. */
export type SesionLeccion = {
  usuarioId: string;
  nombre: string;
  fotoUrl: string | null;
  esAdmin: boolean;
  /** Notas privadas de la persona en esta clase. */
  notas: NotaLeccion[];
  /** La lectura de las notas falló: se avisa con Reintentar, no con "Aún no tienes notas". */
  notasNoDisponibles: boolean;
  /** `?t=` de la URL: al llegar desde una nota arranca en ese segundo, no en el guardado. */
  segundoEnUrl: number | null;
};

/**
 * Clase de un curso (`/cursos/[curso]/[clase]`), dirección visual «Maqueta»
 * (artboards "leccion" y "leccion movil" del canvas "UVA Cursos"). Una sola
 * vista para los dos casos, para que no se separen con el tiempo.
 *
 * Con sesión (`sesion`): progreso, "Marcar como vista", notas, comentarios
 * con respuestas y "me gusta", descargas, Anterior / Siguiente y, en la
 * última clase, "Hacer examen".
 *
 * Sin sesión solo existe la primera clase de cada curso (`getLeccionPlayer`):
 * - La tarjeta "Clase gratis" ocupa el lugar de "Progreso".
 * - "Siguiente clase" y el temario llevan candado y pasan por iniciar sesión,
 *   que vuelve a esa clase.
 * - Sin notas (son privadas de cada cuenta); recursos y comentarios se ven,
 *   pero descargar y comentar piden entrar.
 */
export function LeccionMaqueta({
  data,
  comentarios,
  comentariosNoDisponibles,
  sesion,
}: {
  data: LeccionPlayer;
  comentarios: ComentarioConRespuestas[];
  comentariosNoDisponibles: boolean;
  sesion: SesionLeccion | null;
}) {
  const router = useRouter();
  const rutaDe = (slug: string) => `/cursos/${data.cursoSlug}/${slug}`;
  const entrarA = (ruta: string) => `/login?redirect=${encodeURIComponent(ruta)}`;
  const ruta = rutaDe(data.leccionSlug);
  const rutaEntrar = entrarA(ruta);
  const rutaExamen = `/cursos/${data.cursoSlug}/examen`;
  const siguiente = data.siguienteSlug
    ? data.lecciones.find((leccion) => leccion.slug === data.siguienteSlug) ?? null
    : null;
  /** Con sesión navega; sin sesión pasa por iniciar sesión y vuelve a la clase. */
  const rutaClase = (slug: string) => (sesion ? rutaDe(slug) : entrarA(rutaDe(slug)));
  const totalComentarios = contarComentarios(comentarios);
  const notaSiguienteId = useId();
  const notaVistaId = useId();

  // --- Avance (solo con sesión) ---
  const [completada, setCompletada] = useState(data.completada);
  // Copia local de qué clases están completadas: la tarjeta de progreso y el
  // temario reflejan el cambio al instante, sin esperar a que Next.js
  // revalide la ruta tras la Server Action.
  const [completadoPorLeccion, setCompletadoPorLeccion] = useState(
    () => new Map(data.lecciones.map((leccion) => [leccion.id, leccion.completado])),
  );
  const [errorVista, setErrorVista] = useState<string | null>(null);
  const [, startMarcar] = useTransition();
  // Solo las clases con video listo cuentan, como en el certificado
  // (`clasesConVideo` en lib/leccion.ts).
  const conVideo = new Set(data.lecciones.filter((leccion) => leccion.videoListo).map((leccion) => leccion.id));
  const completadas = [...completadoPorLeccion].filter(([id, hecha]) => hecha && conVideo.has(id)).length;
  const porcentaje = porcentajeLecciones(completadas, data.clasesConVideo);

  function alternarVista() {
    const siguienteValor = !completada;
    setCompletada(siguienteValor);
    setErrorVista(null);
    setCompletadoPorLeccion((mapa) => new Map(mapa).set(data.leccionId, siguienteValor));
    startMarcar(async () => {
      const resultado = await marcarLeccion(data.leccionId, siguienteValor);
      if ("error" in resultado) {
        setCompletada(!siguienteValor);
        setCompletadoPorLeccion((mapa) => new Map(mapa).set(data.leccionId, !siguienteValor));
        setErrorVista("No pudimos guardar el cambio. Intenta de nuevo.");
      } else {
        router.refresh();
      }
    });
  }

  // El reproductor avisa una sola vez al terminar el video: misma escritura
  // que la casilla, solo si la clase todavía no estaba vista.
  function completarPorFinDeVideo() {
    if (sesion && !completada) alternarVista();
  }

  // Al abrir la clase, no al terminarla: es lo que alimenta "Seguir viendo"
  // en la ficha del curso y en el inicio del panel.
  const conSesion = sesion !== null;
  useEffect(() => {
    if (conSesion) void iniciarProgresoLeccion(data.leccionId);
  }, [conSesion, data.leccionId]);

  // --- Notas (solo con sesión) ---
  // Viven acá y no en NotasTab: cambiar de pestaña desmonta la pestaña y lo
  // recién guardado no debe perderse. Van etiquetadas con su clase para
  // descartarlas si este componente se reutiliza al navegar a otra.
  const notasIniciales = sesion?.notas ?? [];
  const notasNoDisponibles = sesion?.notasNoDisponibles ?? false;
  const [estadoNotas, setEstadoNotas] = useState({
    leccionId: data.leccionId,
    notas: notasIniciales,
    noDisponibles: notasNoDisponibles,
  });
  // Se vuelve a sembrar al cambiar de clase y cuando las notas pasan de "no
  // disponibles" a disponibles (Reintentar tras un fallo).
  if (estadoNotas.leccionId !== data.leccionId || (estadoNotas.noDisponibles && !notasNoDisponibles)) {
    setEstadoNotas({ leccionId: data.leccionId, notas: notasIniciales, noDisponibles: notasNoDisponibles });
  }
  const notas = estadoNotas.notas;
  const cambiarNotas = (actualizar: (notas: NotaLeccion[]) => NotaLeccion[]) =>
    setEstadoNotas((estado) => ({ ...estado, notas: actualizar(estado.notas) }));

  const controlRef = useRef<ControlReproductor | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  // Salto desde una nota: lleva el video al segundo y, si quedó fuera de la
  // pantalla (en celular la lista está debajo), lo trae a la vista.
  function saltarA(segundo: number) {
    controlRef.current?.irA(segundo);
    const marco = videoRef.current;
    if (!marco) return;
    const { top, bottom } = marco.getBoundingClientRect();
    if (top < 0 || bottom > window.innerHeight) {
      const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      marco.scrollIntoView({ behavior: reducir ? "auto" : "smooth", block: "start" });
    }
  }

  // --- Pestañas y paneles ---
  const [pestana, setPestana] = useState<Pestana>("resumen");
  const [panel, setPanel] = useState<PanelLateral>(sesion ? "notas" : "comentarios");
  // En escritorio notas y comentarios viven en la columna lateral y sus
  // pestañas no existen: si quedó elegida una y la ventana crece, vuelve a
  // Resumen. `escritorio` también evita montar dos NotasTab a la vez.
  const [escritorio, setEscritorio] = useState(false);
  useEffect(() => {
    const consulta = window.matchMedia(ESCRITORIO);
    const ajustar = () => {
      setEscritorio(consulta.matches);
      if (consulta.matches) {
        setPestana((actual) => (actual === "comentarios" || actual === "notas" ? "resumen" : actual));
      }
    };
    ajustar();
    consulta.addEventListener("change", ajustar);
    return () => consulta.removeEventListener("change", ajustar);
  }, []);

  const [temarioAbierto, setTemarioAbierto] = useState(false);
  const abrirTemario = () => setTemarioAbierto(true);
  function irALeccion(leccionId: string) {
    setTemarioAbierto(false);
    const leccion = data.lecciones.find((item) => item.id === leccionId);
    if (!leccion?.slug || leccion.id === data.leccionId) return;
    router.push(rutaClase(leccion.slug));
  }

  const sesionComentarios: SesionComentarios | null = sesion
    ? {
        ruta,
        leccionId: data.leccionId,
        usuarioActualId: sesion.usuarioId,
        esAdmin: sesion.esAdmin,
        onCambio: () => router.refresh(),
      }
    : null;
  const comentariosNodo = (
    <ComentariosClase
      comentarios={comentarios}
      noDisponibles={comentariosNoDisponibles}
      onReintentar={() => router.refresh()}
      sesion={sesionComentarios}
      rutaEntrar={rutaEntrar}
    />
  );
  const notasNodo = (
    <NotasTab
      leccionId={data.leccionId}
      cursoSlug={data.cursoSlug}
      lecciones={data.lecciones}
      videoListo={data.videoListo}
      notas={notas}
      noDisponibles={notasNoDisponibles}
      onReintentar={() => router.refresh()}
      onCambiarNotas={cambiarNotas}
      controlRef={controlRef}
      onSaltar={saltarA}
    />
  );
  const totalNotas = sesion && !notasNoDisponibles ? notas.length : null;

  // "Sigue:" en la tarjeta de progreso: la próxima clase o, en la última, el examen.
  const sigue: { titulo: string; href: string } | null = siguiente?.slug
    ? { titulo: siguiente.titulo, href: rutaClase(siguiente.slug) }
    : sesion && data.examenDisponible
      ? { titulo: "Examen final", href: rutaExamen }
      : null;

  return (
    <div className="flex min-h-dvh flex-col bg-uva-bg">
      <EncabezadoCurso
        inicio={
          sesion
            ? { href: "/dashboard", etiqueta: "U.V.A., ir al inicio del panel" }
            : { href: "/", etiqueta: "U.V.A., ir al inicio" }
        }
        volver={{ href: `/cursos/${data.cursoSlug}`, texto: data.cursoTitulo }}
      >
        <button
          type="button"
          onClick={abrirTemario}
          aria-label={`Temario del curso, clase ${data.numero} de ${data.totalClases}`}
          className={cn(BOTON_SECUNDARIO, "cursor-pointer bg-transparent lg:hidden")}
        >
          <List className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
          Temario
          <span className="font-mono text-uva-text-muted">
            {data.numero}/{data.totalClases}
          </span>
        </button>
        <SelectorTemaBoton className="hidden text-uva-text hover:bg-uva-hover hover:text-uva-text lg:inline-flex" />
        {sesion ? (
          <MenuCuenta
            nombre={sesion.nombre}
            fotoUrl={sesion.fotoUrl}
            esAdmin={sesion.esAdmin}
            mostrarNombre={false}
            comunidadSiempre
          />
        ) : (
          <Link href={rutaEntrar} className={cn(BOTON_SECUNDARIO, "hidden shrink-0 lg:inline-flex")}>
            Entra o crea tu cuenta
          </Link>
        )}
      </EncabezadoCurso>

      <div className="mx-auto grid w-full max-w-uva flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_clamp(340px,30vw,440px)]">
        <div className="flex min-w-0 flex-col gap-5 pb-10 lg:gap-6 lg:px-10 lg:pt-7 lg:pb-12">
          <div ref={videoRef} className="scroll-mt-4">
            <VideoFrame
              leccionId={data.leccionId}
              videoListo={data.videoListo}
              titulo={data.leccionTitulo}
              segundoActual={sesion ? (sesion.segundoEnUrl ?? data.segundoActual) : undefined}
              posterUrl={data.posterUrl}
              onTerminado={sesion ? completarPorFinDeVideo : undefined}
              controlRef={sesion ? controlRef : undefined}
              className="aspect-video h-auto rounded-none lg:rounded-uva-lg"
            />
          </div>

          <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-0">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
              <div className="min-w-0">
                <p className="m-0 font-mono text-uva-detalle text-uva-text-muted">{ubicacionDeLaClase(data)}</p>
                <h1 className="m-0 mt-1.5 text-uva-titulo-3 text-balance text-uva-text lg:text-uva-titulo-4">
                  {data.leccionTitulo}
                </h1>
              </div>
              <Navegacion
                data={data}
                conSesion={conSesion}
                rutaClase={rutaClase}
                rutaExamen={rutaExamen}
                notaSiguienteId={notaSiguienteId}
              />
            </div>

            {sesion && data.videoListo && (
              <div className="flex flex-col gap-0.5">
                <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-3 text-uva-detalle font-semibold text-uva-text">
                  <input
                    type="checkbox"
                    checked={completada}
                    onChange={alternarVista}
                    aria-describedby={notaVistaId}
                    className="size-5 shrink-0 cursor-pointer accent-uva-btn"
                  />
                  Marcar esta clase como vista
                </label>
                <p id={notaVistaId} className="m-0 text-uva-detalle text-uva-text-muted">
                  También se marca sola al terminar el video.
                </p>
                {errorVista && (
                  <p role="alert" className="m-0 mt-1 text-uva-detalle text-uva-error-text">
                    {errorVista}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="px-4 sm:px-6 lg:hidden">
            {sesion ? (
              <TarjetaProgreso
                porcentaje={porcentaje}
                completadas={completadas}
                total={data.clasesConVideo}
                sigue={sigue}
                onTemario={abrirTemario}
              />
            ) : (
              <ClaseGratis data={data} rutaEntrar={rutaEntrar} sigue={sigue} onTemario={abrirTemario} />
            )}
          </div>

          <Pestanas
            pestana={pestana}
            onPestana={setPestana}
            totalRecursos={data.recursos.length}
            totalNotas={sesion ? totalNotas : undefined}
            totalComentarios={comentariosNoDisponibles ? null : totalComentarios}
          />

          <div className="px-4 sm:px-6 lg:px-0">
            <section
              id="clase-panel-resumen"
              role="tabpanel"
              aria-labelledby="clase-pestana-resumen"
              hidden={pestana !== "resumen"}
            >
              {data.contenido?.content?.length ? (
                <RichTextRenderer contenido={data.contenido} escala="lectura" />
              ) : (
                <p className="m-0 text-uva-cuerpo text-uva-text-muted">
                  El instructor todavía no publicó el resumen de esta clase.
                </p>
              )}
            </section>
            <section
              id="clase-panel-recursos"
              role="tabpanel"
              aria-labelledby="clase-pestana-recursos"
              hidden={pestana !== "recursos"}
            >
              <Recursos recursos={data.recursos} rutaEntrar={sesion ? null : rutaEntrar} />
            </section>
            {sesion && (
              <section
                id="clase-panel-notas"
                role="tabpanel"
                aria-labelledby="clase-pestana-notas"
                hidden={pestana !== "notas"}
                className="lg:hidden"
              >
                {!escritorio && pestana === "notas" && notasNodo}
              </section>
            )}
            <section
              id="clase-panel-comentarios"
              role="tabpanel"
              aria-labelledby="clase-pestana-comentarios"
              hidden={pestana !== "comentarios"}
              className="lg:hidden"
            >
              {comentariosNodo}
            </section>
          </div>
        </div>

        <aside
          aria-label={sesion ? "Progreso, notas y comentarios" : "Clase gratis y comentarios"}
          className="hidden flex-col gap-5 border-l border-uva-divider px-7 pt-7 pb-12 lg:flex"
        >
          {sesion ? (
            <TarjetaProgreso
              porcentaje={porcentaje}
              completadas={completadas}
              total={data.clasesConVideo}
              sigue={sigue}
              onTemario={abrirTemario}
            />
          ) : (
            <ClaseGratis data={data} rutaEntrar={rutaEntrar} sigue={sigue} onTemario={abrirTemario} />
          )}
          <section
            aria-labelledby={sesion ? undefined : "clase-comentarios-titulo"}
            aria-label={sesion ? "Notas y comentarios" : undefined}
            className="flex flex-col gap-4 rounded-uva-lg border border-uva-divider bg-uva-surface px-6 pt-4 pb-3"
          >
            {sesion ? (
              <div
                role="group"
                aria-label="Ver notas o comentarios"
                className="flex flex-wrap gap-1.5 border-b border-uva-divider pb-3.5"
              >
                <Pildora activa={panel === "notas"} onClick={() => setPanel("notas")} total={totalNotas}>
                  Notas
                </Pildora>
                <Pildora
                  activa={panel === "comentarios"}
                  onClick={() => setPanel("comentarios")}
                  total={comentariosNoDisponibles ? null : totalComentarios}
                >
                  Comentarios
                </Pildora>
              </div>
            ) : (
              <h2
                id="clase-comentarios-titulo"
                className="m-0 flex items-baseline gap-2 pt-1 text-uva-titulo-4 text-uva-text"
              >
                Comentarios
                {!comentariosNoDisponibles && totalComentarios > 0 && (
                  <span className="font-mono text-uva-detalle font-medium text-uva-text-muted">{totalComentarios}</span>
                )}
              </h2>
            )}
            {sesion && panel === "notas" ? escritorio && notasNodo : comentariosNodo}
          </section>
        </aside>
      </div>

      <TemarioDrawer
        abierto={temarioAbierto}
        onCerrar={() => setTemarioAbierto(false)}
        lecciones={
          sesion
            ? data.lecciones.map((leccion) => ({
                ...leccion,
                completado: completadoPorLeccion.get(leccion.id) ?? false,
              }))
            : data.lecciones
        }
        leccionActualId={data.leccionId}
        completadas={completadas}
        total={sesion ? data.clasesConVideo : data.totalClases}
        porcentaje={porcentaje}
        onIrALeccion={irALeccion}
        sinSesion={sesion ? undefined : { nota: `Esta clase es gratis. ${notaDeAcceso(data.totalClases - 1)}` }}
      />
    </div>
  );
}

/** "Módulo 01, clase 1 de 3": la posición dentro de su módulo, como el diseño. */
function ubicacionDeLaClase(data: LeccionPlayer): string {
  const actual = data.lecciones.find((leccion) => leccion.id === data.leccionId);
  if (!actual) return `Clase ${data.numero} de ${data.totalClases}`;
  const modulos = [...new Set(data.lecciones.map((leccion) => leccion.moduloId))];
  const delModulo = data.lecciones.filter((leccion) => leccion.moduloId === actual.moduloId);
  const modulo = String(modulos.indexOf(actual.moduloId) + 1).padStart(2, "0");
  return `Módulo ${modulo}, clase ${delModulo.indexOf(actual) + 1} de ${delModulo.length}`;
}

/** Qué se abre con la cuenta: mismo texto en la tarjeta y en el temario. */
function notaDeAcceso(restantes: number): string {
  const como = PRECIOS_HABILITADOS ? "con tu suscripción" : "con tu código de invitación";
  return restantes === 1
    ? `La otra clase del curso se abre ${como}.`
    : `Las otras ${restantes} clases del curso se abren ${como}.`;
}

/**
 * Anterior / Siguiente clase. En la última clase de un curso con examen,
 * "Siguiente clase" pasa a "Hacer examen". Sin sesión no hay Anterior (solo
 * se ve la primera clase) y Siguiente lleva candado.
 */
function Navegacion({
  data,
  conSesion,
  rutaClase,
  rutaExamen,
  notaSiguienteId,
}: {
  data: LeccionPlayer;
  conSesion: boolean;
  rutaClase: (slug: string) => string;
  rutaExamen: string;
  notaSiguienteId: string;
}) {
  const siguiente = data.siguienteSlug
    ? data.lecciones.find((leccion) => leccion.slug === data.siguienteSlug) ?? null
    : null;
  const anterior = conSesion && data.anteriorSlug ? data.anteriorSlug : null;
  const examen = conSesion && !siguiente && data.examenDisponible;
  if (!siguiente && !anterior && !examen) return null;

  return (
    <div className="flex shrink-0 flex-col gap-1.5 lg:items-end">
      <div className="flex gap-2.5">
        {anterior && (
          <Link href={rutaClase(anterior)} className={cn(BOTON_SECUNDARIO, "min-h-12 flex-1 px-4 lg:flex-none")}>
            <ChevronLeft className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
            Anterior
          </Link>
        )}
        {siguiente?.slug && (
          <Link
            href={rutaClase(siguiente.slug)}
            aria-describedby={conSesion ? undefined : notaSiguienteId}
            className={cn(BOTON_PRIMARIO, "flex-[1.4] lg:flex-none")}
          >
            {!conSesion && <Lock className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />}
            Siguiente clase
            <ChevronRight className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
          </Link>
        )}
        {examen && (
          <Link href={rutaExamen} className={cn(BOTON_PRIMARIO, "flex-[1.4] lg:flex-none")}>
            Hacer examen
            <FileCheck className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
          </Link>
        )}
      </div>
      {!conSesion && siguiente && (
        <p id={notaSiguienteId} className="m-0 text-center text-uva-detalle text-uva-text-muted lg:text-right">
          Entra para seguir con la clase {siguiente.numero}.
        </p>
      )}
    </div>
  );
}

/** Línea "Sigue:" de las tarjetas laterales. */
function Sigue({ sigue, conCandado }: { sigue: { titulo: string; href: string }; conCandado: boolean }) {
  return (
    <p className="m-0 mt-3.5 text-uva-detalle text-uva-text-muted">
      {conCandado && <Lock className="mr-1.5 inline size-4 align-[-0.15em]" strokeWidth={2} aria-hidden />}
      Sigue:{" "}
      <Link href={sigue.href} className="font-semibold text-uva-text underline-offset-4 hover:underline">
        {sigue.titulo}
        {conCandado && <span className="sr-only">, pide entrar a tu cuenta</span>}
      </Link>
    </p>
  );
}

/** Avance del curso (con sesión): solo cuentan las clases con video, como el certificado. */
function TarjetaProgreso({
  porcentaje,
  completadas,
  total,
  sigue,
  onTemario,
}: {
  porcentaje: number;
  completadas: number;
  total: number;
  sigue: { titulo: string; href: string } | null;
  onTemario: () => void;
}) {
  const tituloId = useId();
  return (
    <section
      aria-labelledby={tituloId}
      className="rounded-uva-lg border border-uva-divider bg-uva-surface p-4.5 lg:px-6 lg:py-5.5"
    >
      <div className="flex items-center justify-between gap-3">
        {/* "Progreso" en la columna lateral, como el diseño; en celular la
            tarjeta va sola bajo el título y dice de qué es el avance. */}
        <h2 id={tituloId} className="m-0 text-uva-titulo-4 text-uva-text">
          Progreso<span className="lg:hidden"> del curso</span>
        </h2>
        <button
          type="button"
          onClick={onTemario}
          className={cn(BOTON_SECUNDARIO, "hidden shrink-0 cursor-pointer bg-transparent lg:inline-flex")}
        >
          <List className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
          Temario
        </button>
      </div>
      {total === 0 ? (
        // Sin clases con video no hay avance que medir: "0 de 0" no dice nada.
        <p className="m-0 mt-2 text-uva-detalle text-uva-text-muted">
          Tu avance aparece aquí cuando las clases del curso tengan su video.
        </p>
      ) : (
        <>
          <p className="m-0 mt-3 flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-uva-titulo-4 font-extrabold text-uva-text">{porcentaje} %</span>
            <span className="text-uva-detalle text-uva-text-muted">
              completado, {completadas} de {total} {total === 1 ? "clase" : "clases"}
            </span>
          </p>
          <div
            role="progressbar"
            aria-label="Avance del curso"
            aria-valuenow={porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-3 h-2 overflow-hidden rounded-full bg-uva-divider"
          >
            <div
              className="h-full rounded-full bg-uva-btn transition-[width] duration-200 ease-out motion-reduce:transition-none"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        </>
      )}
      {sigue && <Sigue sigue={sigue} conCandado={false} />}
    </section>
  );
}

/** Ocupa el lugar de "Progreso" sin sesión: sin cuenta no hay avance. */
function ClaseGratis({
  data,
  rutaEntrar,
  sigue,
  onTemario,
}: {
  data: LeccionPlayer;
  rutaEntrar: string;
  sigue: { titulo: string; href: string } | null;
  onTemario: () => void;
}) {
  const tituloId = useId();
  const restantes = data.totalClases - 1;

  return (
    <section
      aria-labelledby={tituloId}
      className="rounded-uva-lg border border-uva-divider bg-uva-surface p-4.5 lg:px-6 lg:py-5.5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={tituloId} className="m-0 text-uva-titulo-4 text-uva-text">
          Clase gratis
        </h2>
        <button
          type="button"
          onClick={onTemario}
          className={cn(BOTON_SECUNDARIO, "hidden shrink-0 cursor-pointer bg-transparent lg:inline-flex")}
        >
          <List className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
          Temario
        </button>
      </div>
      {restantes > 0 && (
        <p className="m-0 mt-2 text-uva-detalle text-uva-text-muted">{notaDeAcceso(restantes)}</p>
      )}
      <Link href={rutaEntrar} className={cn(BOTON_PRIMARIO, "mt-4 w-full")}>
        Entra o crea tu cuenta
      </Link>
      {sigue && <Sigue sigue={sigue} conCandado />}
    </section>
  );
}

/** Selector Notas / Comentarios de la columna lateral (escritorio, con sesión). */
function Pildora({
  activa,
  onClick,
  total,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  total: number | null;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center rounded-full border-0 px-4.5 text-uva-detalle",
        activa
          ? "bg-uva-btn font-bold text-uva-on-accent"
          : "bg-transparent font-semibold text-uva-text-muted hover:text-uva-text",
      )}
    >
      <span className="inline-flex items-baseline gap-1.5">
        {children}
        {total !== null && total > 0 && (
          <span className={cn("font-mono", activa ? "text-uva-on-accent" : "text-uva-text-muted")}>{total}</span>
        )}
      </span>
    </button>
  );
}

/**
 * Pestañas de la clase (patrón de pestañas WAI-ARIA: flechas, Inicio y Fin).
 * Notas y Comentarios solo existen en celular; en escritorio van en la
 * lateral. Las flechas saltan las pestañas ocultas por CSS.
 */
function Pestanas({
  pestana,
  onPestana,
  totalRecursos,
  totalNotas,
  totalComentarios,
}: {
  pestana: Pestana;
  onPestana: (pestana: Pestana) => void;
  totalRecursos: number;
  /** `undefined`: sin sesión no hay pestaña de notas. `null`: no se pudieron leer. */
  totalNotas: number | null | undefined;
  /** null: no se pudieron leer, no se muestra un 0 engañoso. */
  totalComentarios: number | null;
}) {
  const listaRef = useRef<HTMLDivElement>(null);
  const pestanas: { id: Pestana; etiqueta: string; total: number | null; soloCelular?: boolean }[] = [
    { id: "resumen", etiqueta: "Resumen", total: null },
    { id: "recursos", etiqueta: "Recursos", total: totalRecursos },
    ...(totalNotas !== undefined
      ? [{ id: "notas" as const, etiqueta: "Notas", total: totalNotas, soloCelular: true }]
      : []),
    { id: "comentarios", etiqueta: "Comentarios", total: totalComentarios, soloCelular: true },
  ];

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    const visibles = [...(listaRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])].filter(
      (boton) => boton.offsetParent !== null,
    );
    const actual = visibles.findIndex((boton) => boton === document.activeElement);
    if (actual === -1) return;
    const destino = {
      ArrowRight: (actual + 1) % visibles.length,
      ArrowLeft: (actual - 1 + visibles.length) % visibles.length,
      Home: 0,
      End: visibles.length - 1,
    }[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    visibles[destino].focus();
    onPestana(visibles[destino].dataset.pestana as Pestana);
  }

  return (
    <div
      ref={listaRef}
      role="tablist"
      aria-label="Secciones de la clase"
      onKeyDown={alTeclear}
      // La raya de abajo es una sombra interior y no un borde: así la fila
      // puede desplazarse sola (cifras muy largas a 320 px) sin cortar el
      // subrayado de la pestaña elegida ni empujar la página de lado.
      className="mx-4 flex justify-between gap-2 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-uva-divider)] [scrollbar-width:none] sm:mx-6 sm:justify-start sm:gap-7 lg:mx-0 [&::-webkit-scrollbar]:hidden"
    >
      {pestanas.map(({ id, etiqueta, total, soloCelular }) => {
        const elegida = pestana === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`clase-pestana-${id}`}
            data-pestana={id}
            aria-selected={elegida}
            aria-controls={`clase-panel-${id}`}
            tabIndex={elegida ? 0 : -1}
            onClick={() => onPestana(id)}
            className={cn(
              "flex min-h-12 shrink-0 cursor-pointer items-center border-0 border-b-[2.5px] bg-transparent px-0.5 text-uva-detalle whitespace-nowrap",
              elegida
                ? "border-uva-btn font-bold text-uva-text"
                : "border-transparent font-medium text-uva-text-muted hover:text-uva-text",
              soloCelular && "lg:hidden",
            )}
          >
            {/* Etiqueta y cifra en su propia fila de línea base: con el
                centrado del botón, la cifra quedaba alzada. */}
            <span className="inline-flex items-baseline gap-1.5">
              {etiqueta}
              {total !== null && total > 0 && (
                <span className="font-mono font-medium text-uva-text-muted">{total}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Material de la clase. Con sesión cada clic pide un enlace firmado de un
 * solo uso (`obtenerUrlRecurso`: RLS confirma el acceso antes de firmar). Sin
 * sesión (`rutaEntrar`) se ve la lista, pero descargar lleva a entrar.
 */
function Recursos({ recursos, rutaEntrar }: { recursos: RecursoLeccion[]; rutaEntrar: string | null }) {
  const [descargando, setDescargando] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function descargar(recurso: RecursoLeccion) {
    setErrorId(null);
    setDescargando(recurso.id);
    const resultado = await obtenerUrlRecurso(recurso.id);
    setDescargando(null);
    if ("error" in resultado) {
      setErrorId(recurso.id);
      return;
    }
    window.open(resultado.url, "_blank", "noopener,noreferrer");
  }

  if (recursos.length === 0) {
    return (
      <p className="m-0 text-uva-cuerpo text-uva-text-muted">Esta clase todavía no tiene material para descargar.</p>
    );
  }

  const boton =
    "grid size-11 shrink-0 cursor-pointer place-items-center rounded-uva-md border-[1.5px] border-uva-line-strong bg-transparent text-uva-text hover:border-uva-text disabled:cursor-wait disabled:opacity-70";

  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 text-uva-detalle text-uva-text-muted">
        {rutaEntrar
          ? "Material que el instructor dejó para esta clase. Para descargarlo, entra a tu cuenta."
          : "Material que el instructor dejó para esta clase."}
      </p>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {recursos.map((recurso) => {
          const extension = extensionArchivo(recurso.nombre);
          const tamano = formatTamanoArchivo(recurso.tamanoBytes);
          return (
            <li
              key={recurso.id}
              className="flex items-center gap-3 rounded-uva-md border border-uva-divider bg-uva-surface p-3"
            >
              <span
                aria-hidden
                className={cn(
                  "grid h-10.5 min-w-10.5 shrink-0 place-items-center rounded-uva-sm px-1 font-mono text-uva-detalle font-extrabold",
                  colorDeArchivo(extension),
                )}
              >
                {extension.slice(0, 4)}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-uva-detalle font-bold text-uva-text">{recurso.nombre}</b>
                {errorId === recurso.id ? (
                  <small role="alert" className="block text-uva-detalle text-uva-error-text">
                    No pudimos generar el enlace. Intenta de nuevo.
                  </small>
                ) : (
                  tamano && <small className="block text-uva-detalle text-uva-text-muted">{tamano}</small>
                )}
              </span>
              {rutaEntrar ? (
                <Link href={rutaEntrar} aria-label={`Entra para descargar ${recurso.nombre}`} className={boton}>
                  <Download className="size-5" strokeWidth={2} aria-hidden />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => descargar(recurso)}
                  disabled={descargando === recurso.id}
                  aria-label={`Descargar ${recurso.nombre}`}
                  className={boton}
                >
                  {descargando === recurso.id ? (
                    <Loader2 className="size-5 animate-spin" strokeWidth={2} aria-hidden />
                  ) : (
                    <Download className="size-5" strokeWidth={2} aria-hidden />
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Hojas de cálculo en amarillo y PDF en magenta, con el contraste de cada tema. */
function colorDeArchivo(extension: string): string {
  if (["XLS", "XLSX", "CSV", "ODS"].includes(extension)) return "bg-uva-success-soft text-uva-success-text";
  if (extension === "PDF") return "bg-uva-danger-soft text-uva-danger-text";
  return "bg-uva-chip text-uva-text";
}

