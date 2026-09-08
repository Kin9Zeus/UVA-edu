import type { Metadata } from "next";
import { SoporteContent } from "@/components/soporte/SoporteContent";
import { esTemaSoporte } from "@/lib/soporte";

export const metadata: Metadata = { title: "U.V.A. — Soporte" };

export default async function SoportePage({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string }>;
}) {
  const { tema } = await searchParams;

  return <SoporteContent temaAbierto={esTemaSoporte(tema) ? tema : undefined} />;
}
