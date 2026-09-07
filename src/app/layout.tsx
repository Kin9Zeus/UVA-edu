import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
// SVG, no depende de fuente de emoji del SO — sin esto, "🇨🇴" cae en texto
// plano ("CO") en Chrome/Windows por falta de glifos de bandera.
import "flag-icons/css/flag-icons.min.css";
import { siteUrl } from "@/lib/site-url";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // P2-5 (AUDIT-2026-09-04.md): sin esto, Next no tiene con qué resolver
  // ninguna URL relativa de metadata (og:image, canonical) a una URL
  // absoluta -- cae a "http://localhost:3000" incluso en producción, y las
  // tarjetas de vista previa al compartir un link salen rotas.
  metadataBase: new URL(siteUrl()),
  title: "U.V.A — Unidad Vectorial de Arquitectura",
  description: "Plataforma de cursos U.V.A",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`dark ${plusJakartaSans.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
