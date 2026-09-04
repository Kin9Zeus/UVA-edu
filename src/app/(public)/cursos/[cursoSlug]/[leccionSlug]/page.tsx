import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/perfil";
import { getLeccionPlayer } from "@/lib/leccion";
import { getComentariosDeLeccion } from "@/lib/comentarios";
import { esUuid } from "@/lib/slug";
import { SiteHeader } from "@/components/SiteHeader";
import { PlayerContent } from "@/components/player/PlayerContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cursoSlug: string; leccionSlug: string }>;
}): Promise<Metadata> {
  const { cursoSlug, leccionSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const data = await getLeccionPlayer(cursoSlug, leccionSlug, user?.id ?? null);
  return { title: data ? `U.V.A. — ${data.leccionTitulo}` : "U.V.A. — Clase" };
}

// Vive junto a /cursos/[cursoSlug] (no bajo (student)/dashboard) a
// propósito: el reproductor debe usar el mismo header sin barra lateral que
// la ficha del curso, no el chrome del dashboard con Sidebar. /cursos ya es
// público en el middleware (ver proxy.ts), así que la exigencia de sesión
// se hace acá.
export default async function LeccionPlayerPage({
  params,
}: {
  params: Promise<{ cursoSlug: string; leccionSlug: string }>;
}) {
  const { cursoSlug, leccionSlug } = await params;
  const perfilActual = await getPerfilActual();
  const { user } = perfilActual;

  // Sin sesión: `getLeccionPlayer` igual construye el resultado si esta es
  // la lección introductoria del curso (vista previa pública, Revcurso "que
  // la primera lección sea visible"). Para cualquier otra lección devuelve
  // null, y el bloque de abajo manda a login en vez de a la ficha del
  // curso — un visitante anónimo no tiene ficha de "candado" que mostrarle
  // sin haber iniciado sesión primero.
  const data = await getLeccionPlayer(cursoSlug, leccionSlug, user?.id ?? null);

  if (!data) {
    if (!user) {
      redirect(`/login?redirect=/cursos/${cursoSlug}/${leccionSlug}`);
    }
    // Sin acceso vigente (o con la lección ya borrada). Si el curso todavía
    // se puede ver, se devuelve a su ficha —temario con candado y CTA de
    // renovación— en vez de a un 404: quien llega aquí suele ser alguien
    // con el enlace guardado a quien se le terminó el periodo. `cursoSlug`
    // puede ser slug o UUID (enlaces viejos) — mismo criterio que
    // getCursoPublico (lib/curso.ts).
    const supabase = await createClient();
    const { data: curso } = await supabase
      .from("cursos")
      .select("id")
      .eq(esUuid(cursoSlug) ? "id" : "slug", cursoSlug)
      .maybeSingle();
    if (curso) {
      redirect(`/cursos/${cursoSlug}`);
    }
    notFound();
  }

  const comentarios = await getComentariosDeLeccion(data.leccionId, user?.id ?? null);

  return (
    <>
      {/* Mobile: sin header del sitio — el reproductor pone su propia barra
          sticky (volver/temario/siguiente), ver PlayerContent.tsx. */}
      <div className="hidden lg:block">
        <SiteHeader {...perfilActual} ocultarBuscador />
      </div>
      <main>
        <PlayerContent
          data={data}
          comentariosIniciales={comentarios}
          usuarioActualId={user?.id ?? null}
          esAdmin={perfilActual.perfil?.rol === "ADMINISTRADOR"}
        />
      </main>
    </>
  );
}
