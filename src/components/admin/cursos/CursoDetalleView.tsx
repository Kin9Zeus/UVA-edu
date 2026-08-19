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

export function CursoDetalleView({
  curso,
  categorias,
}: {
  curso: CursoDetalle;
  categorias: { id: string; nombre: string }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/cursos" className="flex w-fit items-center gap-1.5 text-sm text-uva-text-faint hover:text-uva-text">
          <ArrowLeft className="size-4" />
          Volver a cursos
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl text-uva-text">{curso.titulo}</h1>
          <StatusBadge tone={curso.mostrado ? "success" : "neutral"}>
            {curso.mostrado ? "Publicado" : "Borrador"}
          </StatusBadge>
        </div>
      </div>

      <Tabs defaultValue="informacion">
        <TabsList>
          <TabsTrigger value="informacion">Información</TabsTrigger>
          <TabsTrigger value="contenido">Contenido</TabsTrigger>
          <TabsTrigger value="estudiantes">Estudiantes</TabsTrigger>
          <TabsTrigger value="configuracion">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="informacion" className="pt-4">
          <InfoTab curso={curso} categorias={categorias} />
        </TabsContent>
        <TabsContent value="contenido" className="pt-4">
          <ContenidoTab
            key={curso.modulos.map((modulo) => `${modulo.id}:${modulo.lecciones.map((l) => l.id).join(",")}`).join("|")}
            cursoId={curso.id}
            modulosIniciales={curso.modulos}
          />
        </TabsContent>
        <TabsContent value="estudiantes" className="pt-4">
          <EstudiantesTab estudiantes={curso.estudiantes} />
        </TabsContent>
        <TabsContent value="configuracion" className="pt-4">
          <ConfiguracionTab curso={curso} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
