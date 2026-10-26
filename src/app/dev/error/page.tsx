import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoErrores } from "@/components/dev/DemoErrores";

export const metadata: Metadata = {
  title: "U.V.A. — Probar la pantalla de error",
  robots: { index: false, follow: false },
};

/**
 * Para probar a propósito la pantalla de error (`error.tsx`): `?de=servidor`
 * falla al pintar en el servidor (trae referencia); el botón pide algo al
 * servidor desde el cliente, que sin conexión cae en la variante "Sin
 * conexión". Como /dev/componentes, no existe en producción.
 */
export default async function ErrorAPropositoPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { de } = await searchParams;
  if (de === "servidor") throw new Error("Error a propósito (/dev/error?de=servidor)");

  return (
    <main id="contenido" tabIndex={-1} className="mx-auto grid max-w-xl gap-4 px-uva-margen py-uva-seccion">
      <h1 className="text-uva-titulo-3 text-uva-text">Probar la pantalla de error</h1>
      <DemoErrores />
    </main>
  );
}
