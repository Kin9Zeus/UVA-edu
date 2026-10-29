"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminToast } from "@/components/admin/Toast";
import { exportarBitacoraCsv } from "@/actions/admin/exportarBitacora";
import { TIPOS_BITACORA, type TipoBitacora } from "@/lib/admin/bitacora-tipos";
import { CLASE_CAMPO_BUSCADOR, CLASE_ICONO_BUSCADOR } from "@/components/catalogo/campoBuscador";
import { cn } from "@/lib/utils";

const TODOS = "todos";
const ITEMS_TIPO = { [TODOS]: "Todos los tipos", ...Object.fromEntries(TIPOS_BITACORA.map((t) => [t.clave, t.nombre])) };

const CLASE_FECHA =
  "min-h-11 min-w-[9.5rem] flex-1 rounded-uva-md border border-uva-line-strong bg-uva-surface px-2.5 py-1.5 text-base text-uva-text md:flex-none md:pointer-fine:min-h-9 md:pointer-fine:text-uva-detalle";

/**
 * Filtros de la bitácora. Viven en la URL (no en estado), porque filtra el
 * servidor y así un filtro se puede compartir con un enlace. En celular,
 * todo menos la búsqueda queda detrás de "Filtros".
 */
export function FiltrosBitacora({ admins }: { admins: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendiente, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [busqueda, setBusqueda] = useState(searchParams.get("q") ?? "");
  const showToast = useAdminToast();
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const tipo = searchParams.get("tipo") ?? TODOS;
  const admin = searchParams.get("admin") ?? TODOS;
  const sensibles = searchParams.get("sensibles") === "1";
  const desde = searchParams.get("desde") ?? "";
  const hasta = searchParams.get("hasta") ?? "";
  const activos = [tipo !== TODOS, admin !== TODOS, sensibles, !!desde || !!hasta].filter(Boolean).length;
  const hayFiltros = activos > 0 || !!searchParams.get("q");

  function actualizar(cambios: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (!valor || valor === TODOS) params.delete(clave);
      else params.set(clave, valor);
    }
    // Otro filtro, otra lista: se vuelve a mostrar desde la primera tanda.
    params.delete("mostrar");
    const cadena = params.toString();
    startTransition(() => router.replace(cadena ? `${pathname}?${cadena}` : pathname, { scroll: false }));
  }

  // La búsqueda se aplica al dejar de escribir, no en cada tecla.
  useEffect(() => () => clearTimeout(temporizador.current), []);
  function buscar(valor: string) {
    setBusqueda(valor);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => actualizar({ q: valor.trim() || null }), 300);
  }

  async function exportar() {
    setExportando(true);
    try {
      const respuesta = await exportarBitacoraCsv({
        tipo: tipo === TODOS ? null : (tipo as TipoBitacora),
        admin: admin === TODOS ? null : admin,
        sensibles,
        busqueda: searchParams.get("q"),
        desde: desde || undefined,
        hasta: hasta || undefined,
      });
      if (respuesta.error || !respuesta.csv || !respuesta.nombreArchivo) {
        showToast(respuesta.error ?? "No pudimos generar la exportación.", "error");
        return;
      }
      // El Server Action devuelve el CSV como texto y la descarga se dispara
      // aquí: CLAUDE.md §3.1 reserva /api/ para webhooks externos.
      const url = URL.createObjectURL(new Blob([respuesta.csv], { type: "text/csv;charset=utf-8;" }));
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = respuesta.nombreArchivo;
      enlace.click();
      URL.revokeObjectURL(url);
      showToast("Bitácora exportada. La exportación también queda registrada aquí.");
      router.refresh();
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5" aria-busy={pendiente || undefined}>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 md:max-w-[340px]">
          <Search className={cn(CLASE_ICONO_BUSCADOR, "size-4")} strokeWidth={2.2} aria-hidden />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => buscar(evento.target.value)}
            placeholder="Persona, curso o código"
            aria-label="Buscar persona, curso o código"
            className={CLASE_CAMPO_BUSCADOR}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="md:hidden"
          aria-expanded={abierto}
          aria-controls="bitacora-filtros"
          onClick={() => setAbierto((valor) => !valor)}
        >
          <SlidersHorizontal aria-hidden />
          Filtros{activos > 0 && ` (${activos})`}
        </Button>
        <Button type="button" variant="outline" className="max-md:hidden md:ml-auto" cargando={exportando} onClick={exportar}>
          <Download aria-hidden />
          Exportar CSV
        </Button>
      </div>

      <div
        id="bitacora-filtros"
        className={cn(
          "flex flex-col gap-2.5 max-md:rounded-uva-md max-md:border max-md:border-uva-divider max-md:bg-uva-surface max-md:p-3.5 md:flex-row md:flex-wrap md:items-center",
          !abierto && "max-md:hidden",
        )}
      >
        <Select items={ITEMS_TIPO} value={tipo} onValueChange={(valor) => actualizar({ tipo: valor as string })}>
          <SelectTrigger aria-label="Tipo de acción" className="w-full md:w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ITEMS_TIPO).map(([clave, nombre]) => (
              <SelectItem key={clave} value={clave}>
                {nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={{ [TODOS]: "Todos los administradores", ...Object.fromEntries(admins.map((a) => [a.id, a.nombre])) }}
          value={admin}
          onValueChange={(valor) => actualizar({ admin: valor as string })}
        >
          <SelectTrigger aria-label="Administrador" className="w-full md:w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los administradores</SelectItem>
            {admins.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-uva-detalle text-uva-text md:pointer-fine:min-h-9">
          <Checkbox checked={sensibles} onCheckedChange={(valor) => actualizar({ sensibles: valor ? "1" : null })} />
          Solo sensibles
        </label>
        <div className="flex items-center gap-2">
          <input type="date" aria-label="Desde" value={desde} onChange={(e) => actualizar({ desde: e.target.value || null })} className={CLASE_FECHA} />
          <span className="shrink-0 text-uva-detalle text-uva-text-muted">a</span>
          <input type="date" aria-label="Hasta" value={hasta} onChange={(e) => actualizar({ hasta: e.target.value || null })} className={CLASE_FECHA} />
        </div>
        {hayFiltros && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setBusqueda("");
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
          >
            Limpiar filtros
          </Button>
        )}
        <Button type="button" variant="outline" className="md:hidden" cargando={exportando} onClick={exportar}>
          <Download aria-hidden />
          Exportar CSV
        </Button>
      </div>
    </div>
  );
}
