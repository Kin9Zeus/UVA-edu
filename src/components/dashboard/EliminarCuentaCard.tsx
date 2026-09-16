"use client";

import { useActionState, useState } from "react";
import { TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { eliminarMiCuenta, type EliminarCuentaState } from "@/actions/perfil/eliminar-cuenta";

/**
 * "Zona de peligro" de Mi perfil (P2-11, AUDIT-2026-09-15.md). Diálogo
 * propio en vez de reutilizar `ConfirmDialog` (src/components/admin/
 * ConfirmDialog.tsx): esta confirmación necesita un segundo campo
 * (contraseña) y mostrar el error específico del servidor (p. ej.
 * "contraseña incorrecta"), que ese componente no contempla.
 */
export function EliminarCuentaCard({
  correo,
  tienePassword,
}: {
  correo: string;
  tienePassword: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<EliminarCuentaState, FormData>(
    eliminarMiCuenta,
    null,
  );
  const [correoEscrito, setCorreoEscrito] = useState("");

  const correoCoincide = correoEscrito.trim().toLowerCase() === correo.toLowerCase();

  return (
    <div className="flex flex-col gap-[18px] rounded-uva-md border border-uva-danger-soft bg-uva-surface p-6">
      <h2 className="flex items-center gap-2 text-base text-uva-text">
        <TriangleAlert className="size-4 text-uva-danger-text" aria-hidden />
        Eliminar cuenta
      </h2>
      <p className="text-sm text-uva-text-muted">
        Suprime tus datos personales de la plataforma (nombre, correo,
        celular, foto, comentarios y publicaciones) y cierra tu sesión en
        todas partes. No se puede deshacer. El registro de pagos se
        conserva por obligación legal/contable, ya sin tu nombre asociado.
        Los certificados que hayas obtenido siguen siendo válidos y
        conservan el nombre con el que se emitieron, para que cualquiera
        pueda seguir verificándolos con su código — ver{" "}
        <a href="/soporte" className="text-uva-accent-text underline underline-offset-2">
          nuestra política de datos
        </a>
        .
      </p>

      <div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="w-auto"
          onClick={() => setOpen(true)}
        >
          Eliminar mi cuenta
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[400px]">
          <DialogHeader>
            <DialogTitle>Eliminar tu cuenta</DialogTitle>
            <DialogDescription>
              Esta acción es irreversible. Confirma que sos vos.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="flex flex-col gap-3.5">
            {state?.error && (
              <div
                role="alert"
                className="rounded-uva-md bg-uva-danger-soft px-3.5 py-2.5 text-sm text-uva-danger-text"
              >
                {state.error}
              </div>
            )}

            <div>
              <Label htmlFor="eliminar-cuenta-correo">
                Escribe <span className="font-semibold text-uva-text">{correo}</span> para confirmar
              </Label>
              <Input
                id="eliminar-cuenta-correo"
                name="correo_confirmacion"
                autoComplete="off"
                value={correoEscrito}
                onChange={(event) => setCorreoEscrito(event.target.value)}
                required
              />
            </div>

            {tienePassword && (
              <div>
                <Label htmlFor="eliminar-cuenta-password">Contraseña actual</Label>
                <PasswordInput
                  id="eliminar-cuenta-password"
                  name="password_actual"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={pending || !correoCoincide}>
                {pending ? "Eliminando…" : "Eliminar mi cuenta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
