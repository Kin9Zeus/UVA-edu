import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import { createClient } from "@/lib/supabase/server";
import { PlanesContent } from "@/components/dashboard/PlanesContent";
import { logError } from "@/lib/log";

export const metadata: Metadata = {
  title: "U.V.A. — Planes",
};

export default async function PlanesPage() {
  // Sin cobro no hay planes que ofrecer: quien llegue por un enlace viejo
  // va a donde sí puede recuperar el acceso (ver src/lib/features.ts).
  if (!PRECIOS_HABILITADOS) redirect("/dashboard/suscripcion");

  const supabase = await createClient();

  // Mismo criterio que src/components/home/Pricing.tsx: la policy
  // `planes_select_publico` (supabase/sql/003) ya filtra por `activo`, pero
  // el `.eq()` explícito deja la intención en el código.
  const { data, error } = await supabase
    .from("planes")
    .select(
      "id, nombre, descripcion, precio_centavos, moneda, duracion_dias, nivel_acceso",
    )
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) {
    logError("dashboard/planes", "No se pudieron cargar los planes", error);
  }

  return (
    <div className="px-[clamp(20px,3vw,44px)] py-8">
      <PlanesContent planes={data ?? []} />
    </div>
  );
}
