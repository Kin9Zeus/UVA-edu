import type { Metadata } from "next";
import { SoporteContent } from "@/components/dashboard/SoporteContent";

export const metadata: Metadata = { title: "U.V.A. — Soporte" };

export default function SoportePage() {
  return <SoporteContent />;
}
