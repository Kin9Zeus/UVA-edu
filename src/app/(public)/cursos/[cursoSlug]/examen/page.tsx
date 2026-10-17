import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { getPerfilActual, resumenCuenta } from "@/lib/perfil";
import { esUuid } from "@/lib/slug";
import { getConteoPreguntasExamen, getResultadoIntento, getSituacionExamen, getIntentoEnCurso } from "@/lib/examen";
import { EncabezadoCurso } from "@/components/curso/EncabezadoCurso";
import { MenuCuenta } from "@/components/dashboard/MenuCuenta";
import { SelectorTemaBoton } from "@/components/tema/SelectorTema";
import { ExamenIntro } from "@/components/examen/ExamenIntro";
import { ExamenRendir } from "@/components/examen/ExamenRendir";

export const metadata: Metadata = {
  title: "U.V.A. — Examen final",
};

/**
 * Examen final del curso.
 *
 * Vive junto a `/cursos/[cursoSlug]/[leccionSlug]` (no bajo el dashboard) por
 * el mismo motivo que la clase: es parte de la experiencia del curso y usa el
 * encabezado de foco (`EncabezadoCurso`), no el chrome del dashboard. Diseño
 * "examen" del canvas "UVA Cursos".
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
  const { data: curso, error } = await supabase
    .from("cursos")
    // `cursoSlug` puede ser slug o UUID (enlaces anteriores al cambio de
    // rutas) — mismo criterio que getCursoPublico.
    .select("id, slug, titulo")
    .eq(esUuid(cursoSlug) ? "id" : "slug", cursoSlug)
    .maybeSingle();

  // Un fallo aquí no es "el curso no existe" (AUDIT-2026-09-22.md,
  // seguimiento de P2-3): sin esto, respondía 404 durante cualquier caída.
  lanzarSiFalla(error, "ExamenPage:cursos");
  if (!curso) notFound();

  // Enlace viejo con UUID: misma pantalla con slug, conservando ?tiempo= (lo
  // pone ExamenRendir al cortar por tiempo). Motivo del 307 en /cursos/[cursoSlug]/page.tsx.
  if (esUuid(cursoSlug)) {
    redirect(`/cursos/${curso.slug}/examen${tiempo ? `?tiempo=${encodeURIComponent(tiempo)}` : ""}`);
  }

  // `estricto`: esta pantalla ES la situación del examen. Sin él, un fallo de
  // lectura salía como SIN_EXAMEN y el redirect de abajo mandaba al
  // estudiante a la ficha como si el curso no tuviera examen.
  const situacion = await getSituacionExamen(curso.id, user.id, { estricto: true });

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

    // Rindiendo: sin la cuenta ni "← curso" arriba, solo "Examen final" y la
    // salida. Salir no cierra el intento: queda abierto y se retoma aquí.
    return (
      <div className="flex min-h-dvh flex-col bg-uva-bg">
        <EncabezadoCurso
          inicio={{ href: "/dashboard", etiqueta: "U.V.A., ir al inicio del panel" }}
          titulo="Examen final"
          logoEnCelular
        >
          <Link
            href={`/cursos/${cursoSlug}`}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-1 text-uva-detalle font-semibold text-uva-accent-ink underline underline-offset-4 hover:no-underline"
          >
            Salir del examen
          </Link>
        </EncabezadoCurso>
        <main className="flex flex-1 flex-col">
          <ExamenRendir intento={intento} cursoSlug={cursoSlug} cursoTitulo={curso.titulo} />
        </main>
      </div>
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

  const [resultado, conteo] = await Promise.all([
    ultimoIntentoId ? getResultadoIntento(ultimoIntentoId, user.id) : Promise.resolve(null),
    // "10 preguntas" de la pantalla previa: dato secundario (ver la función).
    situacion.situacion === "DISPONIBLE" ? getConteoPreguntasExamen(curso.id) : Promise.resolve(null),
  ]);
  const cuenta = resumenCuenta(perfilActual);

  return (
    <div className="flex min-h-dvh flex-col bg-uva-bg">
      <EncabezadoCurso
        inicio={{ href: "/dashboard", etiqueta: "U.V.A., ir al inicio del panel" }}
        volver={{ href: `/cursos/${cursoSlug}`, texto: curso.titulo }}
        logoEnCelular
      >
        <SelectorTemaBoton className="hidden text-uva-text hover:bg-uva-hover hover:text-uva-text lg:inline-flex" />
        {cuenta && (
          <MenuCuenta
            nombre={cuenta.nombre}
            fotoUrl={cuenta.fotoUrl}
            esAdmin={cuenta.esAdmin}
            mostrarNombre={false}
            comunidadSiempre
          />
        )}
      </EncabezadoCurso>
      <main className="flex flex-1 flex-col">
        <ExamenIntro
          situacion={situacion}
          resultado={resultado}
          conteo={conteo}
          cursoId={curso.id}
          cursoSlug={cursoSlug}
          cursoTitulo={curso.titulo}
          tiempoAgotado={tiempo === "agotado"}
        />
      </main>
    </div>
  );
}
