"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actualizarInfoCurso, type NivelCurso } from "@/actions/admin/cursos";
import { useAdminToast } from "@/components/admin/Toast";
import type { CursoDetalle } from "@/lib/admin/cursoDetalle";

const NIVEL_ITEMS = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" };

export function InfoTab({
  curso,
  categorias,
}: {
  curso: CursoDetalle;
  categorias: { id: string; nombre: string }[];
}) {
  const [titulo, setTitulo] = useState(curso.titulo);
  const [descripcion, setDescripcion] = useState(curso.descripcion);
  const [categoriaId, setCategoriaId] = useState(curso.categoriaId);
  const [nivel, setNivel] = useState<NivelCurso>(curso.nivel);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showToast = useAdminToast();

  const categoriaItems = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c.id, c.nombre])),
    [categorias],
  );

  async function handleGuardar() {
    setPending(true);
    setError(null);
    const resultado = await actualizarInfoCurso(curso.id, { titulo, descripcion, categoriaId, nivel });
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    showToast("Información del curso guardada.");
  }

  return (
    <Card className="max-w-[720px]">
      <CardContent className="flex flex-col gap-5">
        {error && (
          <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="info-titulo">Nombre del curso</Label>
          <Input id="info-titulo" value={titulo} onChange={(event) => setTitulo(event.target.value)} />
        </div>

        <div>
          <Label htmlFor="info-descripcion">Descripción</Label>
          <Textarea
            id="info-descripcion"
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            rows={5}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="info-categoria">Categoría</Label>
            <Select
              items={categoriaItems}
              value={categoriaId}
              onValueChange={(value) => setCategoriaId(value ?? "")}
            >
              <SelectTrigger id="info-categoria" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categorias.map((categoria) => (
                  <SelectItem key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="info-nivel">Nivel</Label>
            <Select
              items={NIVEL_ITEMS}
              value={nivel}
              onValueChange={(value) => value && setNivel(value as NivelCurso)}
            >
              <SelectTrigger id="info-nivel" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BASICO">Básico</SelectItem>
                <SelectItem value="INTERMEDIO">Intermedio</SelectItem>
                <SelectItem value="AVANZADO">Avanzado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Button type="button" disabled={pending} onClick={handleGuardar} className="w-auto">
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
