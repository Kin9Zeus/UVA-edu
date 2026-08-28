"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canjearCodigoInvitacion } from "@/actions/codigos-invitacion/canjear";
import { normalizarCodigo } from "@/lib/codigoInvitacion";

function formatearEspera(segundos: number): string {
  const minutos = Math.ceil(segundos / 60);
  if (minutos <= 1) return "menos de un minuto";
  if (minutos < 60) return `${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

/**
 * Canje de un código de invitación desde "Mi suscripción".
 *
 * Requiere sesión: el Server Action saca el usuario de `auth.getUser()` en
 * el servidor y jamás de un id que mande el cliente
 * (src/actions/codigos-invitacion/canjear.ts).
 *
 * Tras un canje correcto se llama a `router.refresh()`: el Server Component
 * de la página vuelve a consultar la suscripción y la pantalla pasa sola de
 * "no tienes suscripción" a mostrar el plan recién otorgado, sin recargar
 * ni navegar a otro sitio.
 */
export function CanjearCodigoForm({ tieneSuscripcion }: { tieneSuscripcion: boolean }) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Segundos que faltan para poder reintentar tras el rate limit (P2-2).
  // null = sin bloqueo activo.
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);
  const router = useRouter();

  // Cuenta regresiva de un segundo en segundo mientras dure el bloqueo.
  // Al llegar a 0 se limpia sola y el formulario vuelve a habilitarse.
  useEffect(() => {
    if (segundosRestantes === null || segundosRestantes <= 0) return;
    const id = setTimeout(() => {
      setSegundosRestantes((s) => (s !== null && s > 1 ? s - 1 : null));
    }, 1000);
    return () => clearTimeout(id);
  }, [segundosRestantes]);

  const bloqueado = segundosRestantes !== null && segundosRestantes > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    // Se normaliza también en el cliente para que un pegado con espacios o
    // en minúsculas no se lea como "código inválido".
    const resultado = await canjearCodigoInvitacion(normalizarCodigo(codigo));
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      // Solo viene presente cuando el rechazo fue por rate limit: deja el
      // formulario deshabilitado hasta que expire, en vez de dejar que
      // seguir dando clic muestre el mismo error una y otra vez.
      if (typeof resultado.segundosEspera === "number") {
        setSegundosRestantes(resultado.segundosEspera);
      }
      return;
    }

    setCodigo("");
    router.refresh();
  }

  return (
    <div className="rounded-uva-md border border-uva-divider bg-uva-surface p-6">
      <h2 className="flex items-center gap-2 text-base text-uva-text">
        <Ticket className="size-4 text-uva-accent" aria-hidden />
        {tieneSuscripcion ? "Reactivar con un código" : "¿Tienes un código de invitación?"}
      </h2>
      <p className="mt-1 text-[13px] text-uva-text-muted">
        {tieneSuscripcion
          ? "Tu suscripción anterior terminó. Si tienes un código, canjéalo para recuperar el acceso."
          : "Canjéalo aquí y tendrás acceso completo al catálogo, sin ningún cobro."}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        {error && (
          <div
            role="alert"
            className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text"
          >
            {error}
            {bloqueado && (
              <span className="block mt-0.5 font-medium">
                Podrás volver a intentar en {formatearEspera(segundosRestantes!)}.
              </span>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="codigo-invitacion">Código</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="codigo-invitacion"
              value={codigo}
              onChange={(event) => setCodigo(event.target.value)}
              placeholder="UVA-K7M2-QP4X"
              // `characters`: el código es alfanumérico y sin palabras, así
              // que la autocorrección del móvil solo estorba.
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="max-w-[220px] font-mono tracking-[0.08em] uppercase"
              disabled={bloqueado}
              required
            />
            <Button
              type="submit"
              variant="uva-primary"
              size="uva"
              className="w-auto px-5"
              disabled={pending || bloqueado || codigo.trim() === ""}
            >
              {pending ? "Canjeando…" : bloqueado ? "Bloqueado" : "Canjear"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
