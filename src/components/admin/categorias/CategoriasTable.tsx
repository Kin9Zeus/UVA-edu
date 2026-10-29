"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { EstadoEnCatalogo, NotaCatalogo } from "@/components/admin/categorias/EstadoEnCatalogo";
import {
  toggleActivaCategoria,
  eliminarCategoria,
  reasignarYEliminarCategoria,
} from "@/actions/admin/categorias";
import type { Categoria } from "@/lib/admin/categorias";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function CategoriasTable({
  categorias,
  encabezado,
  resumen,
}: {
  categorias: Categoria[];
  encabezado: ReactNode;
  resumen: ReactNode;
}) {
  const [verCursosDe, setVerCursosDe] = useState<Categoria | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [borrando, setBorrando] = useState<Categoria | null>(null);
  const [apagando, setApagando] = useState<Categoria | null>(null);
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
  const cursosDe = (categoria: Categoria) => categoria.publicados + categoria.borradores;

  function pedirEliminar(categoria: Categoria) {
    if (cursosDe(categoria) > 0) {
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
    showToast(`Eliminaste ${reasignando.nombre}. ${plural(cursosDe(reasignando), "curso pasó", "cursos pasaron")} a ${destino}.`);
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

  async function cambiarEstado(categoria: Categoria, activo: boolean) {
    const resultado = await toggleActivaCategoria(categoria.id, activo);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(activo ? `Encendiste ${categoria.nombre}.` : `Apagaste ${categoria.nombre}.`);
  }

  // Apagar una categoría con cursos publicados cambia lo que ve la gente:
  // primero se explica qué pasa. Encender, o apagar una que no se ve, no.
  function handleToggle(categoria: Categoria, activo: boolean) {
    if (!activo && categoria.publicados > 0) {
      setApagando(categoria);
      return;
    }
    void cambiarEstado(categoria, activo);
  }

  async function handleEliminar() {
    if (!borrando) return;
    const resultado = await eliminarCategoria(borrando.id);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(`Eliminaste ${borrando.nombre}.`);
  }

  const interruptor = (categoria: Categoria) => (
    <SwitchEstado
      checked={categoria.activo}
      onCheckedChange={(checked) => handleToggle(categoria, checked)}
      etiquetas={["Encendida", "Apagada"]}
      acciones={[`Encender ${categoria.nombre}`, `Apagar ${categoria.nombre}`]}
    />
  );

  // Iconos en gris que se encienden en magenta al pasar el mouse; `title` da
  // la etiqueta que el icono no muestra.
  const acciones = (categoria: Categoria) => (
    <div className="flex justify-end gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Editar ${categoria.nombre}`}
        title="Editar categoría"
        className="text-uva-muted-2 hover:text-uva-accent-ink pointer-coarse:size-11"
        onClick={() => abrirEditar(categoria)}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Eliminar ${categoria.nombre}`}
        title="Eliminar categoría"
        className="text-uva-muted-2 hover:text-uva-accent-ink pointer-coarse:size-11"
        onClick={() => pedirEliminar(categoria)}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-[28rem]">{encabezado}</div>
        <Button type="button" variant="primary" className="max-sm:w-full" onClick={abrirCrear}>
          <Plus aria-hidden />
          Nueva categoría
        </Button>
      </div>

      {categorias.length > 0 && resumen}

      <section aria-labelledby="categorias-lista" className="flex flex-col gap-3">
        <h2 id="categorias-lista" className="text-uva-titulo-4 text-uva-text">
          {plural(categorias.length, "categoría", "categorías")}
        </h2>
        <AdminCard flush>
          {categorias.length === 0 && (
            <div className="grid justify-items-center gap-1 px-5 py-10 text-center">
              <p className="m-0 font-bold text-uva-text">Todavía no hay categorías</p>
              <p className="m-0 max-w-[46ch] text-uva-detalle text-uva-text-muted">
                Cada curso necesita una. Crea la primera y aparece en el catálogo cuando tenga un curso publicado.
              </p>
            </div>
          )}

          {/* En pantallas táctiles, tarjetas: qué es, si se ve y por qué,
              sus cursos, y abajo los controles. */}
          {categorias.length > 0 && (
            <ul className="m-0 flex list-none flex-col p-0 pointer-fine:md:hidden">
              {categorias.map((categoria) => (
                <li key={categoria.id} className="flex flex-col gap-2 border-b border-uva-divider px-4 py-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="m-0 min-w-0 font-bold break-words text-uva-text">{categoria.nombre}</p>
                    <EstadoEnCatalogo categoria={categoria} />
                  </div>
                  <p className="m-0 -mt-1 text-uva-detalle text-uva-text-muted">
                    <NotaCatalogo categoria={categoria} />
                  </p>
                  {categoria.descripcion && (
                    <p className="m-0 text-uva-detalle text-uva-text-muted">{categoria.descripcion}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setVerCursosDe(categoria)}
                    className="-mx-2 inline-flex min-h-11 w-fit items-center rounded-uva-sm px-2 text-left text-uva-detalle text-uva-text hover:bg-uva-hover hover:text-uva-accent-text"
                  >
                    {plural(categoria.publicados, "curso publicado", "cursos publicados")}
                    {categoria.borradores > 0 && `, ${categoria.borradores} en borrador`}
                  </button>
                  <div className="flex items-center justify-between gap-3 border-t border-uva-divider pt-2">
                    {interruptor(categoria)}
                    {acciones(categoria)}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {categorias.length > 0 && (
            <Table contenedorClassName="hidden pointer-fine:md:block" etiqueta="Tabla de categorías">
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Cursos</TableHead>
                  <TableHead>En el catálogo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categorias.map((categoria) => (
                  <TableRow key={categoria.id}>
                    {/* El slug vive en el diálogo de edición y en la columna
                        En el catálogo, cuando la categoría tiene página. */}
                    <TableCell className="max-w-96 whitespace-normal">
                      <p className="m-0 font-bold text-uva-text">{categoria.nombre}</p>
                      {categoria.descripcion && (
                        <p className="m-0 line-clamp-2 text-uva-detalle text-uva-text-muted">{categoria.descripcion}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setVerCursosDe(categoria)}
                        aria-label={`Ver los cursos de ${categoria.nombre}`}
                        className="-mx-2 -my-1.5 rounded-uva-sm px-2 py-1.5 text-left hover:bg-uva-hover hover:text-uva-accent-text"
                      >
                        <span className="block font-mono tabular-nums">{plural(categoria.publicados, "publicado", "publicados")}</span>
                        {categoria.borradores > 0 && (
                          <span className="block font-mono text-uva-detalle text-uva-text-muted tabular-nums">
                            {categoria.borradores} en borrador
                          </span>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <EstadoEnCatalogo categoria={categoria} />
                      <p className="m-0 mt-1 max-w-[30ch] text-uva-detalle text-uva-text-muted">
                        <NotaCatalogo categoria={categoria} />
                      </p>
                    </TableCell>
                    <TableCell>{interruptor(categoria)}</TableCell>
                    <TableCell className="text-right">{acciones(categoria)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </AdminCard>
      </section>

      <CategoriaFormDialog
        key={editando?.id ?? "nueva"}
        open={formOpen}
        onOpenChange={setFormOpen}
        categoria={editando}
      />

      <ConfirmDialog
        open={apagando !== null}
        onOpenChange={(open) => !open && setApagando(null)}
        title={`Apagar ${apagando?.nombre ?? ""}`}
        confirmLabel="Apagar categoría"
        description={
          apagando &&
          `Deja de salir en el filtro del catálogo y su página /catalogo/${apagando.slug} deja de existir. ` +
            (apagando.publicados === 1
              ? "Su curso publicado sigue en el catálogo, pero ya no se encuentra por esta categoría."
              : `Sus ${apagando.publicados} cursos publicados siguen en el catálogo, pero ya no se encuentran por esta categoría.`) +
            " La puedes volver a encender cuando quieras."
        }
        onConfirm={async () => {
          if (apagando) await cambiarEstado(apagando, false);
        }}
      />

      <ConfirmDialog
        open={borrando !== null}
        onOpenChange={(open) => !open && setBorrando(null)}
        title={`Eliminar ${borrando?.nombre ?? ""}`}
        confirmLabel="Eliminar categoría"
        destructive
        description="No tiene cursos. No se puede deshacer."
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
                className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-uva-detalle text-uva-error-text"
              >
                {errorReasignar}
              </div>
            )}

            <p className="text-uva-detalle text-uva-muted">
              Tiene {reasignando && plural(cursosDe(reasignando), "curso", "cursos")}. Elige a dónde moverlos: se
              mueven y después se elimina la categoría.
            </p>

            {destinos.length === 0 ? (
              <p className="text-uva-detalle text-uva-error-text">
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
                <p className="mt-1.5 text-uva-detalle text-uva-text-faint">
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
              variant="destructive-solid"
              onClick={handleReasignarYEliminar}
              disabled={pendingReasignar || destinoId === ""}
            >
              {pendingReasignar ? "Moviendo…" : "Mover y eliminar"}
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
              <p className="text-uva-detalle text-uva-muted-2">
                Esta categoría todavía no tiene cursos asignados.
              </p>
            )}
            {verCursosDe?.cursos.map((curso) => (
              <Link
                key={curso.id}
                href={`/admin/cursos/${curso.slug}`}
                className="flex items-center justify-between gap-2 rounded-uva-md bg-uva-surface-2 px-3 py-2.5 text-uva-detalle font-semibold text-uva-text hover:text-uva-accent-text"
              >
                <span className="min-w-0 truncate">{curso.titulo}</span>
                <StatusBadge tone={curso.mostrado ? "success" : "neutral"} className="shrink-0">
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
