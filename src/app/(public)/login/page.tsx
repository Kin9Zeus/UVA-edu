import type { Metadata } from "next";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { AuthFlow } from "@/components/auth/AuthFlow";
import { destinoInternoSeguro } from "@/lib/redirect-seguro";
import { metadataPublica } from "@/lib/seo/metadata";

// P2-6 (AUDIT-2026-09-15.md): de las páginas de auth, esta es la ÚNICA que
// `robots.ts` deja indexable — `/recuperar`, `/actualizar-password` y
// `/verificar-correo` están en el `disallow`. Aun así declaraba solo el
// título y heredaba del layout raíz la descripción genérica "Plataforma de
// cursos U.V.A", que es exactamente el estado que P2-6 vino a cerrar.
//
// El canonical importa aquí más que en el resto del sitio: la página recibe
// `?redirect=`, `?email=` y `?error=`, así que la misma pantalla existe en
// muchas direcciones. Fijarlo a `/login` a secas las colapsa en una —y de
// paso evita que una URL con el correo de alguien en el query string termine
// indexada—. `/registro` redirige aquí, así que esta es su canónica también.
export const metadata: Metadata = metadataPublica({
  titulo: "Iniciar sesión o crear cuenta",
  descripcion:
    "Entra a tu cuenta U.V.A. o créala con tu correo para acceder a los cursos del oficio de la construcción.",
  ruta: "/login",
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; email?: string; error?: string }>;
}) {
  const { redirect, email, error } = await searchParams;
  // Viaja a un campo oculto del formulario y al `next` del botón de Google,
  // así que se sanea aquí también y no solo en el Server Action: ver
  // lib/redirect-seguro.ts.
  const redirectTo = destinoInternoSeguro(redirect);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden min-[900px]:h-screen min-[900px]:flex-row min-[900px]:overflow-hidden">
      {/* Mobile: degradado de fondo detrás de todo — desktop no lo usa
          (AuthVisual ya trae los suyos, confinados a su propia sección). */}
      <div
        aria-hidden="true"
        className="absolute -top-[80px] -right-[100px] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,0,122,0.24),transparent_70%)] min-[900px]:hidden"
      />
      <div
        aria-hidden="true"
        className="absolute top-[220px] -left-[80px] h-[260px] w-[260px] rounded-full opacity-60 bg-[radial-gradient(circle_at_60%_40%,rgba(242,192,18,0.22),transparent_75%)] min-[900px]:hidden"
      />

      <AuthVisual />

      <section className="relative z-[2] grid flex-1 place-items-center px-5 pt-3 pb-10 min-[900px]:overflow-y-auto min-[900px]:bg-[rgba(250,250,250,0.04)] min-[900px]:p-11 min-[900px]:[place-items:safe_center]">
        <div className="w-full max-w-[396px] rounded-uva-lg border border-uva-divider bg-uva-surface/90 px-6 py-7 shadow-xl backdrop-blur-sm min-[900px]:rounded-none min-[900px]:border-0 min-[900px]:bg-transparent min-[900px]:px-0 min-[900px]:py-4 min-[900px]:shadow-none min-[900px]:backdrop-blur-none">
          <AuthFlow redirectTo={redirectTo} initialEmail={email} initialError={error} />
        </div>
      </section>
    </div>
  );
}
