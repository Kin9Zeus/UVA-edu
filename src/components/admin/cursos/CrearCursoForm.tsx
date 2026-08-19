"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Plus } from "lucide-react";
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
import { InstructorFormDialog } from "@/components/admin/instructores/InstructorFormDialog";

const NIVEL_ITEMS = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" };

export function CrearCursoForm({
  categorias,
  instructores: instructoresIniciales,
}: {
  categorias: { id: string; nombre: string }[];
  instructores: { id: string; nombre: string }[];
}) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [nivel, setNivel] = useState<NivelCurso>("BASICO");
  const [instructores, setInstructores] = useState(instructoresIniciales);
  const [idInstructor, setIdInstructor] = useState("");
  const [instructorDialogOpen, setInstructorDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"borrador" | "publicar" | null>(null);
  const router = useRouter();
  const showToast = useAdminToast();

  const categoriaItems = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c.id, c.nombre])),
    [categorias],
  );

  const instructorItems = useMemo(
    () => Object.fromEntries(instructores.map((i) => [i.id, i.nombre])),
    [instructores],
  );

  // El instructor recién creado se añade a la lista local y queda
  // seleccionado, para no perder lo que ya se llevaba escrito en el resto
  // del formulario mientras el Server Component se revalida.
  function handleInstructorCreado(id: string, nombre: string) {
    setInstructores((actuales) =>
      [...actuales, { id, nombre }].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
    setIdInstructor(id);
  }

  async function handleGuardar(publicar: boolean) {
    setPending(publicar ? "publicar" : "borrador");
    setError(null);

    const resultado = await crearCurso({
      titulo,
      descripcion,
      categoriaId,
      nivel,
      idInstructor,
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
          <div className="flex items-center gap-2">
            <Select
              items={instructorItems}
              value={idInstructor}
              onValueChange={(value) => setIdInstructor(value ?? "")}
            >
              <SelectTrigger id="curso-instructor" className="w-full">
                <SelectValue placeholder="Selecciona un instructor" />
              </SelectTrigger>
              <SelectContent>
                {instructores.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="w-auto shrink-0"
              onClick={() => setInstructorDialogOpen(true)}
            >
              <Plus className="size-4" />
              Nuevo
            </Button>
          </div>
          {instructores.length === 0 && (
            <p className="mt-1.5 text-xs text-uva-text-faint">
              Todavía no hay instructores. Crea el primero con el botón de al lado.
            </p>
          )}
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

      <InstructorFormDialog
        open={instructorDialogOpen}
        onOpenChange={setInstructorDialogOpen}
        onCreado={handleInstructorCreado}
      />
    </Card>
  );
}
