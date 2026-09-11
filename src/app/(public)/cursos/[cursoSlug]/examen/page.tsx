import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/perfil";
import { esUuid } from "@/lib/slug";
import { getResultadoIntento, getSituacionExamen, getIntentoEnCurso } from "@/lib/examen";
import { SiteHeader } from "@/components/SiteHeader";
import { ExamenIntro } from "@/components/examen/ExamenIntro";
import { ExamenRendir } from "@/components/examen/ExamenRendir";

export const metadata: Metadata = {
  title: "U.V.A. — Examen final",
};

/**
 * Examen final del curso.
 *
 * Vive junto a `/cursos/[cursoSlug]/[leccionSlug]` (no bajo el dashboard) por
 * el mismo motivo que el reproductor: es parte de la experiencia del curso y
 * usa el header sin barra lateral, no el chrome del dashboard.
 *
 * `examen` es un segmento ESTÁTICO hermano del dinámico `[leccionSlug]`, y en
 * Next.js el estático gana — por eso "examen" está reservado como slug de
 * lección (SLUGS_RESERVADOS_LECCION en src/lib/slug.ts). Sin esa reserva, una
 * lección titulada "Examen" quedaría inalcanzable.
 */
export default async function ExamenPage({
  params,
  searchParams,
}: {
  params: Promise<{ cursoSlug: string }>;
  searchParams: Promise<{ tiempo?: string }>;
}) {
  const { cursoSlug } = await params;
  const { tiempo } = await searchParams;
  const perfilActual = await getPerfilActual();
  const { user } = perfilActual;

  // Un examen nunca es contenido público: sin sesión no hay nada que mostrar,
  // ni siquiera la pantalla previa.
  if (!user) {
    redirect(`/login?redirect=/cursos/${cursoSlug}/examen`);
  }

  const supabase = await createClient();
  const { data: curso } = await supabase
    .from("cursos")
    // `cursoSlug` puede ser slug o UUID (enlaces anteriores al cambio de
    // rutas) — mismo criterio que getCursoPublico.
    .select("id, slug, titulo")
    .eq(esUuid(cursoSlug) ? "id" : "slug", cursoSlug)
    .maybeSingle();

  if (!curso) notFound();

  // Enlace viejo con UUID: misma pantalla con slug, conservando ?tiempo= (lo
  // pone ExamenRendir al cortar por tiempo). Motivo del 307 en /cursos/[cursoSlug]/page.tsx.
  if (esUuid(cursoSlug)) {
    redirect(`/cursos/${curso.slug}/examen${tiempo ? `?tiempo=${encodeURIComponent(tiempo)}` : ""}`);
  }

  const situacion = await getSituacionExamen(curso.id, user.id);

  // Sin examen publicado (o sin acceso vigente al curso, que RLS traduce a lo
  // mismo): esta URL no tiene sentido — se devuelve a la ficha del curso en
  // vez de a un 404, que es lo que espera quien llegó por un enlace guardado.
  if (situacion.situacion === "SIN_EXAMEN") {
    redirect(`/cursos/${cursoSlug}`);
  }

  if (situacion.situacion === "EN_CURSO") {
    const intento = await getIntentoEnCurso(situacion.intentoId, user.id);

    // El intento pudo cerrarse entre la consulta de situación y esta (envío
    // desde otra pestaña, o corte por tiempo): se recarga en vez de renderizar
    // un examen que ya no acepta respuestas.
    if (!intento) redirect(`/cursos/${cursoSlug}/examen`);

    return (
      <>
        {/* Sin header en móvil, igual que el reproductor: rendir un examen es
            una pantalla de foco, no de navegación. */}
        <div className="hidden lg:block">
          <SiteHeader {...perfilActual} ocultarBuscador />
        </div>
        <main>
          <ExamenRendir intento={intento} cursoSlug={cursoSlug} cursoTitulo={curso.titulo} />
        </main>
      </>
    );
  }

  // Resultado del último intento cerrado, para mostrarlo encima de la pantalla
  // previa (o como cierre, si ya aprobó o se le agotaron los intentos).
  const ultimoIntentoId =
    situacion.situacion === "APROBADO"
      ? situacion.intentoAprobado.id
      : situacion.situacion === "EN_ESPERA"
        ? situacion.ultimoIntento.id
        : situacion.situacion === "DISPONIBLE"
          ? (situacion.ultimoIntento?.id ?? null)
          : null;

  const resultado = ultimoIntentoId
    ? await getResultadoIntento(ultimoIntentoId, user.id)
    : null;

  return (
    <>
      <SiteHeader {...perfilActual} ocultarBuscador />
      <main>
        <ExamenIntro
          situacion={situacion}
          resultado={resultado}
          cursoId={curso.id}
          cursoSlug={cursoSlug}
          cursoTitulo={curso.titulo}
          tiempoAgotado={tiempo === "agotado"}
        />
      </main>
    </>
  );
}
