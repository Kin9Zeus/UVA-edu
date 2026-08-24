"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { InfoTab } from "@/components/admin/cursos/InfoTab";
import { ContenidoTab } from "@/components/admin/cursos/ContenidoTab";
import { EstudiantesTab } from "@/components/admin/cursos/EstudiantesTab";
import { ConfiguracionTab } from "@/components/admin/cursos/ConfiguracionTab";
import { useAdminToast } from "@/components/admin/Toast";
import { actualizarInfoCurso, actualizarConfiguracionCurso, type NivelCurso } from "@/actions/admin/cursos";
import { esPortadaReal } from "@/lib/media";
import type { CursoDetalle } from "@/lib/admin/cursoDetalle";

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
}: {
  curso: CursoDetalle;
  categorias: { id: string; nombre: string }[];
}) {
  const [titulo, setTitulo] = useState(curso.titulo);
  const [imagenPortada, setImagenPortada] = useState(curso.imagenPortada);
  const [descripcion, setDescripcion] = useState(curso.descripcion);
  const [categoriaId, setCategoriaId] = useState(curso.categoriaId);
  const [nivel, setNivel] = useState<NivelCurso>(curso.nivel);
  const [mostrado, setMostrado] = useState(curso.mostrado);
  const [destacado, setDestacado] = useState(curso.destacado);
  const [orden, setOrden] = useState(curso.ordenVisualizacion);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [errorConfig, setErrorConfig] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showToast = useAdminToast();

  const categoria = categorias.find((item) => item.id === categoriaId)?.nombre ?? "Sin categoría";

  async function handleGuardar() {
    setPending(true);
    setErrorInfo(null);
    setErrorConfig(null);

    const [resultadoInfo, resultadoConfig] = await Promise.all([
      actualizarInfoCurso(curso.id, { titulo, descripcion, categoriaId, nivel }),
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
      <div className="flex flex-wrap items-center gap-4">
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
        <StatusBadge tone={mostrado ? "success" : "neutral"}>
          {mostrado ? "Publicado" : "Borrador"}
        </StatusBadge>
        <Button type="button" variant="primary" size="sm" disabled={pending} onClick={handleGuardar}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
        <div className="ml-auto text-[13px] text-uva-muted">
          {curso.estudiantes.length} {curso.estudiantes.length === 1 ? "estudiante" : "estudiantes"}
        </div>
      </div>

      <Tabs defaultValue="informacion">
        <TabsList>
          <TabsTrigger value="informacion">Información</TabsTrigger>
          <TabsTrigger value="contenido">Contenido</TabsTrigger>
          <TabsTrigger value="estudiantes">Estudiantes</TabsTrigger>
          <TabsTrigger value="configuracion">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="informacion" className="pt-[18px]">
          <InfoTab
            cursoId={curso.id}
            titulo={titulo}
            onTituloChange={setTitulo}
            imagenPortada={imagenPortada}
            onImagenPortadaChange={setImagenPortada}
            descripcion={descripcion}
            onDescripcionChange={setDescripcion}
            categoriaId={categoriaId}
            onCategoriaIdChange={setCategoriaId}
            nivel={nivel}
            onNivelChange={setNivel}
            categorias={categorias}
            error={errorInfo}
          />
        </TabsContent>
        <TabsContent value="contenido" className="pt-[18px]">
          <ContenidoTab
            key={curso.modulos.map((modulo) => `${modulo.id}:${modulo.lecciones.map((l) => l.id).join(",")}`).join("|")}
            cursoId={curso.id}
            modulosIniciales={curso.modulos}
          />
        </TabsContent>
        <TabsContent value="estudiantes" className="pt-[18px]">
          <EstudiantesTab estudiantes={curso.estudiantes} />
        </TabsContent>
        <TabsContent value="configuracion" className="pt-[18px]">
          <ConfiguracionTab
            mostrado={mostrado}
            onMostradoChange={setMostrado}
            destacado={destacado}
            onDestacadoChange={setDestacado}
            orden={orden}
            onOrdenChange={setOrden}
            error={errorConfig}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
