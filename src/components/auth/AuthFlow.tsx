"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegistroForm } from "@/components/auth/RegistroForm";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { ReenviarVerificacion } from "@/components/auth/ReenviarVerificacion";
import { NivelObra, POSICION_NIVEL } from "@/components/auth/NivelObra";
import { MensajeError } from "@/components/auth/MensajeError";
import { FichaOk } from "@/components/auth/FichaOk";
import { AvisoAcceso } from "@/components/auth/AvisoAcceso";
import { AccesoMarco } from "@/components/auth/AccesoMarco";
import { RegistroMarco } from "@/components/auth/RegistroMarco";
import {
  CarneVistaPrevia,
  type DatosCarne,
} from "@/components/auth/CarneVistaPrevia";
import {
  ACCESO_BOTON,
  ACCESO_ENLACE,
  ACCESO_INPUT,
  ACCESO_LABEL,
  ACCESO_NOTA,
  ACCESO_SUBTITULO,
  ACCESO_TITULO,
} from "@/components/auth/acceso";
import { checkEmail } from "@/actions/auth/check-email";
import { escucharPestanas, mismoCorreo } from "@/lib/sesion/pestanas";

type Step =
  | "email"
  | "login"
  | "signup"
  | "oauth"
  | "both"
  | "confirmar"
  | "pendiente";

const STEP_COPY: Record<Step, { title: string; subtitle: string }> = {
  email: {
    title: "Inicia sesión o crea tu cuenta",
    subtitle: "Retoma tus cursos donde los dejaste.",
  },
  login: {
    title: "Ingresa a tu cuenta",
    subtitle: "Escribe tu contraseña para continuar.",
  },
  signup: {
    title: "Vamos a crear tu cuenta",
    subtitle: "Completa tus datos para tu cuenta nueva.",
  },
  oauth: {
    title: "¡Hola de nuevo!",
    subtitle: "Esta cuenta entra con Google.",
  },
  both: {
    title: "Ingresa a tu cuenta",
    subtitle: "Puedes continuar con Google o con tu contraseña.",
  },
  confirmar: {
    title: "¡Ya casi!",
    subtitle: "Creamos tu cuenta. Revisa tu correo y confírmala para poder iniciar sesión.",
  },
  pendiente: {
    title: "Verifica tu correo",
    subtitle: "Tu cuenta está creada, pero falta confirmar tu correo para entrar.",
  },
};

/**
 * Mensajes para el `?error=` que agregan los redirects de enlaces de correo
 * fallidos: token ya usado, vencido, o simplemente inválido —
 * verifyOtp()/exchangeCodeForSession() no distingue el motivo exacto, así
 * que los tres caen en el mismo código (auth/confirm/route.ts,
 * actualizar-password/page.tsx, auth/callback/route.ts). Antes de esto
 * `?error=enlace_invalido` no se leía en ningún lado y el usuario caía en
 * /login sin ninguna explicación (docs/qa/bugs-e2e.md, BUG-001).
 */
const MENSAJES_ERROR_QUERY: Record<string, string> = {
  enlace_invalido: "Ese enlace ya no es válido o ya venció. Pide uno nuevo.",
};

/** Con el celular girado, el formulario ocupa la columna derecha entera. */
const COLUMNA_FORMULARIO =
  "apaisado:col-start-2 apaisado:row-span-2 apaisado:row-start-1";

export function AuthFlow({
  redirectTo,
  initialEmail,
  initialError,
}: {
  redirectTo: string;
  initialEmail?: string;
  initialError?: string;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(
    initialError ? (MENSAJES_ERROR_QUERY[initialError] ?? null) : null,
  );
  // Lo que el carné de la vista previa muestra mientras se crea la cuenta;
  // se conserva en "¡Ya casi!" para que el carné siga con el nombre puesto.
  const [carne, setCarne] = useState<DatosCarne>({
    nombre: "",
    correo: "",
    password: "",
  });

  async function runCheckEmail(correo: string) {
    setCheckError(null);
    setChecking(true);

    const result = await checkEmail(correo);

    setChecking(false);

    if ("error" in result) {
      setCheckError(result.error);
      return;
    }

    if (!result.exists) {
      setCarne({ nombre: "", correo, password: "" });
      setStep("signup");
    } else if (result.provider === "both") {
      setStep("both");
    } else if (result.provider === "google") {
      setStep("oauth");
    } else {
      setStep("login");
    }
  }

  function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runCheckEmail(email);
  }

  // Viene de confirmar el correo (registro.ts / reenviar-verificacion.ts
  // agregan ?email= al redirect): salta directo al paso de contraseña en
  // vez de obligar a volver a escribir el correo. Se difiere a un
  // microtask para que el primer setState de runCheckEmail no corra de
  // forma síncrona dentro del efecto (evita el cascading-render que marca
  // react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!initialEmail) return;
    queueMicrotask(() => runCheckEmail(initialEmail));
  }, [initialEmail]);

  function handleCambiar() {
    setStep("email");
    setCheckError(null);
  }

  function handleCrearCuenta() {
    setCheckError(null);
    setCarne({ nombre: "", correo: email, password: "" });
    setStep("signup");
  }

  function handleCuentaCreada(correo: string) {
    setEmail(correo);
    setCarne((actual) => ({ ...actual, correo }));
    setStep("confirmar");
  }

  // "¿Te equivocaste de correo?": vuelve a los datos sin perder el nombre.
  function handleCorregirCorreo() {
    setCarne((actual) => ({ ...actual, password: "" }));
    setStep("signup");
  }

  function handlePendienteVerificacion() {
    setStep("pendiente");
  }

  // "¡Ya casi!" y "Verifica tu correo" esperan un enlace que se abre en otra
  // pestaña. Cuando ahí se confirma este mismo correo, esta pantalla salta
  // sola al paso de contraseña en vez de quedarse esperando.
  const [confirmadoEnOtraPestana, setConfirmadoEnOtraPestana] = useState(false);
  const esperandoConfirmacion = step === "confirmar" || step === "pendiente";
  useEffect(() => {
    if (!esperandoConfirmacion) return;
    return escucharPestanas((aviso) => {
      if (aviso.tipo === "correo-confirmado" && mismoCorreo(aviso.correo, email)) {
        setConfirmadoEnOtraPestana(true);
        setStep("login");
      }
    });
  }, [esperandoConfirmacion, email]);

  // Al cambiar de paso el contenido se reemplaza entero: sin esto el foco
  // queda en un botón que ya no existe y el lector de pantalla no anuncia
  // nada. Se salta el primer render para no robar el foco al entrar.
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const pasoInicial = useRef(true);
  useEffect(() => {
    if (pasoInicial.current) {
      pasoInicial.current = false;
      return;
    }
    tituloRef.current?.focus();
  }, [step]);

  const { title, subtitle } = STEP_COPY[step];

  // `subtituloClase`: el registro es más alto que el login; en una pantalla
  // muy baja su subtítulo queda solo para el lector de pantalla.
  const encabezado = (className: string, subtituloClase = "") => (
    <div className={`grid grid-cols-1 gap-2 bajo:gap-1 ${className}`}>
      <h1 ref={tituloRef} tabIndex={-1} className={ACCESO_TITULO}>
        {title}
      </h1>
      <p className={`${ACCESO_SUBTITULO} ${subtituloClase}`}>{subtitle}</p>
    </div>
  );

  // Crear cuenta y "¡Ya casi!": pantalla partida con el carné (Crear cuenta
  // lab 6, "Carné").
  if (step === "signup" || step === "confirmar") {
    return (
      <RegistroMarco
        carne={
          <CarneVistaPrevia
            nombre={carne.nombre}
            correo={carne.correo}
            password={carne.password}
            sello={step === "confirmar" ? "pendiente" : null}
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 bajo:gap-3">
          {encabezado("", "muy-bajo:sr-only")}

          {step === "signup" && (
            <div className="grid grid-cols-1 gap-1">
              <RegistroForm
                email={email}
                nombreInicial={carne.nombre}
                redirectTo={redirectTo}
                onCuentaCreada={handleCuentaCreada}
                onCambio={setCarne}
              />
              <p className="text-uva-detalle text-uva-text-muted">
                ¿Ya tienes cuenta?{" "}
                <button
                  type="button"
                  onClick={handleCambiar}
                  className={ACCESO_ENLACE}
                >
                  Inicia sesión
                </button>
              </p>
            </div>
          )}

          {step === "confirmar" && (
            <div className="grid grid-cols-1 gap-3">
              <AvisoAcceso icono="ok">
                Te enviamos un correo de confirmación a{" "}
                <strong className="[overflow-wrap:anywhere]">
                  {email || "tu correo"}
                </strong>
                . Abre el enlace del correo para activar tu cuenta.
              </AvisoAcceso>
              <p className={ACCESO_NOTA}>
                ¿No te llegó? Revisa la carpeta de spam o de promociones.
              </p>
              <ReenviarVerificacion email={email} />
              <p className="text-uva-detalle text-uva-text-muted">
                ¿Te equivocaste de correo?{" "}
                <button
                  type="button"
                  onClick={handleCorregirCorreo}
                  className={ACCESO_ENLACE}
                >
                  Cámbialo
                </button>
              </p>
            </div>
          )}
        </div>
      </RegistroMarco>
    );
  }

  // En pantallas muy bajas se quita: el botón ya dice "Continuar con Google".
  const separador = (
    <div className="flex items-center gap-3 text-uva-detalle text-uva-text-muted muy-bajo:hidden">
      <div className="h-px flex-1 bg-uva-divider" />
      <span className="whitespace-nowrap">o continúa con</span>
      <div className="h-px flex-1 bg-uva-divider" />
    </div>
  );

  const botonGoogle = (
    <GoogleAuthButton
      label="Continuar con Google"
      next={redirectTo}
      className="h-12 text-uva-cuerpo bajo:h-11"
    />
  );

  // Login lab 7, "Nivel plano técnico": el nivel arriba, título y subtítulo
  // alineados a la izquierda y cada error debajo de su campo. El tablero es
  // de 1440×900; aquí la escala baja para que la tarjeta entera quepa en la
  // pantalla de un portátil (1366×650 de área útil) y solo crece desde
  // 1920 px de ancho. Con el celular girado (`apaisado`) no cabe en una
  // columna: el nivel y el título van a la izquierda y el formulario a la
  // derecha.
  return (
    <AccesoMarco>
      <div className="grid grid-cols-1 gap-5 bajo:gap-3 muy-bajo:gap-2.5 apaisado:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] apaisado:content-start apaisado:gap-x-6">
        {/* La burbuja empieza a la izquierda y queda centrada desde que el
            correo está identificado. `zoom` (no `scale`) para que en una
            pantalla muy baja también ocupe menos alto. */}
        <div className="muy-bajo:[zoom:0.85] apaisado:col-start-1 apaisado:row-start-1 apaisado:pt-2">
          <NivelObra posicion={step === "email" ? POSICION_NIVEL.inicio : POSICION_NIVEL.centro} />
        </div>

        {encabezado(
          "apaisado:col-start-1 apaisado:row-start-2 apaisado:content-start",
        )}

        {step === "email" ? (
          // Google y "Crear cuenta" van fuera del <form>, como antes del
          // rediseño: solo el correo y "Continuar" envían.
          <div className={`grid grid-cols-1 gap-3 bajo:gap-2 ${COLUMNA_FORMULARIO}`}>
            <form
              className="grid grid-cols-1 gap-3 bajo:gap-2"
              onSubmit={handleEmailSubmit}
              noValidate
            >
              <div>
                <Label htmlFor="auth-email" className={ACCESO_LABEL}>
                  Correo electrónico
                </Label>
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  placeholder="Ingresa tu correo electrónico"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  aria-describedby={checkError ? "auth-email-error" : undefined}
                  className={ACCESO_INPUT}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              {checkError && (
                <MensajeError id="auth-email-error">{checkError}</MensajeError>
              )}

              <Button
                type="submit"
                variant="uva-primary"
                size="uva"
                disabled={checking}
                className={ACCESO_BOTON}
              >
                {checking ? "Verificando…" : "Continuar"}
              </Button>
            </form>

            <p className="text-uva-detalle text-uva-text-muted">
              ¿No tienes cuenta?{" "}
              <button
                type="button"
                onClick={handleCrearCuenta}
                className={ACCESO_ENLACE}
              >
                Crear cuenta
              </button>
            </p>

            {separador}
            {botonGoogle}
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-3 bajo:gap-2 ${COLUMNA_FORMULARIO}`}>
            {step !== "pendiente" && (
              <div className="flex items-center gap-2.5 border-b border-uva-divider">
                <FichaOk />
                <span className="min-w-0 flex-1 truncate text-uva-detalle font-semibold text-uva-text">
                  {email}
                </span>
                <button
                  type="button"
                  onClick={handleCambiar}
                  className={`shrink-0 ${ACCESO_ENLACE}`}
                >
                  Cambiar
                </button>
              </div>
            )}

            {step === "login" && confirmadoEnOtraPestana && (
              <AvisoAcceso icono="ok">
                Confirmaste tu correo en la otra pestaña. Ya puedes iniciar sesión.
              </AvisoAcceso>
            )}

            {step === "login" && (
              <LoginForm
                email={email}
                redirectTo={redirectTo}
                onPendienteVerificacion={handlePendienteVerificacion}
              />
            )}

            {step === "pendiente" && (
              <>
                <div
                  role="status"
                  className="rounded-uva-md bg-uva-danger-soft px-4 py-3.5 text-center text-uva-detalle text-uva-danger-text"
                >
                  Aún no confirmas {email || "tu correo"}. Revisa tu bandeja o
                  pide un nuevo enlace.
                </div>
                <ReenviarVerificacion email={email} />
              </>
            )}

            {step === "oauth" && botonGoogle}

            {step === "both" && (
              <>
                <LoginForm
                  email={email}
                  redirectTo={redirectTo}
                  onPendienteVerificacion={handlePendienteVerificacion}
                />
                {separador}
                {botonGoogle}
              </>
            )}
          </div>
        )}
      </div>
    </AccesoMarco>
  );
}
