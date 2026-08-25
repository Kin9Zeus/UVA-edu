import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/perfil";
import { getLeccionPlayer } from "@/lib/leccion";
import { SiteHeader } from "@/components/SiteHeader";
import { PlayerContent } from "@/components/player/PlayerContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; leccionId: string }>;
}): Promise<Metadata> {
  const { id, leccionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const data = user ? await getLeccionPlayer(id, leccionId, user.id) : null;
  return { title: data ? `U.V.A. — ${data.leccionTitulo}` : "U.V.A. — Clase" };
}

// Vive junto a /cursos/[id] (no bajo (student)/dashboard) a propósito: el
// reproductor debe usar el mismo header sin barra lateral que la ficha del
// curso, no el chrome del dashboard con Sidebar. /cursos ya es público en
// el middleware (ver proxy.ts), así que la exigencia de sesión se hace acá.
export default async function LeccionPlayerPage({
  params,
}: {
  params: Promise<{ id: string; leccionId: string }>;
}) {
  const { id, leccionId } = await params;
  const perfilActual = await getPerfilActual();
  const { user } = perfilActual;

  if (!user) {
    redirect(`/login?redirect=/cursos/${id}/${leccionId}`);
  }

  const data = await getLeccionPlayer(id, leccionId, user.id);

  if (!data) {
    notFound();
  }

  return (
    <>
      <SiteHeader {...perfilActual} />
      <main>
        <PlayerContent data={data} />
      </main>
    </>
  );
}
