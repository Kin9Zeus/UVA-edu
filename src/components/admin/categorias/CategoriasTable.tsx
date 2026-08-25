"use client";

import { useState } from "react";
import Link from "next/link";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SwitchEstado } from "@/components/admin/SwitchEstado";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/Toast";
import { CategoriaFormDialog } from "@/components/admin/categorias/CategoriaFormDialog";
import {
  toggleActivaCategoria,
  eliminarCategoria,
  reasignarYEliminarCategoria,
} from "@/actions/admin/categorias";
import type { Categoria } from "@/lib/admin/categorias";

export function CategoriasTable({ categorias }: { categorias: Categoria[] }) {
  const [verCursosDe, setVerCursosDe] = useState<Categoria | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [borrando, setBorrando] = useState<Categoria | null>(null);
  // Eliminar una categoría con cursos exige moverlos antes (la FK de
  // curso_categorias es RESTRICT), así que esos casos van por un diálogo
  // aparte que pide el destino en vez del ConfirmDialog de siempre.
  const [reasignando, setReasignando] = useState<Categoria | null>(null);
  const [destinoId, setDestinoId] = useState("");
  const [errorReasignar, setErrorReasignar] = useState<string | null>(null);
  const [pendingReasignar, setPendingReasignar] = useState(false);
  const showToast = useAdminToast();

  const destinos = reasignando
    ? categorias.filter((item) => item.id !== reasignando.id)
    : [];

  function pedirEliminar(categoria: Categoria) {
    if (categoria.numeroCursos > 0) {
      setDestinoId("");
      setErrorReasignar(null);
      setReasignando(categoria);
      return;
    }
    setBorrando(categoria);
  }

  async function handleReasignarYEliminar() {
    if (!reasignando) return;
    setPendingReasignar(true);
    setErrorReasignar(null);

    const resultado = await reasignarYEliminarCategoria(reasignando.id, destinoId);
    setPendingReasignar(false);

    if (resultado.error) {
      setErrorReasignar(resultado.error);
      return;
    }

    const destino = destinos.find((item) => item.id === destinoId)?.nombre ?? "otra categoría";
    showToast(
      `Categoría eliminada. ${reasignando.numeroCursos} curso(s) movidos a "${destino}".`,
    );
    setReasignando(null);
  }

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
                <TableCell>
                  {/* El slug no se muestra acá: sería un renglón extra en
                      cada fila para un dato que se consulta muy de vez en
                      cuando. Vive en el diálogo de edición, que muestra el
                      guardado de verdad (sufijo de desempate incluido). */}
                  <button
                    type="button"
                    onClick={() => setVerCursosDe(categoria)}
                    className="text-left font-semibold text-uva-text hover:text-uva-accent-text"
                  >
                    {categoria.nombre}
                  </button>
                </TableCell>
                {/* El mockup no recorta la descripción: la celda crece y el
                    texto se envuelve en varias líneas si hace falta. */}
                <TableCell className="text-uva-muted whitespace-normal">
                  {categoria.descripcion ?? "—"}
                </TableCell>
                <TableCell className="font-mono tabular-nums">{categoria.numeroCursos}</TableCell>
                <TableCell className="text-[12px] text-uva-muted-2">{categoria.creadoPor}</TableCell>
                <TableCell>
                  <SwitchEstado
                    checked={categoria.activo}
                    onCheckedChange={(checked) => handleToggle(categoria, checked)}
                    etiquetas={["Activa", "Inactiva"]}
                    acciones={["Activar categoría", "Desactivar categoría"]}
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
                      onClick={() => pedirEliminar(categoria)}
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

      <CategoriaFormDialog
        key={editando?.id ?? "nueva"}
        open={formOpen}
        onOpenChange={setFormOpen}
        categoria={editando}
      />

      <ConfirmDialog
        open={borrando !== null}
        onOpenChange={(open) => !open && setBorrando(null)}
        title="Eliminar categoría"
        description={`¿Seguro que quieres eliminar "${borrando?.nombre}"? Esta acción no se puede deshacer.`}
        onConfirm={handleEliminar}
      />

      <Dialog
        open={reasignando !== null}
        onOpenChange={(open) => !open && !pendingReasignar && setReasignando(null)}
      >
        <DialogContent className="w-[440px]">
          <DialogHeader>
            <DialogTitle>Eliminar {reasignando?.nombre}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3.5">
            {errorReasignar && (
              <div
                role="alert"
                className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text"
              >
                {errorReasignar}
              </div>
            )}

            <p className="text-[13.5px] text-uva-muted">
              Esta categoría tiene {reasignando?.numeroCursos}{" "}
              {reasignando?.numeroCursos === 1 ? "curso asociado" : "cursos asociados"}. Elige a
              dónde moverlos: se reasignan y después se elimina la categoría.
            </p>

            {destinos.length === 0 ? (
              <p className="text-[13.5px] text-uva-error-text">
                No hay otra categoría a la que mover los cursos. Crea una antes de eliminar esta.
              </p>
            ) : (
              <div>
                <Label htmlFor="reasignar-destino">Mover los cursos a</Label>
                <Select
                  items={Object.fromEntries(destinos.map((item) => [item.id, item.nombre]))}
                  value={destinoId}
                  onValueChange={(value) => setDestinoId(value ?? "")}
                >
                  <SelectTrigger id="reasignar-destino" className="w-full">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinos.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Un curso que ya esté en el destino no se duplica: la
                    reasignación solo le quita la categoría que se elimina. */}
                <p className="mt-1.5 text-xs text-uva-text-faint">
                  Los cursos que ya estén en la categoría de destino no se duplican.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReasignando(null)}
              disabled={pendingReasignar}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleReasignarYEliminar}
              disabled={pendingReasignar || destinoId === ""}
            >
              {pendingReasignar ? "Procesando…" : "Reasignar y eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={verCursosDe !== null}
        onOpenChange={(open) => !open && setVerCursosDe(null)}
      >
        <DialogContent className="w-[440px]">
          <DialogHeader>
            <DialogTitle>Cursos de {verCursosDe?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[300px] flex-col gap-1.5 overflow-auto">
            {verCursosDe?.cursos.length === 0 && (
              <p className="text-[13.5px] text-uva-muted-2">
                Esta categoría todavía no tiene cursos asignados.
              </p>
            )}
            {verCursosDe?.cursos.map((curso) => (
              <Link
                key={curso.id}
                href={`/admin/cursos/${curso.id}`}
                className="flex items-center justify-between rounded-uva-md bg-uva-surface-2 px-3 py-2.5 text-[13px] font-semibold text-uva-text hover:text-uva-accent-text"
              >
                {curso.titulo}
                <StatusBadge tone={curso.mostrado ? "success" : "neutral"}>
                  {curso.mostrado ? "Publicado" : "Borrador"}
                </StatusBadge>
              </Link>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setVerCursosDe(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
