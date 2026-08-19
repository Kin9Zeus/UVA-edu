"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, MoreHorizontal } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/Toast";
import { alternarPublicacionCurso, eliminarCurso } from "@/actions/admin/cursos";
import { formatFecha } from "@/lib/admin/format";
import type { CursoListado } from "@/lib/admin/cursos";

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

const ESTADO_ITEMS = { todos: "Todo estado", publicado: "Publicado", borrador: "Borrador" };
const NIVEL_ITEMS = { todos: "Todo nivel", ...NIVEL_LABEL };

export function CursosTable({
  cursos: cursosIniciales,
  categorias,
}: {
  cursos: CursoListado[];
  categorias: { id: string; nombre: string }[];
}) {
  const [cursos, setCursos] = useState(cursosIniciales);
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroNivel, setFiltroNivel] = useState("todos");
  const [borrando, setBorrando] = useState<CursoListado | null>(null);
  const showToast = useAdminToast();

  const categoriaItems = useMemo(
    () => ({ todas: "Toda categoría", ...Object.fromEntries(categorias.map((c) => [c.id, c.nombre])) }),
    [categorias],
  );

  const filtrados = useMemo(() => {
    return cursos.filter((curso) => {
      const coincideCategoria = filtroCategoria === "todas" || curso.categoriaId === filtroCategoria;
      const coincideEstado =
        filtroEstado === "todos" || (filtroEstado === "publicado" ? curso.mostrado : !curso.mostrado);
      const coincideNivel = filtroNivel === "todos" || curso.nivel === filtroNivel;
      return coincideCategoria && coincideEstado && coincideNivel;
    });
  }, [cursos, filtroCategoria, filtroEstado, filtroNivel]);

  async function handleTogglePublicacion(curso: CursoListado) {
    const nuevoEstado = !curso.mostrado;
    const resultado = await alternarPublicacionCurso(curso.id, nuevoEstado);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    setCursos((current) => current.map((item) => (item.id === curso.id ? { ...item, mostrado: nuevoEstado } : item)));
    showToast(nuevoEstado ? "Curso publicado." : "Curso despublicado.");
  }

  async function handleEliminar() {
    if (!borrando) return;
    const resultado = await eliminarCurso(borrando.id);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    setCursos((current) => current.filter((item) => item.id !== borrando.id));
    showToast("Curso eliminado.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Select
            items={categoriaItems}
            value={filtroCategoria}
            onValueChange={(value) => setFiltroCategoria(value ?? "todas")}
          >
            <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Toda categoría</SelectItem>
              {categorias.map((categoria) => (
                <SelectItem key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={ESTADO_ITEMS}
            value={filtroEstado}
            onValueChange={(value) => setFiltroEstado(value ?? "todos")}
          >
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo estado</SelectItem>
              <SelectItem value="publicado">Publicado</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
            </SelectContent>
          </Select>
          <Select
            items={NIVEL_ITEMS}
            value={filtroNivel}
            onValueChange={(value) => setFiltroNivel(value ?? "todos")}
          >
            <SelectTrigger><SelectValue placeholder="Nivel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo nivel</SelectItem>
              <SelectItem value="BASICO">Básico</SelectItem>
              <SelectItem value="INTERMEDIO">Intermedio</SelectItem>
              <SelectItem value="AVANZADO">Avanzado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button render={<Link href="/admin/cursos/nuevo" />} nativeButton={false}>
          <Plus className="size-4" />
          Crear curso
        </Button>
      </div>

      <div className="rounded-uva-md border border-uva-divider bg-uva-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Curso</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Nivel</TableHead>
              <TableHead>Estudiantes</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-uva-text-faint">
                  No hay cursos que coincidan con los filtros.
                </TableCell>
              </TableRow>
            )}
            {filtrados.map((curso) => (
              <TableRow key={curso.id}>
                <TableCell>
                  <Link href={`/admin/cursos/${curso.id}`} className="text-uva-text hover:text-uva-accent-text">
                    {curso.titulo}
                  </Link>
                </TableCell>
                <TableCell className="text-uva-text-muted">{curso.categoria}</TableCell>
                <TableCell className="text-uva-text-muted">{NIVEL_LABEL[curso.nivel]}</TableCell>
                <TableCell className="font-mono tabular-nums">{curso.estudiantes}</TableCell>
                <TableCell>
                  <StatusBadge tone={curso.mostrado ? "success" : "neutral"}>
                    {curso.mostrado ? "Publicado" : "Borrador"}
                  </StatusBadge>
                </TableCell>
                <TableCell className="font-mono text-xs text-uva-text-faint tabular-nums">
                  {formatFecha(curso.fechaCreacion)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label="Más acciones"
                      className="flex size-8 items-center justify-center rounded-uva-sm text-uva-text-faint hover:bg-[#27272A] hover:text-uva-text"
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLinkItem render={<Link href={`/admin/cursos/${curso.id}`} />}>
                        Ver / Editar
                      </DropdownMenuLinkItem>
                      <DropdownMenuItem onClick={() => handleTogglePublicacion(curso)}>
                        {curso.mostrado ? "Despublicar" : "Publicar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setBorrando(curso)}>
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={borrando !== null}
        onOpenChange={(open) => !open && setBorrando(null)}
        title="Eliminar curso"
        description={`¿Seguro que quieres eliminar "${borrando?.titulo}"? Se eliminarán también sus módulos y lecciones. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={handleEliminar}
      />
    </div>
  );
}
