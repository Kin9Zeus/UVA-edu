import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { getPerfilActual } from "@/lib/perfil";
import { getDashboardChromeData } from "@/lib/dashboard-chrome";
import { getCursoPublico } from "@/lib/curso";
import { getCalificacionesCurso } from "@/lib/curso-calificaciones";
import { getSituacionExamen } from "@/lib/examen";
import { CursoFicha } from "@/components/curso/CursoFicha";
import { JsonLd } from "@/components/seo/JsonLd";
import { construirCursoJsonLd } from "@/lib/seo/curso-jsonld";
import { MIGAS_CATALOGO, construirMigasJsonLd } from "@/lib/seo/migas";
import { metadataPublica, tituloCurso } from "@/lib/seo/metadata";
import { recortarDescripcion } from "@/lib/seo/descripciones";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { BottomTabBar } from "@/components/dashboard/BottomTabBar";
import { esUuid } from "@/lib/slug";
import { slugActual } from "@/lib/slugs-anteriores";
import { leerPreferenciaSidebar } from "@/lib/sidebar-preferencia-servidor";

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
  if (!curso) return { title: "Curso" };

  return metadataPublica({
    titulo: tituloCurso(curso.titulo),
    // El párrafo completo pasa de 155 caracteres: se recorta en una palabra
    // hasta que exista el campo SEO del admin (Fase 15).
    descripcion: recortarDescripcion(curso.descripcion),
    // P2-5 (AUDIT-2026-09-04.md): getCursoPublico() resuelve tanto por
    // slug como por UUID (fallback para enlaces viejos, ver esUuid() en
    // lib/slug.ts) -- sin esto, /cursos/<uuid> y /cursos/<slug> son dos
    // URLs que Google ve como contenido duplicado. La ruta apunta siempre a
    // la versión con slug, sin importar cuál usó quien pidió la página.
    ruta: `/cursos/${curso.slug}`,
    // La tarjeta generada por ./opengraph-image.tsx (y ./twitter-image.tsx):
    // título, escuela, nivel y duración, no la portada. Next pone su URL.
    imagen: null,
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
    // Slug viejo (el curso cambió de título): 308 a la URL actual.
    const actual = await slugActual("cursos", cursoSlug);
    if (actual) permanentRedirect(`/cursos/${actual}`);
    notFound();
  }

  // Un enlace viejo con el UUID sigue resolviendo, pero se manda a la URL
  // con slug en vez de servir la ficha en dos direcciones: el canonical de
  // generateMetadata solo lo arreglaba para los buscadores, y quien copiaba
  // la URL de la barra seguía compartiendo el UUID.
  //
  // 308 (permanente): antes era 307 porque el navegador guarda el 308 y, si
  // el título cambiaba, seguía mandando el UUID a un slug muerto. Con el
  // historial de slugs (lib/slugs-anteriores.ts) ese slug viejo redirige.
  if (esUuid(cursoSlug)) {
    permanentRedirect(`/cursos/${curso.slug}`);
  }

  // Sin sesión devuelve SIN_EXAMEN sin tocar la base: el examen no es
  // contenido público, así que la ficha anónima no cambia en nada.
  const [situacionExamen, calificaciones] = await Promise.all([
    getSituacionExamen(curso.id, user?.id ?? null),
    // Reseñas: SÍ es contenido público (a diferencia del examen) — visible
    // sin sesión, mismo criterio que el resto de esta ficha.
    getCalificacionesCurso(curso.id, user?.id ?? null),
  ]);

  // P2-5 (AUDIT-2026-09-15.md). Se construye una vez y se imprime en las dos
  // ramas: a un usuario con sesión no le aporta nada —ningún rastreador ve
  // esa versión—, pero mantenerlo en una sola rama significaría que la ficha
  // pública y la privada divergen, y la que se rompe en silencio es siempre
  // la que nadie mira al hacer un cambio.
  const jsonLd = construirCursoJsonLd(curso, calificaciones);

  // Migas (SEO/GEO fase 14): la misma escuela que pinta CursoFicha
  // (`curso.categorias[0]`), con "Inicio" al principio. Sin escuela, la ruta
  // salta de Catálogo al curso.
  const escuela = curso.categorias[0];
  const migas = construirMigasJsonLd([
    ...MIGAS_CATALOGO,
    ...(escuela ? [{ nombre: escuela.nombre, ruta: `/catalogo/${escuela.slug}` }] : []),
    { nombre: curso.titulo, ruta: `/cursos/${curso.slug}` },
  ]);

  if (!user) {
    return (
      <>
        <JsonLd data={jsonLd} />
        <JsonLd data={migas} />
        <SiteHeader {...perfilActual} />
        <main id="contenido" tabIndex={-1}>
          {/* Sin sesión: sin examen (no es contenido público) y con reseñas
              de solo lectura. */}
          <CursoFicha curso={curso} calificaciones={calificaciones} sesion={null} />
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
    <div className="flex min-h-dvh">
      <JsonLd data={jsonLd} />
      <JsonLd data={migas} />
      <Sidebar
        certificadosCount={certificadosCount}
        diasGracia={diasGracia}
        preferenciaInicial={await leerPreferenciaSidebar()}
      />
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
        <main id="contenido" tabIndex={-1} className="pb-20 md:pb-0">
          <CursoFicha
            curso={curso}
            calificaciones={calificaciones}
            sesion={{ usuarioId: user.id, esAdmin, situacionExamen }}
          />
        </main>
        <BottomTabBar />
      </div>
    </div>
  );
}
