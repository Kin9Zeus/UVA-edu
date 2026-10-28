"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import type { CursoListado } from "@/lib/admin/cursos";

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

const ESTADO_ITEMS = { todos: "Todos los estados", publicado: "Publicado", borrador: "Borrador" };
const NIVEL_ITEMS = { todos: "Todos los niveles", ...NIVEL_LABEL };

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const enLista = (partes: string[]) =>
  partes.length < 2 ? partes.join("") : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;

export function CursosTable({
  cursos,
  categorias,
  encabezado,
  resumen,
}: {
  cursos: CursoListado[];
  categorias: { id: string; nombre: string }[];
  encabezado: ReactNode;
  resumen: ReactNode;
}) {
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroNivel, setFiltroNivel] = useState("todos");
  const [borrando, setBorrando] = useState<CursoListado | null>(null);
  const [despublicando, setDespublicando] = useState<CursoListado | null>(null);
  const [leFalta, setLeFalta] = useState<CursoListado | null>(null);
  const showToast = useAdminToast();
  // El texto de búsqueda lo escribe el header (mockup: `showSearch`).
  const { query: busqueda } = useAdminSearch();

  // Degradado que avisa que hay más filtros a la derecha en la franja con
  // scroll horizontal de mobile. Solo se muestra cuando de verdad sobra
  // contenido, para no tapar el último filtro cuando los tres ya entran.
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
        // `some`: buscar "Ana" encuentra también un curso que dicta con alguien más.
        curso.instructores.some((instructor) => instructor.nombre.toLowerCase().includes(texto));
      // `some`: un curso aparece bajo el filtro de cualquiera de sus categorías.
      const coincideCategoria =
        filtroCategoria === "todas" ||
        curso.categorias.some((categoria) => categoria.id === filtroCategoria);
      const coincideEstado =
        filtroEstado === "todos" || (filtroEstado === "publicado" ? curso.mostrado : !curso.mostrado);
      const coincideNivel = filtroNivel === "todos" || curso.nivel === filtroNivel;
      return coincideTexto && coincideCategoria && coincideEstado && coincideNivel;
    });
  }, [cursos, busqueda, filtroCategoria, filtroEstado, filtroNivel]);

  async function cambiarPublicacion(curso: CursoListado, mostrado: boolean) {
    const resultado = await alternarPublicacionCurso(curso.id, mostrado);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(mostrado ? `Publicaste ${curso.titulo}.` : `Despublicaste ${curso.titulo}.`);
  }

  // Despublicar cambia lo que ve la gente: primero se explica qué pasa. Un
  // borrador al que le falta algo abre la lista de lo que falta en vez de
  // pedirle al servidor algo que va a rechazar.
  function handleToggle(curso: CursoListado, mostrado: boolean) {
    if (!mostrado) {
      setDespublicando(curso);
      return;
    }
    if (curso.faltas.length > 0) {
      setLeFalta(curso);
      return;
    }
    void cambiarPublicacion(curso, true);
  }

  async function handleEliminar() {
    if (!borrando) return;
    const resultado = await eliminarCurso(borrando.id);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(`Eliminaste ${borrando.titulo}.`);
  }

  const nombre = (curso: CursoListado) => (
    <div className="min-w-0">
      <Link
        href={`/admin/cursos/${curso.slug}`}
        className="font-bold break-words text-uva-text hover:text-uva-accent-text hover:underline"
      >
        {curso.titulo}
      </Link>
      <p className="m-0 text-uva-detalle text-uva-text-muted">
        {curso.categorias.map((categoria) => categoria.nombre).join(", ") || "Sin categoría"} · {NIVEL_LABEL[curso.nivel]}
      </p>
    </div>
  );

  const clases = (curso: CursoListado) =>
    curso.clases === 0 ? (
      <span className="text-uva-detalle text-uva-text-muted">Sin clases</span>
    ) : (
      <span className="text-uva-detalle">
        <span className="font-mono font-bold tabular-nums">{curso.clases}</span> {curso.clases === 1 ? "clase" : "clases"}
        <span className={curso.sinVideo > 0 ? "block font-bold text-uva-accent-2-text" : "block text-uva-text-muted"}>
          {curso.sinVideo > 0 ? `${curso.sinVideo} sin video listo` : "Todas con video"}
        </span>
      </span>
    );

  const gente = (curso: CursoListado) =>
    curso.empezaron === 0 ? (
      <span className="text-uva-detalle text-uva-text-muted">{curso.mostrado ? "Nadie lo ha empezado" : "Sin gente"}</span>
    ) : (
      <span className="text-uva-detalle">
        <span className="font-mono font-bold tabular-nums">{curso.empezaron}</span> empezaron
        <span className="block text-uva-text-muted">{curso.terminaron} terminaron</span>
        {curso.seQuedaron > 0 && (
          <span className="block font-bold text-uva-accent-2-text">
            {curso.seQuedaron} {curso.seQuedaron === 1 ? "dejó de avanzar" : "dejaron de avanzar"}
          </span>
        )}
      </span>
    );

  const estado = (curso: CursoListado) => (
    <div className="flex flex-col items-start gap-1">
      <SwitchEstado
        checked={curso.mostrado}
        onCheckedChange={(checked) => handleToggle(curso, checked)}
        etiquetas={["Publicado", "Borrador"]}
        acciones={[`Publicar ${curso.titulo}`, `Despublicar ${curso.titulo}`]}
      />
      {curso.mostrado ? (
        curso.enPortada && <StatusBadge tone="accent">En la portada</StatusBadge>
      ) : curso.faltas.length > 0 ? (
        <span className="max-w-[30ch] text-uva-detalle font-semibold text-uva-accent-2-text">
          Falta: {enLista(curso.faltas.map((falta) => falta.corto))}
        </span>
      ) : (
        <span className="text-uva-detalle font-semibold text-uva-badge-success-fg">Listo para publicar</span>
      )}
    </div>
  );

  // Iconos en gris que se encienden en magenta al pasar el mouse; `title` da
  // la etiqueta que el icono no muestra.
  const acciones = (curso: CursoListado) => (
    <div className="flex justify-end gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Editar ${curso.titulo}`}
        title="Editar curso"
        className="text-uva-muted-2 hover:text-uva-accent-ink pointer-coarse:size-11"
        render={<Link href={`/admin/cursos/${curso.slug}`} />}
        nativeButton={false}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Eliminar ${curso.titulo}`}
        title="Eliminar curso"
        className="text-uva-muted-2 hover:text-uva-accent-ink pointer-coarse:size-11"
        onClick={() => setBorrando(curso)}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );

  const filtros = (
    // Los 3 filtros no caben en una fila en celular: se deslizan en horizontal.
    // El wrapper es `relative` y no se desplaza, así el degradado queda fijo
    // contra el borde derecho.
    <div className="relative min-w-0 max-md:w-full">
      <div ref={filtrosRef} className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        <Select items={categoriaItems} value={filtroCategoria} onValueChange={(value) => setFiltroCategoria(value ?? "todas")}>
          <SelectTrigger className="shrink-0" aria-label="Categoría"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categorias.map((categoria) => (
              <SelectItem key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={ESTADO_ITEMS} value={filtroEstado} onValueChange={(value) => setFiltroEstado(value ?? "todos")}>
          <SelectTrigger className="shrink-0" aria-label="Estado"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="publicado">Publicado</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
          </SelectContent>
        </Select>
        <Select items={NIVEL_ITEMS} value={filtroNivel} onValueChange={(value) => setFiltroNivel(value ?? "todos")}>
          <SelectTrigger className="shrink-0" aria-label="Nivel"><SelectValue placeholder="Nivel" /></SelectTrigger>
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
  );

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-[28rem]">{encabezado}</div>
        <Button
          variant="primary"
          className="max-sm:w-full"
          render={<Link href="/admin/cursos/nuevo" />}
          nativeButton={false}
        >
          <Plus aria-hidden />
          Nuevo curso
        </Button>
      </div>

      {cursos.length > 0 && resumen}

      <section aria-labelledby="cursos-lista" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="cursos-lista" className="text-uva-titulo-4 text-uva-text">
            {plural(cursos.length, "curso", "cursos")}
          </h2>
          {cursos.length > 0 && filtros}
        </div>
        <AdminCard flush>
          {cursos.length === 0 && (
            <div className="grid justify-items-center gap-1 px-5 py-10 text-center">
              <p className="m-0 font-bold text-uva-text">Todavía no hay cursos</p>
              <p className="m-0 max-w-[46ch] text-uva-detalle text-uva-text-muted">
                Crea el primero: queda en borrador hasta que tenga portada y clases con video.
              </p>
            </div>
          )}
          {cursos.length > 0 && filtrados.length === 0 && (
            <p className="m-0 px-5 py-6 text-center text-uva-detalle text-uva-text-muted">
              No hay cursos que coincidan con la búsqueda o los filtros.
            </p>
          )}

          {/* En pantallas táctiles, tarjetas: la tabla no cabe sin desplazar
              de lado, ni siquiera en una tableta grande. */}
          {filtrados.length > 0 && (
            <ul className="m-0 flex list-none flex-col p-0 pointer-fine:md:hidden">
              {filtrados.map((curso) => (
                <li key={curso.id} className="flex flex-col gap-3 border-b border-uva-divider px-4 py-4 last:border-b-0">
                  {nombre(curso)}
                  <div className="grid grid-cols-2 gap-3">
                    {clases(curso)}
                    {gente(curso)}
                  </div>
                  <div className="flex items-start justify-between gap-3 border-t border-uva-divider pt-2">
                    {estado(curso)}
                    {acciones(curso)}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {filtrados.length > 0 && (
            <Table contenedorClassName="hidden pointer-fine:md:block" etiqueta="Tabla de cursos">
              <TableHeader>
                <TableRow>
                  <TableHead>Curso</TableHead>
                  <TableHead>Clases</TableHead>
                  <TableHead>Gente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((curso) => (
                  <TableRow key={curso.id}>
                    <TableCell className="max-w-96 whitespace-normal">{nombre(curso)}</TableCell>
                    <TableCell>{clases(curso)}</TableCell>
                    <TableCell>{gente(curso)}</TableCell>
                    <TableCell className="whitespace-normal">{estado(curso)}</TableCell>
                    <TableCell className="text-right">{acciones(curso)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </AdminCard>
      </section>

      <ConfirmDialog
        open={despublicando !== null}
        onOpenChange={(open) => !open && setDespublicando(null)}
        title={`Despublicar ${despublicando?.titulo ?? ""}`}
        confirmLabel="Despublicar"
        description={despublicando && textoDespublicar(despublicando)}
        onConfirm={async () => {
          if (despublicando) await cambiarPublicacion(despublicando, false);
        }}
      />

      <Dialog open={leFalta !== null} onOpenChange={(open) => !open && setLeFalta(null)}>
        <DialogContent className="w-[440px]">
          <DialogHeader>
            <DialogTitle>Todavía no se puede publicar</DialogTitle>
          </DialogHeader>
          <p className="text-uva-detalle text-uva-muted">A {leFalta?.titulo} le falta esto:</p>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-uva-detalle text-uva-text">
            {leFalta?.faltas.map((falta) => <li key={falta.motivo}>{falta.motivo}</li>)}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLeFalta(null)}>
              Cerrar
            </Button>
            <Button variant="primary" render={<Link href={`/admin/cursos/${leFalta?.slug ?? ""}`} />} nativeButton={false}>
              Ir al curso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* eliminarCurso exige que no tenga módulos ni estudiantes inscritos:
          si tiene módulos, se dice antes de pedir confirmación. */}
      <Dialog open={borrando !== null && borrando.modulos > 0} onOpenChange={(open) => !open && setBorrando(null)}>
        <DialogContent className="w-[440px]">
          <DialogHeader>
            <DialogTitle>No se puede eliminar {borrando?.titulo}</DialogTitle>
          </DialogHeader>
          <p className="text-uva-detalle text-uva-muted">
            Tiene {borrando && plural(borrando.modulos, "módulo", "módulos")}. Para eliminarlo, borra primero sus módulos en
            Contenido. Si solo quieres que nadie nuevo lo vea, despublícalo con el interruptor de la lista.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBorrando(null)}>
              Cerrar
            </Button>
            <Button
              variant="primary"
              render={<Link href={`/admin/cursos/${borrando?.slug ?? ""}?pestana=contenido`} />}
              nativeButton={false}
            >
              Ir al contenido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={borrando !== null && borrando.modulos === 0}
        onOpenChange={(open) => !open && setBorrando(null)}
        title={`Eliminar ${borrando?.titulo ?? ""}`}
        confirmLabel="Eliminar curso"
        destructive
        description="No tiene módulos. No se puede deshacer."
        confirmText={borrando?.titulo}
        onConfirm={handleEliminar}
      />
    </div>
  );
}

/** Lo que pasa de verdad al despublicar (SQL 030): quien ya lo estudia sigue. */
export function textoDespublicar(curso: { empezaron: number; enPortada: boolean }) {
  return (
    "Sale del catálogo y nadie nuevo lo puede empezar. " +
    (curso.empezaron === 0
      ? ""
      : curso.empezaron === 1
        ? "La persona que ya lo empezó puede terminarlo, y su avance no se borra. "
        : `Las ${curso.empezaron} personas que ya lo empezaron pueden terminarlo, y su avance no se borra. `) +
    (curso.enPortada ? "También deja de salir en la portada. " : "") +
    "Lo puedes volver a publicar cuando quieras."
  );
}
