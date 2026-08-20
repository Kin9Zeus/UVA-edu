import type { Metadata } from "next";
import { getInstructores } from "@/lib/admin/instructores";
import { InstructoresTable } from "@/components/admin/instructores/InstructoresTable";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Instructores",
};

export default async function AdminInstructoresPage() {
  const instructores = await getInstructores();

  return (
    <div className="flex flex-col gap-[18px]">
      <p className="-mt-3.5 text-sm text-uva-muted">
        Información de catálogo: los instructores no tienen cuenta ni inician sesión.
      </p>
      <InstructoresTable instructores={instructores} />
    </div>
  );
}
