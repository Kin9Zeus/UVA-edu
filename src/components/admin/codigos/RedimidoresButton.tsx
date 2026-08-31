"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAdminToast } from "@/components/admin/Toast";
import { obtenerRedimidoresCodigo, type RedimidorCodigo } from "@/actions/admin/codigosInvitacion";
import { formatFechaHora } from "@/lib/admin/format";

/**
 * "Ver por código ... quiénes lo canjearon" (rev.md). Compartido por los dos
 * modos de generación (código único y lote): un código de uso único tiene a
 * lo sumo un redimidor, uno con `limite_usos` > 1 puede tener varios, pero
 * la consulta y el diálogo son los mismos en ambos casos.
 */
export function RedimidoresButton({
  codigoId,
  codigo,
  vecesUsado,
}: {
  codigoId: string;
  codigo: string;
  vecesUsado: number;
}) {
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [redimidores, setRedimidores] = useState<RedimidorCodigo[] | null>(null);
  const showToast = useAdminToast();

  if (vecesUsado === 0) {
    return <span className="text-[12px] text-uva-text-faint">—</span>;
  }

  async function abrir() {
    setOpen(true);
    setCargando(true);
    const resultado = await obtenerRedimidoresCodigo(codigoId);
    setCargando(false);

    if (resultado.error || !resultado.redimidores) {
      showToast(resultado.error ?? "No pudimos cargar quiénes canjearon este código.", "error");
      setOpen(false);
      return;
    }
    setRedimidores(resultado.redimidores);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-auto gap-1.5 text-uva-muted-2 hover:text-uva-accent"
        onClick={abrir}
      >
        <Users className="size-3.5" />
        {vecesUsado}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[440px]">
          <DialogHeader>
            <DialogTitle>Quién canjeó {codigo}</DialogTitle>
          </DialogHeader>

          {cargando && <p className="text-sm text-uva-muted">Cargando…</p>}

          {!cargando && redimidores && redimidores.length === 0 && (
            <p className="text-sm text-uva-muted">Nadie lo ha canjeado todavía.</p>
          )}

          {!cargando && redimidores && redimidores.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {redimidores.map((redimidor) => (
                <li
                  key={redimidor.usuarioId}
                  className="flex items-center justify-between gap-3 rounded-uva-md border border-uva-divider px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-uva-text">{redimidor.nombre}</p>
                    <p className="truncate text-[12px] text-uva-muted-2">{redimidor.correo}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[11.5px] text-uva-muted-2">
                    {formatFechaHora(redimidor.canjeadoEn)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
