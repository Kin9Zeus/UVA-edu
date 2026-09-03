"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { SwitchEstado } from "@/components/admin/SwitchEstado";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/Toast";
import { useAdminSearch } from "@/components/admin/SearchContext";
import { alternarPublicacionCurso, eliminarCurso } from "@/actions/admin/cursos";
import { formatFecha } from "@/lib/admin/format";
import type { CursoListado } from "@/lib/admin/cursos";

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

const ESTADO_ITEMS = { todos: "Todos los estados", publicado: "Publicado", borrador: "Borrador" };
const NIVEL_ITEMS = { todos: "Todos los niveles", ...NIVEL_LABEL };

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
  // El texto de búsqueda lo escribe el header (mockup: `showSearch`).
  const { query: busqueda } = useAdminSearch();

  // Degradado que avisa que hay más filtros a la derecha en la franja con
  // scroll horizontal de mobile — sin esto, el borde queda limpio y no hay
  // ninguna pista de que "Todos los niveles" está cortado. Solo se muestra
  // cuando de verdad sobra contenido (no siempre), para no tapar el último
  // chip cuando los tres ya entran completos.
  const filtrosRef = useRef<HTMLDivElement>(null);
  const [hayMasFiltros, setHayMasFiltros] = useState(false);

  useEffect(() => {
    const el = filtrosRef.current;
    if (!el) return;
    function actualizar() {
      if (!el) return;
      setHayMasFiltros(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
    }
    actualizar();
    el.addEventListener("scroll", actualizar);
    window.addEventListener("resize", actualizar);
    return () => {
      el.removeEventListener("scroll", actualizar);
      window.removeEventListener("resize", actualizar);
    };
  }, []);

  const categoriaItems = useMemo(
    () => ({ todas: "Todas las categorías", ...Object.fromEntries(categorias.map((c) => [c.id, c.nombre])) }),
    [categorias],
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return cursos.filter((curso) => {
      const coincideTexto =
        !texto ||
        curso.titulo.toLowerCase().includes(texto) ||
        curso.instructor.toLowerCase().includes(texto);
      // `some`: un curso aparece bajo el filtro de cualquiera de sus
      // categorías, no solo de la primera.
      const coincideCategoria =
        filtroCategoria === "todas" ||
        curso.categorias.some((categoria) => categoria.id === filtroCategoria);
      const coincideEstado =
        filtroEstado === "todos" || (filtroEstado === "publicado" ? curso.mostrado : !curso.mostrado);
      const coincideNivel = filtroNivel === "todos" || curso.nivel === filtroNivel;
      return coincideTexto && coincideCategoria && coincideEstado && coincideNivel;
    });
  }, [cursos, busqueda, filtroCategoria, filtroEstado, filtroNivel]);

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
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        {/* Los 3 filtros no caben en una fila en mobile sin envolver feo — acá
            se deslizan en horizontal en vez de partirse en varias líneas.
            `shrink-0` en cada trigger es lo que evita que el flex los
            comprima antes de activar el scroll. El wrapper es `relative` y no
            scrollea — así el degradado queda fijo contra el borde derecho en
            vez de desplazarse con el contenido. */}
        <div className="relative">
          <div
            ref={filtrosRef}
            className="flex gap-3 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0"
          >
          <Select
            items={categoriaItems}
            value={filtroCategoria}
            onValueChange={(value) => setFiltroCategoria(value ?? "todas")}
          >
            <SelectTrigger className="shrink-0"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
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
            <SelectTrigger className="shrink-0"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="publicado">Publicado</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
            </SelectContent>
          </Select>
          <Select
            items={NIVEL_ITEMS}
            value={filtroNivel}
            onValueChange={(value) => setFiltroNivel(value ?? "todos")}
          >
            <SelectTrigger className="shrink-0"><SelectValue placeholder="Nivel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los niveles</SelectItem>
              <SelectItem value="BASICO">Básico</SelectItem>
              <SelectItem value="INTERMEDIO">Intermedio</SelectItem>
              <SelectItem value="AVANZADO">Avanzado</SelectItem>
            </SelectContent>
          </Select>
          </div>
          {hayMasFiltros && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-uva-bg to-transparent md:hidden"
            />
          )}
        </div>
        <Button
          variant="primary"
          className="w-full md:ml-auto md:w-auto"
          render={<Link href="/admin/cursos/nuevo" />}
          nativeButton={false}
        >
          + Crear curso
        </Button>
      </div>

      <AdminCard flush>
        {filtrados.length === 0 && (
          <p className="px-5 py-4 text-center text-sm text-uva-muted-2">
            No hay cursos que coincidan con los filtros.
          </p>
        )}

        {/* 7 columnas (una de ellas un switch funcional, no un badge) no
            entran en un touch sin scroll horizontal — y eso incluye tablets
            grandes como un iPad Pro, que igual se manejan con el dedo. Por
            eso el corte no es solo `md`: `pointer-fine:` exige además mouse o
            trackpad antes de mostrar la tabla, sin importar el ancho. */}
        {filtrados.length > 0 && (
          <div className="flex flex-col pointer-fine:md:hidden">
            {filtrados.map((curso) => (
              <div
                key={curso.id}
                className="flex flex-col gap-2 border-b border-uva-divider px-5 py-3.5 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/admin/cursos/${curso.id}`}
                    className="text-sm font-semibold text-uva-text hover:text-uva-accent-text"
                  >
                    {curso.titulo}
                  </Link>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar curso"
                      title="Editar curso"
                      className="text-uva-muted-2 hover:text-uva-accent"
                      render={<Link href={`/admin/cursos/${curso.id}`} />}
                      nativeButton={false}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Eliminar curso"
                      title="Eliminar curso"
                      className="text-uva-muted-2 hover:text-uva-accent"
                      onClick={() => setBorrando(curso)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {curso.categorias.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {curso.categorias.map((categoria) => (
                      <StatusBadge key={categoria.id} tone="neutral">
                        {categoria.nombre}
                      </StatusBadge>
                    ))}
                  </div>
                )}

                <p className="font-mono text-xs text-uva-muted-2 tabular-nums">
                  {NIVEL_LABEL[curso.nivel]} · {curso.estudiantes} estudiantes · {formatFecha(curso.fechaCreacion)}
                </p>

                <SwitchEstado
                  checked={curso.mostrado}
                  onCheckedChange={() => handleTogglePublicacion(curso)}
                  etiquetas={["Publicado", "Borrador"]}
                  acciones={["Publicar curso", "Despublicar curso"]}
                />
              </div>
            ))}
          </div>
        )}

        {filtrados.length > 0 && (
          <Table className="hidden pointer-fine:md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Categorías</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead>Estudiantes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((curso) => (
                <TableRow key={curso.id}>
                  <TableCell className="font-semibold">
                    <Link href={`/admin/cursos/${curso.id}`} className="text-uva-text hover:text-uva-accent-text">
                      {curso.titulo}
                    </Link>
                  </TableCell>
                  {/* Todas las categorías del curso, cada una como un chip. La
                      celda envuelve en varias líneas si son varias, en vez de
                      recortarlas. */}
                  <TableCell className="whitespace-normal">
                    {curso.categorias.length === 0 ? (
                      <span className="text-uva-muted-2">Sin categoría</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {curso.categorias.map((categoria) => (
                          <StatusBadge key={categoria.id} tone="neutral">
                            {categoria.nombre}
                          </StatusBadge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-uva-muted">{NIVEL_LABEL[curso.nivel]}</TableCell>
                  <TableCell className="font-mono tabular-nums">{curso.estudiantes}</TableCell>
                  <TableCell>
                    <SwitchEstado
                      checked={curso.mostrado}
                      onCheckedChange={() => handleTogglePublicacion(curso)}
                      etiquetas={["Publicado", "Borrador"]}
                      acciones={["Publicar curso", "Despublicar curso"]}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-uva-muted-2 tabular-nums">
                    {formatFecha(curso.fechaCreacion)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Editar curso"
                        title="Editar curso"
                        className="text-uva-muted-2 hover:text-uva-accent"
                        render={<Link href={`/admin/cursos/${curso.id}`} />}
                        nativeButton={false}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Eliminar curso"
                        title="Eliminar curso"
                        className="text-uva-muted-2 hover:text-uva-accent"
                        onClick={() => setBorrando(curso)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminCard>

      <ConfirmDialog
        open={borrando !== null}
        onOpenChange={(open) => !open && setBorrando(null)}
        title="Eliminar curso"
        description={
          <>
            ¿Seguro que quieres eliminar &quot;{borrando?.titulo}&quot;? Esta acción no se puede
            deshacer. Si el curso tiene módulos o estudiantes inscritos, no se podrá eliminar —
            despublícalo desde Configuración en su lugar.
          </>
        }
        confirmText={borrando?.titulo}
        onConfirm={handleEliminar}
      />
    </div>
  );
}
