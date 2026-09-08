"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { InfoTab } from "@/components/admin/cursos/InfoTab";
import { ContenidoTab } from "@/components/admin/cursos/ContenidoTab";
import { ExamenTab } from "@/components/admin/cursos/ExamenTab";
import { EstudiantesTab } from "@/components/admin/cursos/EstudiantesTab";
import { ConfiguracionTab } from "@/components/admin/cursos/ConfiguracionTab";
import { useAdminToast } from "@/components/admin/Toast";
import { actualizarInfoCurso, actualizarConfiguracionCurso, type NivelCurso } from "@/actions/admin/cursos";
import { esPortadaReal } from "@/lib/media";
import { motivosParaNoPublicar } from "@/lib/admin/publicacion";
import { useAvisoNavegacionSinGuardar } from "@/lib/admin/useAvisoNavegacionSinGuardar";
import type { CursoDetalle } from "@/lib/admin/cursoDetalle";
import type { ExamenDetalle } from "@/lib/admin/examenDetalle";

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

/**
 * Información y Configuración comparten un solo botón "Guardar cambios" en
 * la cabecera (a la derecha del badge de estado), visible sin importar qué
 * pestaña esté activa — así no hay que volver a Información para guardar si
 * ya te moviste a Contenido/Estudiantes. Por eso el estado de ambos
 * formularios vive acá y no en cada tab (que quedan controlados).
 */
export function CursoDetalleView({
  curso,
  categorias,
  instructores,
  examen,
}: {
  curso: CursoDetalle;
  categorias: { id: string; nombre: string; activo?: boolean }[];
  /** Cuentas con rol PROFESOR disponibles para asignar (getPerfilesProfesor). */
  instructores: { id: string; nombre: string }[];
  /** `null` si el curso no tiene examen final: es el caso normal, no un
   * estado incompleto — ver el comentario de ExamenTab. */
  examen: ExamenDetalle | null;
}) {
  const [titulo, setTitulo] = useState(curso.titulo);
  const [imagenPortada, setImagenPortada] = useState(curso.imagenPortada);
  const [descripcion, setDescripcion] = useState(curso.descripcion);
  const [categoriaIds, setCategoriaIds] = useState(curso.categoriaIds);
  const [idsInstructores, setIdsInstructores] = useState(curso.instructorIds);
  const [nivel, setNivel] = useState<NivelCurso>(curso.nivel);
  const [mostrado, setMostrado] = useState(curso.mostrado);
  const [destacado, setDestacado] = useState(curso.destacado);
  const [orden, setOrden] = useState(curso.ordenVisualizacion);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [errorConfig, setErrorConfig] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Reportado por ContenidoTab: una lección con título/duración/resumen sin
  // guardar también debe bloquear salir de esta pantalla, no solo cambiar
  // de lección dentro de la pestaña.
  const [contenidoSinGuardar, setContenidoSinGuardar] = useState(false);
  // Igual que `contenidoSinGuardar`, pero reportado por ExamenTab: una
  // pregunta a medio editar también tiene que bloquear la salida.
  const [examenSinGuardar, setExamenSinGuardar] = useState(false);
  const showToast = useAdminToast();

  // Las 5 etiquetas de pestaña ya no caben en el ancho de un teléfono
  // angosto — este scroll + degradado es la red de seguridad (mismo patrón
  // que los filtros de /admin/cursos) para cuando no alcanzan.
  const tabsRef = useRef<HTMLDivElement>(null);
  const [hayMasTabs, setHayMasTabs] = useState(false);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    function actualizar() {
      if (!el) return;
      setHayMasTabs(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
    }
    actualizar();
    el.addEventListener("scroll", actualizar);
    window.addEventListener("resize", actualizar);
    return () => {
      el.removeEventListener("scroll", actualizar);
      window.removeEventListener("resize", actualizar);
    };
  }, []);

  // Lo último guardado en el servidor, para saber si "Guardar cambios" está
  // pendiente. La portada no entra acá: se guarda sola al confirmarla en
  // InfoTab, no espera al botón compartido.
  const [guardadoComo, setGuardadoComo] = useState({
    titulo: curso.titulo,
    descripcion: curso.descripcion,
    categoriaIds: curso.categoriaIds,
    idsInstructores: curso.instructorIds,
    nivel: curso.nivel,
    mostrado: curso.mostrado,
    destacado: curso.destacado,
    orden: curso.ordenVisualizacion,
  });

  const sinGuardar =
    titulo !== guardadoComo.titulo ||
    descripcion !== guardadoComo.descripcion ||
    nivel !== guardadoComo.nivel ||
    mostrado !== guardadoComo.mostrado ||
    destacado !== guardadoComo.destacado ||
    orden !== guardadoComo.orden ||
    categoriaIds.length !== guardadoComo.categoriaIds.length ||
    categoriaIds.some((id) => !guardadoComo.categoriaIds.includes(id)) ||
    idsInstructores.length !== guardadoComo.idsInstructores.length ||
    idsInstructores.some((id) => !guardadoComo.idsInstructores.includes(id));

  const hayCambiosSinGuardar = sinGuardar || contenidoSinGuardar || examenSinGuardar;

  useEffect(() => {
    function avisar(event: BeforeUnloadEvent) {
      if (!hayCambiosSinGuardar) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayCambiosSinGuardar]);

  // Cubre lo que beforeunload no cubre: navegación interna (Volver a
  // cursos, menú lateral) vía <Link>, que no descarga la página. Devuelve el
  // diálogo de confirmación (propio de la app, no window.confirm()) — hay
  // que renderizarlo, ver el `return` de abajo.
  const dialogAvisoNavegacion = useAvisoNavegacionSinGuardar(hayCambiosSinGuardar);

  const handleContenidoDirtyChange = useCallback((dirty: boolean) => setContenidoSinGuardar(dirty), []);
  const handleExamenDirtyChange = useCallback((dirty: boolean) => setExamenSinGuardar(dirty), []);

  // Se recalcula con el título y la portada en vivo (los edita esta misma
  // pantalla) y con los módulos tal como vinieron del servidor: ContenidoTab
  // revalida la ruta al añadir contenido, así que llegan actualizados.
  // Es la misma regla que aplica el servidor en bloqueoDePublicacion().
  const motivosSinPublicar = motivosParaNoPublicar({
    titulo,
    imagenPortada,
    modulos: curso.modulos.map((modulo) => ({
      lecciones: modulo.lecciones.map((leccion) => ({
        estadoProcesamiento: leccion.estadoProcesamiento,
      })),
    })),
  });

  // La cabecera lista todas las categorías del curso separadas por coma
  // ("BIM, Gestión y Normativa · Básico").
  const categoria =
    categorias
      .filter((item) => categoriaIds.includes(item.id))
      .map((item) => item.nombre)
      .join(", ") || "Sin categoría";

  async function handleGuardar() {
    setPending(true);
    setErrorInfo(null);
    setErrorConfig(null);

    const [resultadoInfo, resultadoConfig] = await Promise.all([
      actualizarInfoCurso(curso.id, { titulo, descripcion, categoriaIds, nivel, idsInstructores }),
      actualizarConfiguracionCurso(curso.id, { mostrado, destacado, ordenVisualizacion: orden }),
    ]);
    setPending(false);

    let huboError = false;
    if (resultadoInfo.error) {
      setErrorInfo(resultadoInfo.error);
      huboError = true;
    }
    if (resultadoConfig.error) {
      setErrorConfig(resultadoConfig.error);
      huboError = true;
    }
    if (huboError) return;

    setGuardadoComo({
      titulo,
      descripcion,
      categoriaIds,
      idsInstructores,
      nivel,
      mostrado,
      destacado,
      orden,
    });
    showToast("Cambios guardados.");
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {/* El mockup no lleva este enlace; se conserva porque el panel real
          necesita una salida hacia el listado. */}
      <Link
        href="/admin/cursos"
        className="-mb-2 flex w-fit items-center gap-1.5 text-sm text-uva-muted-2 hover:text-uva-text"
      >
        <ArrowLeft className="size-4" />
        Volver a cursos
      </Link>

      {/* Cabecera del curso: miniatura, título con categoría · nivel, badge de
          estado, el botón de guardar (compartido entre Información y
          Configuración) y el conteo de estudiantes alineado a la derecha. */}
      {/* Dos grupos en vez de un solo `flex-wrap`: portada+título por un
          lado, badge+botón+contador por el otro. Un `flex-wrap` plano dejaba
          "Guardar cambios" solo en su línea y el contador de estudiantes
          huérfano pegado al borde derecho por el `ml-auto` — agrupados así,
          en mobile quedan juntos y en `sm+` el segundo grupo se estira
          (`sm:flex-1`) para que el `ml-auto` interno siga empujando el
          contador al borde derecho, igual que antes. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-4">
          {esPortadaReal(imagenPortada) ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen de Supabase Storage, no un asset local optimizable por next/image
            <img
              src={imagenPortada}
              alt=""
              className="aspect-video h-11 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="aspect-video h-11 shrink-0 rounded-lg bg-uva-surface-2"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(250,250,250,.05) 0 2px, transparent 2px 9px)",
              }}
            />
          )}
          <div>
            <h1 className="font-heading text-[19px] font-bold tracking-[-0.02em] text-uva-text">
              {titulo}
            </h1>
            <p className="mt-0.5 text-[12.5px] text-uva-muted">
              {categoria} · {NIVEL_LABEL[nivel]}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:flex-1">
          <StatusBadge tone={mostrado ? "success" : "neutral"}>
            {mostrado ? "Publicado" : "Borrador"}
          </StatusBadge>
          <Button type="button" variant="primary" size="sm" disabled={pending} onClick={handleGuardar}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
          <div className="text-[13px] text-uva-muted sm:ml-auto">
            {curso.estudiantes.length} {curso.estudiantes.length === 1 ? "estudiante" : "estudiantes"}
          </div>
        </div>
      </div>

      <Tabs defaultValue="informacion">
        <div className="relative">
          <TabsList ref={tabsRef} className="overflow-x-auto">
            <TabsTrigger value="informacion">Información</TabsTrigger>
            <TabsTrigger value="contenido">Contenido</TabsTrigger>
            <TabsTrigger value="examen">Examen</TabsTrigger>
            <TabsTrigger value="estudiantes">Estudiantes</TabsTrigger>
            <TabsTrigger value="configuracion">Configuración</TabsTrigger>
          </TabsList>
          {hayMasTabs && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-uva-bg to-transparent"
            />
          )}
        </div>

        <TabsContent value="informacion" className="pt-[18px]">
          <InfoTab
            cursoId={curso.id}
            titulo={titulo}
            onTituloChange={setTitulo}
            imagenPortada={imagenPortada}
            onImagenPortadaChange={setImagenPortada}
            descripcion={descripcion}
            onDescripcionChange={setDescripcion}
            categoriaIds={categoriaIds}
            onCategoriaIdsChange={setCategoriaIds}
            nivel={nivel}
            onNivelChange={setNivel}
            categorias={categorias}
            idsInstructores={idsInstructores}
            onIdsInstructoresChange={setIdsInstructores}
            instructores={instructores}
            error={errorInfo}
          />
        </TabsContent>
        <TabsContent value="contenido" className="pt-[18px]">
          <ContenidoTab
            key={curso.modulos.map((modulo) => `${modulo.id}:${modulo.lecciones.map((l) => l.id).join(",")}`).join("|")}
            cursoId={curso.id}
            modulosIniciales={curso.modulos}
            onDirtyChange={handleContenidoDirtyChange}
          />
        </TabsContent>
        <TabsContent value="examen" className="pt-[18px]">
          {/* La key remonta el tab cuando cambia el conjunto de preguntas:
              igual que ContenidoTab, el estado local de cada editor tiene que
              partir de los datos recién revalidados y no de los anteriores. */}
          <ExamenTab
            key={examen ? `${examen.id}:${examen.preguntas.map((p) => p.id).join(",")}` : "sin-examen"}
            cursoId={curso.id}
            examen={examen}
            onDirtyChange={handleExamenDirtyChange}
          />
        </TabsContent>
        <TabsContent value="estudiantes" className="pt-[18px]">
          <EstudiantesTab estudiantes={curso.estudiantes} />
        </TabsContent>
        <TabsContent value="configuracion" className="pt-[18px]">
          <ConfiguracionTab
            mostrado={mostrado}
            onMostradoChange={setMostrado}
            motivosSinPublicar={motivosSinPublicar}
            destacado={destacado}
            onDestacadoChange={setDestacado}
            orden={orden}
            onOrdenChange={setOrden}
            cursoId={curso.id}
            enlacesVistaPrevia={curso.enlacesVistaPrevia}
            error={errorConfig}
          />
        </TabsContent>
      </Tabs>

      {dialogAvisoNavegacion}
    </div>
  );
}
