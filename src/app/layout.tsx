import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
// SVG, no depende de fuente de emoji del SO — sin esto, "🇨🇴" cae en texto
// plano ("CO") en Chrome/Windows por falta de glifos de bandera.
import "flag-icons/css/flag-icons.min.css";
import { siteUrl } from "@/lib/site-url";
import { COLOR_BARRA_NAVEGADOR } from "@/lib/tema";
import { leerTema } from "@/lib/tema-servidor";
import { TemaProvider } from "@/components/tema/TemaProvider";

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

// Sin esto, el navegador móvil pinta de blanco por defecto la barra de
// herramientas dinámica y la zona de overscroll al final del scroll — el
// "pedazo blanco" que corta el fondo oscuro de la app. Sigue al tema elegido
// (cookie `uva-tema`, ver src/lib/tema.ts); al cambiarlo sin recargar,
// aplicarTema() actualiza estas mismas etiquetas.
export async function generateViewport(): Promise<Viewport> {
  const tema = await leerTema();
  return {
    themeColor: COLOR_BARRA_NAVEGADOR[tema],
    colorScheme: tema === "oscuro" ? "dark" : "light",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const tema = await leerTema();

  return (
    <html
      lang="es"
      className={`${tema === "oscuro" ? "dark " : ""}${plusJakartaSans.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      style={{ colorScheme: tema === "oscuro" ? "dark" : "light" }}
    >
      <body className="min-h-full flex flex-col">
        <TemaProvider temaInicial={tema}>{children}</TemaProvider>
      </body>
    </html>
  );
}
