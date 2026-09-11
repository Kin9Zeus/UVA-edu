import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BannerVistaPrevia } from "@/components/vistaPrevia/BannerVistaPrevia";
import { LeccionVistaPreviaContent } from "@/components/vistaPrevia/LeccionVistaPreviaContent";
import {
  getLeccionVistaPrevia,
  resolverTokenVistaPrevia,
} from "@/lib/admin/resolverVistaPrevia";
import { esUuid } from "@/lib/slug";

export const metadata: Metadata = {
  title: "U.V.A. — Vista previa de la clase",
  robots: { index: false, follow: false, nocache: true },
};

export default async function LeccionVistaPreviaPage({
  params,
}: {
  params: Promise<{ token: string; leccionSlug: string }>;
}) {
  const { token, leccionSlug } = await params;

  const resultado = await resolverTokenVistaPrevia(token);
  if (!resultado.valido) {
    notFound();
  }

  const data = await getLeccionVistaPrevia(resultado.idCurso, leccionSlug);
  if (!data) {
    notFound();
  }

  // Enlace viejo con el UUID de la clase: la misma clase con su slug, para que
  // la barra nunca muestre el id. 307 y no 308 por lo mismo que en /cursos/[cursoSlug]/page.tsx: el slug puede cambiar.
  if (esUuid(leccionSlug)) {
    redirect(`/vista-previa/${token}/${data.leccionSlug}`);
  }

  return (
    <>
      <BannerVistaPrevia publicado={data.publicado} expiraEn={resultado.expiraEn} />
      <main className="pt-12">
        <LeccionVistaPreviaContent data={data} token={token} />
      </main>
    </>
  );
}
