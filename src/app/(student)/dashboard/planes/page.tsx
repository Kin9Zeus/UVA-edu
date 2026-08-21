import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PlanesContent } from "@/components/dashboard/PlanesContent";

export const metadata: Metadata = {
  title: "U.V.A. — Planes",
};

export default async function PlanesPage() {
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
    console.error("[dashboard/planes] No se pudieron cargar los planes:", error.message);
  }

  return (
    <div className="px-[clamp(20px,3vw,44px)] py-8">
      <PlanesContent planes={data ?? []} />
    </div>
  );
}
