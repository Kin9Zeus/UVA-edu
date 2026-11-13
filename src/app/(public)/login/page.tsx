import type { Metadata } from "next";
import { AuthFlow } from "@/components/auth/AuthFlow";
import { destinoInternoSeguro } from "@/lib/redirect-seguro";
import { metadataPublica } from "@/lib/seo/metadata";

// P2-6 (AUDIT-2026-09-15.md): declaraba solo el título y heredaba del layout
// raíz la descripción genérica "Plataforma de cursos UVA".
//
// `noindex` (SEO fase 14, docs/seo/00-diagnostico.md): nadie busca una
// pantalla de acceso, así que tampoco está en el sitemap. No va en el
// `disallow` de robots.ts para que Google pueda leer este `noindex`.
//
// El canonical importa aquí más que en el resto del sitio: la página recibe
// `?redirect=`, `?email=` y `?error=`, así que la misma pantalla existe en
// muchas direcciones. Fijarlo a `/login` a secas las colapsa en una —y de
// paso evita que una URL con el correo de alguien en el query string termine
// indexada—. `/registro` redirige aquí, así que esta es su canónica también.
export const metadata: Metadata = metadataPublica({
  titulo: "Iniciar sesión o crear cuenta",
  descripcion:
    "Entra a tu cuenta UVA o créala con tu correo para acceder a los cursos del oficio de la construcción.",
  ruta: "/login",
  indexable: false,
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

  // El marco de la pantalla (tarjeta del login o pantalla partida del
  // registro) depende del paso, así que lo pone AuthFlow (AccesoMarco /
  // RegistroMarco).
  return <AuthFlow redirectTo={redirectTo} initialEmail={email} initialError={error} />;
}
