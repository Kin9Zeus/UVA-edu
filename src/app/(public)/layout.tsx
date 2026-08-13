import type { ReactNode } from "react";
import "@/styles/public-base.css";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
