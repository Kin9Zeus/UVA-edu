import Link from "next/link";
import {
  YoutubeIcon,
  InstagramIcon,
  WhatsappIcon,
  SpotifyIcon,
  TiktokIcon,
} from "@/components/home/icons";
import { getCategoriasActivas } from "@/lib/categoria";
import { VerificarCertificadoForm } from "@/components/home/VerificarCertificadoForm";
import { TEMAS_SOPORTE } from "@/lib/soporte";
import { urlWhatsapp } from "@/lib/contacto";
import { LogoUva } from "@/components/home/LogoUva";

// La columna "Escuelas" sale de la tabla `categorias`; esta es contenido
// editorial del sitio, sin fuente en base de datos.
//
// Oculta mientras sus páginas no existan: los cuatro enlaces apuntaban a `#`
// y un enlace que no lleva a ningún lado incumple "cada llamado a la acción
// lleva a donde dice". Se conserva el contenido para reactivarla (poner
// `MOSTRAR_COLUMNA_COMUNIDAD` en true) cuando cada enlace tenga destino real.
const MOSTRAR_COLUMNA_COMUNIDAD = false;

const columns = [
  {
    heading: "U.V.A. y comunidad",
    links: ["Sobre nosotros", "Blog del gremio", "Casos de éxito", "Empleo"],
  },
];

const socials = [
  {
    label: "Canal de U.V.A. en YouTube",
    Icon: YoutubeIcon,
    href: "https://www.youtube.com/@uvarq",
  },
  {
    label: "U.V.A. en Instagram",
    Icon: InstagramIcon,
    href: "https://www.instagram.com/uvarq",
  },
  {
    label: "Escríbenos por WhatsApp",
    Icon: WhatsappIcon,
    href: urlWhatsapp(),
  },
  {
    label: "U.V.A. en Spotify",
    Icon: SpotifyIcon,
    href: "https://open.spotify.com/",
  },
  {
    label: "U.V.A. en TikTok",
    Icon: TiktokIcon,
    href: "https://www.tiktok.com/@uvarq",
  },
];

const headingClass = "mb-1.5 font-heading text-uva-detalle font-bold text-uva-accent-ink";
const linkClass =
  "flex min-h-11 items-center text-uva-cuerpo text-uva-text no-underline hover:text-uva-accent-ink hover:no-underline";

/**
 * `conBotonWhatsApp`: la página también monta el botón flotante de WhatsApp
 * (fixed, abajo a la derecha, 56 px + 24 px de margen). Sin espacio extra al
 * final, el botón queda encima de la última fila del pie (redes y
 * copyright) y las tapa aunque el usuario haya llegado al fondo de la página.
 */
export async function Footer({
  conBotonWhatsApp = false,
}: { conBotonWhatsApp?: boolean } = {}) {
  // Las escuelas del pie son exactamente las del filtro del catálogo:
  // categorías activas con al menos un curso publicado (una escuela vacía lleva
  // a una página sin cursos y anuncia una oferta que todavía no existe),
  // ordenadas por nombre. Salen de la misma lectura cacheada y con su misma
  // invalidación (lib/categoria.ts, lib/cache-catalogo.ts) en vez de una
  // consulta propia en cada página que monta el pie — que son todas las
  // públicas. Ante un fallo `getCategoriasActivas` ya lo registra y devuelve
  // `[]`, sin cachearlo: la columna se omite.
  const escuelas = await getCategoriasActivas();

  return (
    <footer
      className={`mt-auto pr-[max(var(--spacing-uva-margen),env(safe-area-inset-right))] pl-[max(var(--spacing-uva-margen),env(safe-area-inset-left))] ${conBotonWhatsApp ? "pb-24" : "pb-12"}`}
    >
      {/* Banda de lámina: línea gruesa y trama de rayado, de borde a borde. */}
      <div
        aria-hidden="true"
        className="-mr-[max(var(--spacing-uva-margen),env(safe-area-inset-right))] -ml-[max(var(--spacing-uva-margen),env(safe-area-inset-left))] h-4 border-t-2 border-uva-text bg-[repeating-linear-gradient(135deg,var(--uva-line-strong)_0_1px,transparent_1px_10px)]"
      />
      <div className="mx-auto w-full max-w-uva pt-9">
        <div className="mb-9 grid gap-8 md:grid-cols-2 lg:grid-cols-12">
          <div className="flex flex-col gap-3 lg:col-span-3">
            <LogoUva etiqueta="U.V.A." className="h-[34px] w-[105px] text-uva-text" />
            <p className="max-w-[240px] text-uva-cuerpo text-uva-text-muted">
              Formación en línea para el gremio de la construcción en LATAM.
            </p>
          </div>

          {/* Sin categorías se omite la columna entera en vez de dejar un
              encabezado huérfano. */}
          {escuelas.length > 0 && (
            <nav aria-label="Escuelas" className="lg:col-span-2">
              <h2 className={headingClass}>Escuelas</h2>
              <ul className="grid grid-cols-2 gap-x-4 md:block">
                {escuelas.map((escuela) => (
                  <li key={escuela.id}>
                    <Link href={`/catalogo/${escuela.slug}`} className={linkClass}>
                      {escuela.nombre}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {MOSTRAR_COLUMNA_COMUNIDAD &&
            columns.map((column) => (
              <div key={column.heading}>
                <h2 className={headingClass}>{column.heading}</h2>
                <ul>
                  {column.links.map((link) => (
                    <li key={link}>
                      <a href="#" className={linkClass}>
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

          {/* Cada enlace lleva a la misma pantalla de soporte con ese tema ya
              desplegado (`?tema=`); los otros tres siguen visibles ahí. */}
          <nav aria-label="Soporte" className="lg:col-span-3">
            <h2 className={headingClass}>Soporte</h2>
            <ul className="grid grid-cols-2 gap-x-4 md:block">
              {TEMAS_SOPORTE.map((tema) => (
                <li key={tema.id}>
                  <Link href={`/soporte?tema=${tema.id}`} className={linkClass}>
                    {tema.titulo}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-4">
            <h2 className={headingClass}>Verificar certificado</h2>
            <p className="mb-2.5 text-uva-cuerpo text-uva-text-muted">
              ¿Tienes el código de un certificado U.V.A.? Confirma su validez.
            </p>
            <VerificarCertificadoForm />
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-5 border-t border-uva-divider pt-[22px] sm:flex-row sm:items-center">
          <p className="text-uva-detalle text-uva-text-muted">© 2026 U.V.A. Hecho en obra, para LATAM.</p>
          <ul aria-label="U.V.A. en redes" className="flex gap-2">
            {socials.map(({ label, Icon, href }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex size-11 items-center justify-center rounded-uva-sm border-2 border-uva-line-strong text-uva-text no-underline hover:border-uva-text hover:no-underline"
                >
                  <Icon />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
