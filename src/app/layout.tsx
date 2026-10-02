import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
// SVG, no depende de fuente de emoji del SO — sin esto, "🇨🇴" cae en texto
// plano ("CO") en Chrome/Windows por falta de glifos de bandera.
import "flag-icons/css/flag-icons.min.css";
import { siteUrl } from "@/lib/site-url";
import { headers } from "next/headers";
import { COLOR_BARRA_NAVEGADOR, SCRIPT_TEMA_INICIAL } from "@/lib/tema";
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
  title: "U.V.A. — Unidad Vectorial de Arquitectura",
  description: "Plataforma de cursos de U.V.A.",
};

// Sin esto, el navegador móvil pinta de blanco por defecto la barra de
// herramientas dinámica y la zona de overscroll al final del scroll — el
// "pedazo blanco" que corta el fondo oscuro de la app. Una etiqueta por cada
// `prefers-color-scheme`, para que siga al sistema sin JavaScript; con una
// elección manual del selector, aplicarTema() (src/lib/tema.ts) les pone a
// las dos el color del tema elegido.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: COLOR_BARRA_NAVEGADOR.claro },
    { media: "(prefers-color-scheme: dark)", color: COLOR_BARRA_NAVEGADOR.oscuro },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // src/proxy.ts genera un nonce por petición y lo deja en `x-nonce`: el
  // script del tema es en línea y, con la CSP de 'strict-dynamic', sin el
  // nonce el navegador lo bloquearía.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // suppressHydrationWarning: SCRIPT_TEMA_INICIAL pone `.dark` y
    // `color-scheme` en <html> antes de hidratar, a propósito; el servidor
    // no puede saber el tema (vive en localStorage y en el sistema del
    // visitante). Solo silencia los atributos de <html>, no a sus hijos.
    <html
      lang="es"
      className={`${plusJakartaSans.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="min-h-full flex flex-col">
        <TemaProvider>{children}</TemaProvider>
      </body>
    </html>
  );
}
