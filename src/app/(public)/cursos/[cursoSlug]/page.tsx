import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { getPerfilActual } from "@/lib/perfil";
import { getDashboardChromeData } from "@/lib/dashboard-chrome";
import { getCursoPublico } from "@/lib/curso";
import { getSituacionExamen } from "@/lib/examen";
import { esPortadaReal } from "@/lib/media";
import { CursoDetalleContent } from "@/components/curso/CursoDetalleContent";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { BottomTabBar } from "@/components/dashboard/BottomTabBar";
import { siteUrl } from "@/lib/site-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cursoSlug: string }>;
}): Promise<Metadata> {
  const { cursoSlug } = await params;
  const { user } = await getPerfilActual();
  const curso = await getCursoPublico(cursoSlug, user?.id ?? null);

  if (!curso) return { title: "U.V.A. — Curso" };

  const titulo = `U.V.A. — ${curso.titulo}`;
  // `imagenPortada` puede ser el placeholder (curso sin portada real, ver
  // lib/media.ts): en ese caso no hay nada útil que compartir como og:image.
  const imagenes = esPortadaReal(curso.imagenPortada) ? [curso.imagenPortada] : undefined;

  return {
    title: titulo,
    description: curso.descripcion,
    // P2-5 (AUDIT-2026-09-04.md): getCursoPublico() resuelve tanto por
    // slug como por UUID (fallback para enlaces viejos, ver esUuid() en
    // lib/slug.ts) -- sin esto, /cursos/<uuid> y /cursos/<slug> son dos
    // URLs que Google ve como contenido duplicado. Apunta siempre a la
    // versión con slug, sin importar cuál usó quien pidió la página.
    alternates: {
      canonical: `${siteUrl()}/cursos/${curso.slug}`,
    },
    openGraph: {
      title: titulo,
      description: curso.descripcion,
      images: imagenes,
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: curso.descripcion,
      images: imagenes,
    },
  };
}

export default async function CursoDetallePage({
  params,
}: {
  params: Promise<{ cursoSlug: string }>;
}) {
  const { cursoSlug } = await params;
  const perfilActual = await getPerfilActual();
  const { user } = perfilActual;
  const curso = await getCursoPublico(cursoSlug, user?.id ?? null);

  if (!curso) {
    notFound();
  }

  // Sin sesión devuelve SIN_EXAMEN sin tocar la base: el examen no es
  // contenido público, así que la ficha anónima no cambia en nada.
  const situacionExamen = await getSituacionExamen(curso.id, user?.id ?? null);

  const basePath = user ? "/dashboard/catalogo" : "/catalogo";

  if (!user) {
    return (
      <>
        <SiteHeader {...perfilActual} />
        <main>
          <CursoDetalleContent
            curso={curso}
            basePath={basePath}
            sesionActiva={false}
            situacionExamen={situacionExamen}
          />
        </main>
        <Footer />
      </>
    );
  }

  // Con sesión activa se muestra el mismo chrome de navegación que el
  // dashboard (Sidebar desktop / BottomTabBar mobile): a diferencia del
  // reproductor (que sí se queda inmersivo, sin chrome), esta es una página
  // de exploración de curso, igual que /dashboard/catalogo.
  const { nombre, fotoUrl, esAdmin, certificadosCount, diasGracia, notificaciones, notificacionesNoLeidas } =
    await getDashboardChromeData({ user, perfil: perfilActual.perfil });

  return (
    <div className="flex min-h-screen">
      <Sidebar certificadosCount={certificadosCount} diasGracia={diasGracia} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          nombre={nombre}
          fotoUrl={fotoUrl}
          esAdmin={esAdmin}
          mostrarLogo="solo-mobile"
          ocultarAccionesEnMobile
          diasGracia={diasGracia}
          notificaciones={notificaciones}
          notificacionesNoLeidas={notificacionesNoLeidas}
        />
        <main className="pb-20 md:pb-0">
          <CursoDetalleContent
            curso={curso}
            basePath={basePath}
            sesionActiva
            situacionExamen={situacionExamen}
          />
        </main>
        <BottomTabBar />
      </div>
    </div>
  );
}
