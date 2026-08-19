import type { Metadata } from "next";
import { getInstructores } from "@/lib/admin/instructores";
import { InstructoresTable } from "@/components/admin/instructores/InstructoresTable";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Instructores",
};

export default async function AdminInstructoresPage() {
  const instructores = await getInstructores();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl text-uva-text">Instructores</h1>
        <p className="text-sm text-uva-text-faint">
          Se listan a partir de los cursos existentes; un instructor aparece aquí en cuanto tiene al menos un
          curso asignado.
        </p>
      </div>
      <InstructoresTable instructores={instructores} />
    </div>
  );
}
