import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
// SVG, no depende de fuente de emoji del SO — sin esto, "🇨🇴" cae en texto
// plano ("CO") en Chrome/Windows por falta de glifos de bandera.
import "flag-icons/css/flag-icons.min.css";
import { siteUrl } from "@/lib/site-url";
import { headers } from "next/headers";
import { COLOR_BARRA_NAVEGADOR, SCRIPT_TEMA_INICIAL } from "@/lib/tema";
import { TemaProvider } from "@/components/tema/TemaProvider";
import { SincronizarPestanas } from "@/components/sesion/SincronizarPestanas";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

// Sin precarga: solo la usan los códigos de invitación, cupones y folios
// (`font-codigo` en globals.css), y precargarla
// (27 KiB) competía con la imagen del LCP en todas las páginas. El navegador
// la pide cuando aparece el primer texto que la usa; mientras llega se ve la
// monoespaciada de respaldo, que next/font ajusta de tamaño para no mover el
// diseño.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  preload: false,
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
// "pedazo blanco" que corta el fondo oscuro de la app. Nace con el color del
// tema oscuro, el de por defecto; aplicarTema() (src/lib/tema.ts) lo cambia
// si el visitante eligió otro.
export const viewport: Viewport = {
  themeColor: COLOR_BARRA_NAVEGADOR.oscuro,
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
    // no puede saber el tema (vive en localStorage). Nace con `dark`, el tema
    // por defecto. Solo silencia los atributos de <html>, no a sus hijos.
    <html
      lang="es"
      className={`dark ${plusJakartaSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="min-h-full flex flex-col">
        <TemaProvider>{children}</TemaProvider>
        <SincronizarPestanas />
      </body>
    </html>
  );
}
