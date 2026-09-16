import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { getPerfilActual } from "@/lib/perfil";
import { getDashboardChromeData } from "@/lib/dashboard-chrome";
import { getCursoPublico } from "@/lib/curso";
import { getCalificacionesCurso } from "@/lib/curso-calificaciones";
import { getSituacionExamen } from "@/lib/examen";
import { esPortadaReal } from "@/lib/media";
import { CursoDetalleContent } from "@/components/curso/CursoDetalleContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { construirCursoJsonLd } from "@/lib/seo/curso-jsonld";
import { metadataPublica } from "@/lib/seo/metadata";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { BottomTabBar } from "@/components/dashboard/BottomTabBar";
import { esUuid } from "@/lib/slug";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cursoSlug: string }>;
}): Promise<Metadata> {
  const { cursoSlug } = await params;
  const { user } = await getPerfilActual();
  const curso = await getCursoPublico(cursoSlug, user?.id ?? null);

  // Sin canonical a propósito: esta rama devuelve un 404 (`notFound()` más
  // abajo), y declarar como canónica una URL que no existe es peor que no
  // declarar nada.
  if (!curso) return { title: "U.V.A. — Curso" };

  return metadataPublica({
    titulo: curso.titulo,
    descripcion: curso.descripcion,
    // P2-5 (AUDIT-2026-09-04.md): getCursoPublico() resuelve tanto por
    // slug como por UUID (fallback para enlaces viejos, ver esUuid() en
    // lib/slug.ts) -- sin esto, /cursos/<uuid> y /cursos/<slug> son dos
    // URLs que Google ve como contenido duplicado. La ruta apunta siempre a
    // la versión con slug, sin importar cuál usó quien pidió la página.
    ruta: `/cursos/${curso.slug}`,
    // `imagenPortada` puede ser el placeholder (curso sin portada real, ver
    // lib/media.ts): en ese caso no hay nada útil que compartir como
    // og:image, y `metadataPublica` baja la tarjeta a `summary` en lugar de
    // pedir una grande que llegaría vacía.
    imagen: esPortadaReal(curso.imagenPortada) ? curso.imagenPortada : undefined,
  });
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

  // Un enlace viejo con el UUID sigue resolviendo, pero se manda a la URL
  // con slug en vez de servir la ficha en dos direcciones: el canonical de
  // generateMetadata solo lo arreglaba para los buscadores, y quien copiaba
  // la URL de la barra seguía compartiendo el UUID.
  //
  // `redirect` (307) y no `permanentRedirect` (308): el slug se regenera al
  // cambiar el título (actualizarInfoCurso) y un 308 lo guarda el navegador,
  // que seguiría mandando el UUID a un slug que ya no existe.
  if (esUuid(cursoSlug)) {
    redirect(`/cursos/${curso.slug}`);
  }

  // Sin sesión devuelve SIN_EXAMEN sin tocar la base: el examen no es
  // contenido público, así que la ficha anónima no cambia en nada.
  const [situacionExamen, calificaciones] = await Promise.all([
    getSituacionExamen(curso.id, user?.id ?? null),
    // Reseñas: SÍ es contenido público (a diferencia del examen) — visible
    // sin sesión, mismo criterio que el resto de esta ficha.
    getCalificacionesCurso(curso.id, user?.id ?? null),
  ]);

  const basePath = user ? "/dashboard/catalogo" : "/catalogo";
  const ruta = `/cursos/${curso.slug}`;

  // P2-5 (AUDIT-2026-09-15.md). Se construye una vez y se imprime en las dos
  // ramas: a un usuario con sesión no le aporta nada —ningún rastreador ve
  // esa versión—, pero mantenerlo en una sola rama significaría que la ficha
  // pública y la privada divergen, y la que se rompe en silencio es siempre
  // la que nadie mira al hacer un cambio.
  const jsonLd = construirCursoJsonLd(curso, calificaciones);

  if (!user) {
    return (
      <>
        <JsonLd data={jsonLd} />
        <SiteHeader {...perfilActual} />
        <main>
          <CursoDetalleContent
            curso={curso}
            basePath={basePath}
            sesionActiva={false}
            situacionExamen={situacionExamen}
            calificaciones={calificaciones}
            ruta={ruta}
            usuarioActualId={null}
            esAdmin={false}
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
      <JsonLd data={jsonLd} />
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
            calificaciones={calificaciones}
            ruta={ruta}
            usuarioActualId={user.id}
            esAdmin={esAdmin}
          />
        </main>
        <BottomTabBar />
      </div>
    </div>
  );
}
