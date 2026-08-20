"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AdminCard } from "@/components/admin/AdminCard";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/Toast";
import { CategoriaFormDialog } from "@/components/admin/categorias/CategoriaFormDialog";
import { toggleActivaCategoria, eliminarCategoria } from "@/actions/admin/categorias";

export type Categoria = {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creadoPor: string;
  numeroCursos: number;
};

export function CategoriasTable({ categorias }: { categorias: Categoria[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [borrando, setBorrando] = useState<Categoria | null>(null);
  const showToast = useAdminToast();

  function abrirCrear() {
    setEditando(null);
    setFormOpen(true);
  }

  function abrirEditar(categoria: Categoria) {
    setEditando(categoria);
    setFormOpen(true);
  }

  async function handleToggle(categoria: Categoria, activo: boolean) {
    const resultado = await toggleActivaCategoria(categoria.id, activo);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(activo ? "Categoría activada." : "Categoría desactivada.");
  }

  async function handleEliminar() {
    if (!borrando) return;
    const resultado = await eliminarCategoria(borrando.id);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast("Categoría eliminada.");
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex justify-end">
        <Button type="button" variant="primary" onClick={abrirCrear}>
          + Nueva categoría
        </Button>
      </div>

      <AdminCard flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Cursos</TableHead>
              <TableHead>Creado por</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categorias.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-uva-muted-2">
                  No hay categorías todavía.
                </TableCell>
              </TableRow>
            )}
            {categorias.map((categoria) => (
              <TableRow key={categoria.id}>
                <TableCell className="font-semibold text-uva-text">{categoria.nombre}</TableCell>
                {/* El mockup no recorta la descripción: la celda crece y el
                    texto se envuelve en varias líneas si hace falta. */}
                <TableCell className="text-uva-muted whitespace-normal">
                  {categoria.descripcion ?? "—"}
                </TableCell>
                <TableCell className="font-mono tabular-nums">{categoria.numeroCursos}</TableCell>
                <TableCell className="text-[12px] text-uva-muted-2">{categoria.creadoPor}</TableCell>
                <TableCell>
                  <Switch
                    checked={categoria.activo}
                    onCheckedChange={(checked) => handleToggle(categoria, checked)}
                    aria-label={categoria.activo ? "Desactivar categoría" : "Activar categoría"}
                  />
                </TableCell>
                <TableCell className="text-right">
                  {/* Acciones de icono: el mockup las escribe con texto, pero
                      aqui se conservan como iconos por decision de diseno. En
                      reposo van en gris (--muted-2) y al hover se encienden en
                      magenta, para que se lean como controles y no como
                      adorno. `title` da la etiqueta que el icono no muestra. */}
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar categoría"
                      title="Editar categoría"
                      className="text-uva-muted-2 hover:text-uva-accent"
                      onClick={() => abrirEditar(categoria)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Eliminar categoría"
                      title="Eliminar categoría"
                      className="text-uva-muted-2 hover:text-uva-accent"
                      onClick={() => setBorrando(categoria)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminCard>

      <CategoriaFormDialog open={formOpen} onOpenChange={setFormOpen} categoria={editando} />

      <ConfirmDialog
        open={borrando !== null}
        onOpenChange={(open) => !open && setBorrando(null)}
        title="Eliminar categoría"
        description={`¿Seguro que quieres eliminar "${borrando?.nombre}"? Esta acción no se puede deshacer.`}
        onConfirm={handleEliminar}
      />
    </div>
  );
}
