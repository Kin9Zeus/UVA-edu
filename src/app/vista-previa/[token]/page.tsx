import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BannerVistaPrevia } from "@/components/vistaPrevia/BannerVistaPrevia";
import { ContenidoVistaPrevia } from "@/components/vistaPrevia/ContenidoVistaPrevia";
import {
  getCursoVistaPrevia,
  resolverTokenVistaPrevia,
} from "@/lib/admin/resolverVistaPrevia";

/**
 * `noindex`: un borrador no puede acabar en Google. Es tan importante como
 * la propia caducidad del enlace — sin esto, compartir la vista previa una
 * vez bastaría para que el contenido sin publicar quedara indexado.
 */
export const metadata: Metadata = {
  title: "U.V.A. — Vista previa",
  robots: { index: false, follow: false, nocache: true },
};

export default async function VistaPreviaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const resultado = await resolverTokenVistaPrevia(token);

  // Un enlace inválido, revocado o caducado da 404, igual que uno inventado:
  // no se le confirma a nadie que el token existió alguna vez.
  if (!resultado.valido) {
    notFound();
  }

  const curso = await getCursoVistaPrevia(resultado.idCurso);
  if (!curso) {
    notFound();
  }

  return (
    <>
      <BannerVistaPrevia publicado={curso.mostrado} expiraEn={resultado.expiraEn} />
      {/* Deja sitio para la barra fija de arriba. */}
      <main className="pt-12">
        <ContenidoVistaPrevia curso={curso} token={token} />
      </main>
    </>
  );
}
