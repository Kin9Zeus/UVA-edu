"use client";

import { registrarEvento } from "@/lib/analitica";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { LARGO_MAXIMO_NOMBRE } from "@/lib/nombre";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { MensajeError } from "@/components/auth/MensajeError";
import { VerificacionTurnstile } from "@/components/auth/VerificacionTurnstile";
import { ReglasPassword } from "@/components/auth/ReglasPassword";
import type { DatosCarne } from "@/components/auth/CarneVistaPrevia";
import {
  ACCESO_BOTON,
  ACCESO_INPUT,
  ACCESO_LABEL,
} from "@/components/auth/acceso";
import { isPasswordValid } from "@/lib/password";
import { registro, type RegistroState } from "@/actions/auth/registro";
import { CASILLAS_LEGALES, MENSAJE_FALTAN_CASILLAS } from "@/lib/legal/consentimiento";

type CasillaLegalNombre = (typeof CASILLAS_LEGALES)[number];

/**
 * Formulario de crear cuenta (Crear cuenta lab 6, "Carné"). Nombre, correo y
 * contraseña son controlados para que el carné de la vista previa se llene
 * mientras se escribe (`onCambio`). En un PC bajo (`escritorio-bajo`) los
 * campos van de a dos por fila y la lista de reglas pasa debajo de las dos
 * contraseñas, para que todo quepa sin scroll; el orden del DOM (y del
 * teclado) no cambia, solo el visual.
 */
export function RegistroForm({
  email,
  nombreInicial = "",
  redirectTo,
  onCuentaCreada,
  onCambio,
}: {
  email: string;
  /** Nombre ya escrito, al volver desde "¿Te equivocaste de correo?". */
  nombreInicial?: string;
  redirectTo: string;
  onCuentaCreada?: (email: string) => void;
  onCambio?: (datos: DatosCarne) => void;
}) {
  const [correo, setCorreo] = useState(email);
  const [nombre, setNombre] = useState(nombreInicial);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [casillas, setCasillas] = useState<Record<CasillaLegalNombre, boolean>>({
    terminos: false,
    "datos-personales": false,
    "mayoria-de-edad": false,
  });
  const aceptaTodo = CASILLAS_LEGALES.every((casilla) => casillas[casilla]);
  const marcar = (name: CasillaLegalNombre, marcada: boolean) =>
    setCasillas((antes) => ({ ...antes, [name]: marcada }));
  const [registroState, formAction, pending] = useActionState<
    RegistroState,
    FormData
  >(registro, null);

  const passwordValid = isPasswordValid(password);
  const passwordsMatch = password.length > 0 && password === password2;
  const noCoinciden = password2.length > 0 && !passwordsMatch;
  const canSubmit = passwordValid && passwordsMatch && aceptaTodo;

  function cambiar(datos: Partial<DatosCarne>) {
    onCambio?.({ nombre, correo, password, ...datos });
  }

  useEffect(() => {
    if (registroState?.needsConfirmation) {
      registrarEvento("registro_completado", { metodo: "correo" });
      onCuentaCreada?.(registroState.email);
    }
  }, [registroState, onCuentaCreada]);

  if (registroState?.needsConfirmation) {
    return null;
  }

  return (
    <form
      className="grid grid-cols-1 gap-2.5 bajo:gap-2 escritorio-bajo:grid-cols-2 escritorio-bajo:gap-x-4"
      action={formAction}
    >
      <input type="hidden" name="redirect" value={redirectTo} />

      <div>
        <Label htmlFor="reg-email" className={ACCESO_LABEL}>
          Correo electrónico
        </Label>
        <Input
          id="reg-email"
          name="email"
          type="email"
          placeholder="Ingresa tu correo electrónico"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={correo}
          onChange={(event) => {
            setCorreo(event.target.value);
            cambiar({ correo: event.target.value });
          }}
          required
          className={ACCESO_INPUT}
        />
      </div>

      <div>
        <Label htmlFor="reg-nombre" className={ACCESO_LABEL}>
          Nombre completo
        </Label>
        <Input
          id="reg-nombre"
          name="nombre"
          placeholder="Tu nombre y apellido"
          autoComplete="name"
          maxLength={LARGO_MAXIMO_NOMBRE}
          value={nombre}
          onChange={(event) => {
            setNombre(event.target.value);
            cambiar({ nombre: event.target.value });
          }}
          required
          className={ACCESO_INPUT}
        />
      </div>

      <div>
        <Label htmlFor="reg-pass" className={ACCESO_LABEL}>
          Contraseña
        </Label>
        <PasswordInput
          inputClassName={ACCESO_INPUT}
          id="reg-pass"
          name="password"
          placeholder="Mínimo 10 caracteres"
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            cambiar({ password: event.target.value });
          }}
          required
          alternar="texto"
          describedBy="reg-reglas"
        />
      </div>

      {/* En una columna va justo debajo de la contraseña; en `escritorio-bajo`
          pasa debajo de las dos contraseñas, a todo el ancho. */}
      <ReglasPassword
        id="reg-reglas"
        password={password}
        className="-mt-1 escritorio-bajo:order-1 escritorio-bajo:col-span-2 escritorio-bajo:mt-0"
      />

      <div>
        <Label htmlFor="reg-pass2" className={ACCESO_LABEL}>
          Repite la contraseña
        </Label>
        <PasswordInput
          inputClassName={ACCESO_INPUT}
          id="reg-pass2"
          name="password2"
          placeholder="Debe coincidir"
          autoComplete="new-password"
          value={password2}
          onChange={(event) => setPassword2(event.target.value)}
          required
          alternar="texto"
          invalid={noCoinciden}
          describedBy={noCoinciden ? "reg-pass2-error" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-2.5 bajo:gap-2 escritorio-bajo:order-2 escritorio-bajo:col-span-2">
        {noCoinciden && (
          <MensajeError id="reg-pass2-error">Las contraseñas no coinciden.</MensajeError>
        )}

        {/* Tres casillas separadas (P1-5, AUDIT-2026-11-23): la autorización
            de datos no puede ir amarrada a los términos. Los `name` son los de
            CASILLAS_LEGALES, que la acción exige. */}
        <fieldset className="grid gap-0">
          <legend className="sr-only">Autorizaciones para crear tu cuenta</legend>
          <CasillaLegal name="terminos" marcada={casillas.terminos} onCambio={marcar}>
            Acepto los{" "}
            <EnlaceLegal href="/soporte?tema=terminos">Términos y condiciones</EnlaceLegal>.
          </CasillaLegal>
          <CasillaLegal name="datos-personales" marcada={casillas["datos-personales"]} onCambio={marcar}>
            Autorizo el tratamiento de mis datos personales según la{" "}
            <EnlaceLegal href="/soporte?tema=privacidad">Política de tratamiento de datos</EnlaceLegal>.
          </CasillaLegal>
          <CasillaLegal name="mayoria-de-edad" marcada={casillas["mayoria-de-edad"]} onCambio={marcar}>
            Confirmo que soy mayor de 18 años.
          </CasillaLegal>
        </fieldset>

        <VerificacionTurnstile reiniciarCon={registroState} accion="registro" />

        {registroState?.error && (
          <MensajeError id="reg-error">{registroState.error}</MensajeError>
        )}

        <Button
          type="submit"
          variant="uva-primary"
          size="uva"
          disabled={!canSubmit || pending}
          aria-describedby={aceptaTodo ? undefined : "reg-terminos-ayuda"}
          className={`${ACCESO_BOTON} disabled:border-uva-divider disabled:bg-uva-chip disabled:text-uva-text-muted disabled:opacity-100`}
        >
          {pending ? "Creando cuenta…" : "Crear mi cuenta"}
        </Button>
        {/* El botón deshabilitado no recibe foco con Tab: sin este texto quien
            navega con teclado no sabe por qué no puede avanzar. */}
        {!aceptaTodo && (
          <p id="reg-terminos-ayuda" className="text-uva-detalle text-uva-text-muted">
            {MENSAJE_FALTAN_CASILLAS}
          </p>
        )}
      </div>
    </form>
  );
}

/** El <label> entero es el área táctil (44 px de alto); la casilla nativa
 * conserva Espacio para marcarla y el foco visible global. */
function CasillaLegal({
  name,
  marcada,
  onCambio,
  children,
}: {
  name: CasillaLegalNombre;
  marcada: boolean;
  onCambio: (name: CasillaLegalNombre, marcada: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={`reg-${name}`}
      className="flex min-h-11 items-center gap-2.5 text-uva-detalle text-uva-text-muted"
    >
      <input
        id={`reg-${name}`}
        name={name}
        type="checkbox"
        required
        checked={marcada}
        onChange={(event) => onCambio(name, event.target.checked)}
        className="size-4 shrink-0 accent-uva-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
      />
      <span>{children}</span>
    </label>
  );
}

/** Lleva a /soporte?tema=…, que ya redirige al texto legal publicado cuando
 * NEXT_PUBLIC_LEGAL_ENABLED está encendida (lib/legal/redireccion-soporte.ts). */
function EnlaceLegal({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-uva-accent-ink underline underline-offset-3" target="_blank">
      {children}
    </Link>
  );
}
