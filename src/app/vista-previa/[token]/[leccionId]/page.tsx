import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BannerVistaPrevia } from "@/components/vistaPrevia/BannerVistaPrevia";
import { LeccionVistaPreviaContent } from "@/components/vistaPrevia/LeccionVistaPreviaContent";
import {
  getLeccionVistaPrevia,
  resolverTokenVistaPrevia,
} from "@/lib/admin/resolverVistaPrevia";

export const metadata: Metadata = {
  title: "U.V.A. — Vista previa de la clase",
  robots: { index: false, follow: false, nocache: true },
};

export default async function LeccionVistaPreviaPage({
  params,
}: {
  params: Promise<{ token: string; leccionId: string }>;
}) {
  const { token, leccionId } = await params;

  const resultado = await resolverTokenVistaPrevia(token);
  if (!resultado.valido) {
    notFound();
  }

  const data = await getLeccionVistaPrevia(resultado.idCurso, leccionId);
  if (!data) {
    notFound();
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
