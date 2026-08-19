"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon } from "lucide-react";
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
import { crearCurso, type NivelCurso } from "@/actions/admin/cursos";
import { useAdminToast } from "@/components/admin/Toast";

const NIVEL_ITEMS = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" };

export function CrearCursoForm({
  categorias,
  instructoresSugeridos,
}: {
  categorias: { id: string; nombre: string }[];
  instructoresSugeridos: string[];
}) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [nivel, setNivel] = useState<NivelCurso>("BASICO");
  const [instructor, setInstructor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"borrador" | "publicar" | null>(null);
  const router = useRouter();
  const showToast = useAdminToast();

  const categoriaItems = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c.id, c.nombre])),
    [categorias],
  );

  async function handleGuardar(publicar: boolean) {
    setPending(publicar ? "publicar" : "borrador");
    setError(null);

    const resultado = await crearCurso({
      titulo,
      descripcion,
      categoriaId,
      nivel,
      instructor,
      publicar,
    });

    setPending(null);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }

    showToast(publicar ? "Curso publicado." : "Curso guardado como borrador.");
    router.push(`/admin/cursos/${resultado.id}`);
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
          <Label htmlFor="curso-titulo">Nombre del curso</Label>
          <Input
            id="curso-titulo"
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            placeholder="Fundamentos de presupuesto de obra"
            required
          />
        </div>

        <div>
          <Label htmlFor="curso-descripcion">Descripción</Label>
          <Textarea
            id="curso-descripcion"
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            rows={4}
            placeholder="De qué trata el curso y qué aprenderá el estudiante"
          />
        </div>

        <div>
          <Label>Imagen de portada</Label>
          <div
            className="flex h-36 items-center justify-center rounded-uva-md border border-dashed border-uva-divider text-uva-text-faint"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--uva-surface-soft) 0 10px, var(--uva-surface) 10px 20px)",
            }}
          >
            <div className="flex flex-col items-center gap-1.5 text-xs">
              <ImageIcon className="size-5" strokeWidth={1.9} />
              Arrastra una imagen o haz clic para subirla
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="curso-categoria">Categoría</Label>
            <Select
              items={categoriaItems}
              value={categoriaId}
              onValueChange={(value) => setCategoriaId(value ?? "")}
            >
              <SelectTrigger id="curso-categoria" className="w-full"><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
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
            <Label htmlFor="curso-nivel">Nivel</Label>
            <Select
              items={NIVEL_ITEMS}
              value={nivel}
              onValueChange={(value) => value && setNivel(value as NivelCurso)}
            >
              <SelectTrigger id="curso-nivel" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BASICO">Básico</SelectItem>
                <SelectItem value="INTERMEDIO">Intermedio</SelectItem>
                <SelectItem value="AVANZADO">Avanzado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="curso-instructor">Instructor</Label>
          <Input
            id="curso-instructor"
            list="instructores-sugeridos"
            value={instructor}
            onChange={(event) => setInstructor(event.target.value)}
            placeholder="Nombre del instructor"
            required
          />
          <datalist id="instructores-sugeridos">
            {instructoresSugeridos.map((nombre) => (
              <option key={nombre} value={nombre} />
            ))}
          </datalist>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" disabled={pending !== null} onClick={() => handleGuardar(false)}>
            {pending === "borrador" ? "Guardando…" : "Guardar como borrador"}
          </Button>
          <Button type="button" disabled={pending !== null} onClick={() => handleGuardar(true)}>
            {pending === "publicar" ? "Publicando…" : "Publicar curso"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
