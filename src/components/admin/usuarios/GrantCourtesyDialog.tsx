"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ofrecerCortesia } from "@/actions/admin/usuarios";
import { useAdminToast } from "@/components/admin/Toast";

type Curso = { id: string; titulo: string };

export function GrantCourtesyDialog({
  open,
  onOpenChange,
  usuarioId,
  cursos,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuarioId: string;
  cursos: Curso[];
}) {
  const [cursoElegido, setCursoElegido] = useState<Curso | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showToast = useAdminToast();

  function cerrar() {
    onOpenChange(false);
    setCursoElegido(null);
    setError(null);
  }

  async function confirmar() {
    if (!cursoElegido) return;
    setPending(true);
    setError(null);
    const resultado = await ofrecerCortesia(usuarioId, cursoElegido.id);
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    showToast(`Curso "${cursoElegido.titulo}" otorgado como cortesía.`);
    cerrar();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : cerrar())}>
      <DialogContent className="w-[420px]">
        <DialogHeader>
          <DialogTitle>Ofrecer curso de cortesía</DialogTitle>
          {!cursoElegido && <DialogDescription>Elige el curso que quieres otorgar sin costo.</DialogDescription>}
        </DialogHeader>

        {error && (
          <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
            {error}
          </div>
        )}

        {!cursoElegido && (
          <div className="flex max-h-[280px] flex-col gap-2 overflow-y-auto">
            {cursos.length === 0 && (
              <p className="text-sm text-uva-text-faint">El usuario ya tiene acceso a todos los cursos.</p>
            )}
            {cursos.map((curso) => (
              <button
                key={curso.id}
                type="button"
                onClick={() => setCursoElegido(curso)}
                className={cn(
                  "w-full rounded-uva-md border border-uva-divider bg-uva-surface px-4 py-2.5 text-left text-[13.5px] font-semibold text-uva-text hover:bg-uva-hover",
                )}
              >
                {curso.titulo}
              </button>
            ))}
          </div>
        )}

        {cursoElegido && (
          <p className="text-sm text-uva-text-muted">
            ¿Otorgar <span className="text-uva-accent-text">{cursoElegido.titulo}</span> como cortesía a este
            usuario?
          </p>
        )}

        <DialogFooter>
          {cursoElegido && (
            <Button type="button" variant="outline" onClick={() => setCursoElegido(null)} disabled={pending}>
              Volver
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={cerrar} disabled={pending}>
            Cancelar
          </Button>
          {cursoElegido && (
            <Button type="button" variant="primary" onClick={confirmar} disabled={pending}>
              {pending ? "Otorgando…" : "Confirmar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
