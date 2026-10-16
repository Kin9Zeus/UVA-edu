import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { AvisoAcceso } from "@/components/auth/AvisoAcceso";
import { CarneVistaPrevia } from "@/components/auth/CarneVistaPrevia";
import { RegistroMarco } from "@/components/auth/RegistroMarco";
import { ReenviarVerificacion } from "@/components/auth/ReenviarVerificacion";
import {
  ACCESO_BOTON,
  ACCESO_ENLACE,
  ACCESO_NOTA,
  ACCESO_SUBTITULO,
  ACCESO_TITULO,
} from "@/components/auth/acceso";
import { Button, buttonVariants } from "@/components/ui/button";
import { confirmarEnlace } from "@/actions/auth/confirmar-enlace";
import {
  COOKIE_CORREO_CONFIRMADO,
  esEnlaceDeRegistro,
  leerCorreoConfirmado,
} from "@/lib/correo-confirmado";
import { destinoInternoSeguro } from "@/lib/redirect-seguro";

export const metadata: Metadata = {
  title: "U.V.A. — Confirmar",
};

/**
 * Correo que trae el enlace: como parámetro propio (`&email=`, plantilla de
 * SMTP) o dentro de `next` (`/login?signout=1&email=…`, el que arma
 * registro.ts y reenvía el webhook de correo). `next` puede llegar absoluto.
 */
function correoDelEnlace(email: string | undefined, next: string | undefined): string {
  if (email?.trim()) return email.trim();
  if (!next) return "";
  try {
    return new URL(next, "http://enlace.invalid").searchParams.get("email")?.trim() ?? "";
  } catch {
    return "";
  }
}

/** Destino de "Iniciar sesión": el `next` seguro, con el correo para saltar al paso de contraseña. */
function destinoLogin(next: string | undefined, correo: string): string {
  const destino = new URL(destinoInternoSeguro(next, "/login"), "http://destino.invalid");
  if (correo && !destino.searchParams.has("email")) destino.searchParams.set("email", correo);
  return `${destino.pathname}${destino.search}`;
}

export default async function ConfirmarEnlacePage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    token_hash?: string;
    type?: string;
    next?: string;
    email?: string;
    estado?: string;
  }>;
}) {
  const { code, token_hash: tokenHash, type, next, email, estado } = await searchParams;

  // Registro confirmado (confirmarEnlace dejó la cookie). Sin cookie no hay
  // "¡Correo confirmado!": alguien escribió la URL a mano, o ya venció.
  if (estado === "confirmada") {
    const confirmado = leerCorreoConfirmado(
      (await cookies()).get(COOKIE_CORREO_CONFIRMADO)?.value,
    );
    const login = destinoLogin(next, confirmado?.correo ?? "");
    if (!confirmado) redirect(login);

    return (
      <PantallaCorreo
        carne={{ nombre: confirmado.nombre || null, correo: confirmado.correo, sello: "confirmado" }}
        titulo="¡Correo confirmado!"
        subtitulo="Te damos la bienvenida a U.V.A. Tu carné ya está activo."
      >
        <AvisoAcceso icono="ok">
          Confirmamos <strong className="[overflow-wrap:anywhere]">{confirmado.correo}</strong>. Tu
          cuenta quedó activa.
        </AvisoAcceso>
        {/* Un enlace, no un botón: es navegación (un Button con `render`
            se anuncia como botón). */}
        <Link
          href={login}
          className={buttonVariants({ variant: "uva-primary", size: "uva", className: ACCESO_BOTON })}
        >
          Iniciar sesión
        </Link>
        <p className={ACCESO_NOTA}>Entra con el correo y la contraseña que acabas de crear.</p>
      </PantallaCorreo>
    );
  }

  const correo = correoDelEnlace(email, next);

  // El enlace de registro no sirvió (vencido o ya usado): pedir uno nuevo.
  if (estado === "vencido") {
    return (
      <PantallaCorreo
        carne={{ nombre: null, correo, sello: "pendiente" }}
        titulo="Este enlace ya venció"
        subtitulo="Por seguridad, los enlaces de confirmación vencen y se usan una sola vez. Pide uno nuevo y te llega en unos minutos."
      >
        <AvisoAcceso icono="alerta">El enlace que abriste ya no sirve: venció o ya se usó.</AvisoAcceso>
        <ReenviarVerificacion
          email={correo}
          variante="primario"
          etiqueta="Enviarme un enlace nuevo"
        />
        <p>
          <Link href="/login" className={ACCESO_ENLACE}>
            Volver a iniciar sesión
          </Link>
        </p>
      </PantallaCorreo>
    );
  }

  // Enlace de registro recién abierto: el clic que lo verifica. El botón
  // existe para que un escáner de enlaces (que solo hace GET) no lo consuma
  // antes que la persona; ver actions/auth/confirmar-enlace.ts.
  if (esEnlaceDeRegistro(type)) {
    return (
      <PantallaCorreo
        carne={{ nombre: null, correo, sello: "pendiente" }}
        titulo="Confirma tu enlace"
        subtitulo="Abriste el enlace que te enviamos. Pulsa el botón para terminar la verificación y activar tu cuenta."
      >
        <AvisoAcceso icono="correo">
          {correo ? (
            <>
              Vas a confirmar <strong className="[overflow-wrap:anywhere]">{correo}</strong>.
            </>
          ) : (
            "Vas a confirmar tu correo."
          )}
        </AvisoAcceso>
        <form action={confirmarEnlace} className="grid grid-cols-1">
          <input type="hidden" name="code" value={code ?? ""} />
          <input type="hidden" name="tokenHash" value={tokenHash ?? ""} />
          <input type="hidden" name="type" value={type ?? ""} />
          <input type="hidden" name="next" value={next ?? ""} />
          <input type="hidden" name="email" value={correo} />
          <Button type="submit" variant="uva-primary" size="uva" className={ACCESO_BOTON}>
            Confirmar mi correo
          </Button>
        </form>
        <p className={ACCESO_NOTA}>
          Te pedimos este clic para que el filtro de seguridad de tu correo no abra el enlace por
          ti y lo deje inválido antes de que lo uses.
        </p>
      </PantallaCorreo>
    );
  }

  // Recuperar contraseña y canje por `code`: pantalla anterior, hasta su
  // propio rediseño.
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden min-[900px]:h-screen min-[900px]:flex-row min-[900px]:overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute -top-[80px] -right-[100px] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle_at_35%_30%,color-mix(in_srgb,var(--uva-accent)_24%,transparent),transparent_70%)] min-[900px]:hidden"
      />
      <div
        aria-hidden="true"
        className="absolute top-[220px] -left-[80px] h-[260px] w-[260px] rounded-full opacity-60 bg-[radial-gradient(circle_at_60%_40%,color-mix(in_srgb,var(--uva-accent-2)_22%,transparent),transparent_75%)] min-[900px]:hidden"
      />

      <AuthVisual />

      <section className="relative z-[2] grid flex-1 place-items-center px-5 pt-3 pb-10 min-[900px]:overflow-y-auto min-[900px]:bg-uva-text/4 min-[900px]:p-11 min-[900px]:[place-items:safe_center]">
        <div className="w-full max-w-[396px] rounded-uva-lg border border-uva-divider bg-uva-surface/90 px-6 py-7 text-center shadow-xl backdrop-blur-sm min-[900px]:rounded-none min-[900px]:border-0 min-[900px]:bg-transparent min-[900px]:px-0 min-[900px]:py-4 min-[900px]:shadow-none min-[900px]:backdrop-blur-none">
          <h1 className="mb-1.5 text-[30px] text-uva-text">Confirma tu enlace</h1>
          <p className="mb-6 text-sm text-uva-text-muted">
            Pulsa el botón para completar la verificación. Este paso extra
            evita que un escáner de seguridad de tu correo la haga por ti sin
            que lo notes, dejando el enlace inválido antes de que lo abras.
          </p>

          <form action={confirmarEnlace} className="flex flex-col gap-3.5">
            <input type="hidden" name="code" value={code ?? ""} />
            <input type="hidden" name="tokenHash" value={tokenHash ?? ""} />
            <input type="hidden" name="type" value={type ?? ""} />
            <input type="hidden" name="next" value={next ?? ""} />

            <Button
              type="submit"
              variant="uva-primary"
              size="uva"
              className="min-h-[46px] w-full text-[15px]"
            >
              Confirmar
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}

/** Pantalla partida con el carné, igual a la del registro (RegistroMarco). */
function PantallaCorreo({
  carne,
  titulo,
  subtitulo,
  children,
}: {
  carne: { nombre: string | null; correo: string; sello: "pendiente" | "confirmado" };
  titulo: string;
  subtitulo: string;
  children: ReactNode;
}) {
  return (
    <RegistroMarco carne={<CarneVistaPrevia {...carne} password={null} />}>
      <div className="grid grid-cols-1 gap-4 bajo:gap-3">
        <div className="grid grid-cols-1 gap-2 bajo:gap-1">
          <h1 className={ACCESO_TITULO}>{titulo}</h1>
          <p className={ACCESO_SUBTITULO}>{subtitulo}</p>
        </div>
        <div className="grid grid-cols-1 gap-3">{children}</div>
      </div>
    </RegistroMarco>
  );
}
