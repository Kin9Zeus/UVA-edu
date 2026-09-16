import { redirect } from "next/navigation";
import { destinoInternoSeguro } from "@/lib/redirect-seguro";

// El flujo de correo inteligente unificó login y registro en /login (ver
// promptauthflowplatzi.md): un mismo campo de correo decide si se muestra
// la pantalla de iniciar sesión o de crear cuenta. Esta ruta se conserva
// solo para no romper enlaces/marcadores viejos a /registro.
export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectParam } = await searchParams;
  // `/login` vuelve a sanear el parámetro, pero no tiene sentido reenviarle
  // un destino hostil: ver lib/redirect-seguro.ts. Sin destino válido se
  // manda a `/login` a secas, no a `/login?redirect=/dashboard`.
  const destino = destinoInternoSeguro(redirectParam, "");
  const target = destino ? `/login?redirect=${encodeURIComponent(destino)}` : "/login";

  redirect(target);
}
