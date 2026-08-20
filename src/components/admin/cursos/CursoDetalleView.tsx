"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { InfoTab } from "@/components/admin/cursos/InfoTab";
import { ContenidoTab } from "@/components/admin/cursos/ContenidoTab";
import { EstudiantesTab } from "@/components/admin/cursos/EstudiantesTab";
import { ConfiguracionTab } from "@/components/admin/cursos/ConfiguracionTab";
import type { CursoDetalle } from "@/lib/admin/cursoDetalle";

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

export function CursoDetalleView({
  curso,
  categorias,
}: {
  curso: CursoDetalle;
  categorias: { id: string; nombre: string }[];
}) {
  const categoria = categorias.find((item) => item.id === curso.categoriaId)?.nombre ?? "Sin categoría";

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
          estado y el conteo de estudiantes alineado a la derecha. */}
      <div className="flex flex-wrap items-center gap-4">
        <div
          aria-hidden
          className="h-11 w-16 shrink-0 rounded-lg bg-uva-surface-2"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(250,250,250,.05) 0 2px, transparent 2px 9px)",
          }}
        />
        <div>
          <h1 className="font-heading text-[19px] font-bold tracking-[-0.02em] text-uva-text">
            {curso.titulo}
          </h1>
          <p className="mt-0.5 text-[12.5px] text-uva-muted">
            {categoria} · {NIVEL_LABEL[curso.nivel]}
          </p>
        </div>
        <StatusBadge tone={curso.mostrado ? "success" : "neutral"}>
          {curso.mostrado ? "Publicado" : "Borrador"}
        </StatusBadge>
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
          <InfoTab curso={curso} categorias={categorias} />
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
          <ConfiguracionTab curso={curso} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
