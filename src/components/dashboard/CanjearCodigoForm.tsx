"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MensajeError } from "@/components/auth/MensajeError";
import { canjearCodigoInvitacion } from "@/actions/codigos-invitacion/canjear";
import {
  formatearCodigoMientrasEscribe,
  normalizarCodigo,
  normalizarCodigoPegado,
} from "@/lib/codigoInvitacion";
import { urlWhatsapp } from "@/lib/contacto";
import { logErrorDelCliente } from "@/lib/reportar-cliente";
import { avisarPestanas } from "@/lib/sesion/pestanas";

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
export function CanjearCodigoForm({
  tieneSuscripcion,
  embebido = false,
  alCanjear,
  sinEncabezado = false,
  apilado = false,
}: {
  tieneSuscripcion: boolean;
  /**
   * Se llama después de un canje correcto. Sin esto, el formulario solo
   * refresca la página; /canjear lo usa para pasar a la bienvenida.
   */
  alCanjear?: () => void;
  /**
   * `true` cuando la pantalla que lo contiene ya trae el título y la
   * explicación (/canjear): se omiten aquí para no repetirlos.
   */
  sinEncabezado?: boolean;
  /**
   * `true` en el recorrido de acceso (/canjear): campo y botón a todo el
   * ancho, uno debajo del otro, y el error debajo del campo, como en el
   * login. En «Mi suscripción» van en una fila, con el error arriba.
   */
  apilado?: boolean;
  /**
   * `true` cuando esto ya vive DENTRO de otra sección con su propio
   * encabezado — hoy, "¿Cómo quieres recuperar el acceso?" en
   * SuscripcionContent. Baja el título a `h3`, el nivel que le corresponde
   * bajo el de la sección.
   */
  embebido?: boolean;
}) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ofrecerInvitacion, setOfrecerInvitacion] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);
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

  function handleCodigoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const valorCrudo = event.target.value;

    // Entró más de un carácter de golpe sin pasar por `onPaste`: autocompletar,
    // dictado o el menú de pegar de algunos teclados. Se trata como un pegado.
    if (valorCrudo.length > codigo.length + 1) {
      setCodigo(normalizarCodigoPegado(valorCrudo));
      return;
    }

    const sinGuionesAnterior = codigo.replace(/-/g, "");
    let sinGuionesNuevo = valorCrudo.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // Backspace justo sobre un guion: el valor crudo se acorta pero el
    // guion no formaba parte del contenido real, así que el contenido
    // "limpio" queda igual y el input parece no reaccionar. Se interpreta
    // como "borra también el caracter anterior al guion".
    if (valorCrudo.length < codigo.length && sinGuionesNuevo === sinGuionesAnterior) {
      sinGuionesNuevo = sinGuionesNuevo.slice(0, -1);
    }

    setCodigo(formatearCodigoMientrasEscribe(sinGuionesNuevo));
  }

  // Se pega tal como llegó (WhatsApp, correo): sin espacios, en minúsculas,
  // con o sin "UVA". Se hace aquí y no en `onChange` porque solo con el texto
  // pegado completo se sabe si falta el prefijo.
  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pegado = event.clipboardData.getData("text");
    if (!pegado) return;
    event.preventDefault();
    setCodigo(normalizarCodigoPegado(pegado));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setOfrecerInvitacion(false);

    // Se normaliza también en el cliente para que un pegado con espacios o
    // en minúsculas no se lea como "código inválido".
    // Si la llamada no llega al servidor (se cayó la red) lanza en vez de
    // devolver `{ error }`: sin esto el botón se queda en "Canjeando…".
    let resultado: Awaited<ReturnType<typeof canjearCodigoInvitacion>>;
    try {
      resultado = await canjearCodigoInvitacion(normalizarCodigo(codigo));
    } catch (fallo) {
      logErrorDelCliente("CanjearCodigoForm", "el canje no llegó al servidor", fallo);
      resultado = { error: "No pudimos conectar. Revisa tu conexión e intenta de nuevo." };
    }
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      setOfrecerInvitacion(Boolean(resultado.ofrecerInvitacion));
      // El lector de pantalla lee el campo con su mensaje, y quien teclea
      // puede corregir sin buscar el campo.
      campoRef.current?.focus();
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
    // Otras pestañas con un curso bloqueado o "sin acceso" se refrescan solas.
    avisarPestanas({ tipo: "acceso-cambio" });
    alCanjear?.();
  }

  // Capitalizada para que JSX la trate como componente y no como etiqueta
  // literal. El nivel depende de si hay un encabezado de sección por encima.
  const Titulo = (embebido ? "h3" : "h2") as "h2" | "h3";

  const detalleError = (
    <>
      {error}
      {bloqueado && (
        <span className="block mt-0.5 font-medium">
          Podrás volver a intentar en {formatearEspera(segundosRestantes!)}.
        </span>
      )}
      {ofrecerInvitacion && (
        <a
          href={urlWhatsapp("Hola, necesito una invitación nueva para entrar a U.V.A.")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block min-h-11 py-2.5 font-bold underline underline-offset-4"
        >
          Pedir otra invitación
          <span className="sr-only"> (abre WhatsApp en otra pestaña)</span>
        </a>
      )}
    </>
  );

  const contenido = (
    <>
      {!sinEncabezado && (
        <>
      <Titulo
        className={cn(
          "flex items-center gap-2.5 font-extrabold text-uva-text",
          embebido ? "text-uva-cuerpo" : "text-uva-titulo-4",
        )}
      >
        <Ticket className="size-5 text-uva-accent-ink" strokeWidth={1.8} aria-hidden />
        {tieneSuscripcion ? "¿Tienes un código?" : "¿Tienes un código de invitación?"}
      </Titulo>
      <p className="mt-2 max-w-[56ch] text-uva-cuerpo text-uva-text-muted">
        {tieneSuscripcion
          ? "Canjéalo y recuperas el acceso, sin ningún cobro."
          : "Canjéalo aquí y tendrás acceso completo al catálogo, sin ningún cobro."}
      </p>

        </>
      )}

      <form onSubmit={handleSubmit} className={cn("flex flex-col gap-3.5", !sinEncabezado && "mt-4")}>
        {error && !apilado && (
          <div
            id="codigo-error"
            role="alert"
            className="max-w-[56ch] rounded-uva-md bg-uva-error-soft px-3.5 py-3 text-uva-cuerpo font-semibold text-uva-error-text"
          >
            {detalleError}
          </div>
        )}

        <div>
          <Label htmlFor="codigo-invitacion" className="mb-1.5 text-uva-cuerpo font-semibold text-uva-text">
            Código
          </Label>
          <div className={apilado ? "grid grid-cols-1 gap-3" : "flex flex-wrap items-center gap-2.5"}>
            <Input
              id="codigo-invitacion"
              value={codigo}
              onChange={handleCodigoChange}
              placeholder="UVA-K7M2-QP4X"
              // `characters`: el código es alfanumérico y sin palabras, así
              // que la autocorrección del móvil solo estorba.
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              ref={campoRef}
              onPaste={handlePaste}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "codigo-error" : undefined}
              className={cn(
                "h-13 border-[1.5px] border-uva-line-strong font-codigo text-uva-titulo-4 font-bold tracking-[0.08em] uppercase placeholder:font-medium placeholder:text-uva-text-muted sm:text-uva-titulo-4",
                apilado ? "w-full" : "w-[min(100%,260px)]",
              )}
              disabled={bloqueado}
              required
            />
            {error && apilado && <MensajeError id="codigo-error">{detalleError}</MensajeError>}
            <Button
              type="submit"
              variant="uva-primary"
              size="uva"
              className={apilado ? "h-12 text-uva-cuerpo" : "min-h-13 w-auto px-[22px] text-base"}
              disabled={pending || bloqueado || codigo.trim() === ""}
            >
              {pending ? "Canjeando…" : bloqueado ? "Bloqueado" : "Canjear código"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );

  // Sin marco propio: quien lo coloca decide la sección (una raya arriba en
  // «Mi suscripción»), no el formulario.
  return <div>{contenido}</div>;
}
