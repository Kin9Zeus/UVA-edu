import { redirect } from "next/navigation";

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
  const target = redirectParam?.startsWith("/")
    ? `/login?redirect=${encodeURIComponent(redirectParam)}`
    : "/login";

  redirect(target);
}
