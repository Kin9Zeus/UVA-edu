import Link from "next/link";
import {
  YoutubeIcon,
  InstagramIcon,
  WhatsappIcon,
  SpotifyIcon,
  TiktokIcon,
} from "@/components/home/icons";
import { createPublicClient } from "@/lib/supabase/public";
import { logError } from "@/lib/log";

// La columna "Escuelas" sale de la tabla `categorias`; estas dos son
// contenido editorial del sitio, sin fuente en base de datos.
const columns = [
  {
    heading: "U.V.A. y comunidad",
    links: ["Sobre nosotros", "Blog del gremio", "Casos de éxito", "Empleo"],
  },
  {
    heading: "Soporte",
    links: ["Centro de ayuda", "Contacto", "Términos", "Privacidad"],
  },
];

const socials = [
  {
    label: "YouTube",
    Icon: YoutubeIcon,
    href: "https://www.youtube.com/@uvarq",
  },
  {
    label: "Instagram",
    Icon: InstagramIcon,
    href: "https://www.instagram.com/uvarq",
  },
  {
    label: "WhatsApp",
    Icon: WhatsappIcon,
    href: "https://api.whatsapp.com/send/?phone=%2B573234260022&text&type=phone_number&app_absent=0",
  },
  {
    label: "Spotify",
    Icon: SpotifyIcon,
    href: "https://open.spotify.com/",
  },
  {
    label: "TikTok",
    Icon: TiktokIcon,
    href: "https://www.tiktok.com/@uvarq",
  },
];

const headingClass =
  "mb-3.5 font-mono text-xs tracking-[0.16em] text-uva-accent uppercase";
const linkClass =
  "text-sm text-uva-text-muted no-underline hover:text-uva-text hover:no-underline";

export async function Footer() {
  const supabase = createPublicClient();

  // Todas las categorías son públicas (policy `categorias_select_publico`,
  // supabase/sql/004): no hay filtro, solo un orden estable por nombre —
  // `categorias` no tiene columna `orden` en el esquema.
  const { data, error } = await supabase
    .from("categorias")
    .select("id, slug, nombre")
    .order("nombre", { ascending: true });

  if (error) {
    logError("Home/Footer", "No se pudieron cargar las categorías", error);
  }

  const escuelas = data ?? [];

  return (
    <footer className="border-t border-uva-divider bg-[#0d0d10] px-[clamp(20px,4vw,56px)] pt-[clamp(48px,6vw,72px)] pb-9">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-11 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-9">
          <div>
            <p className="mb-2 font-heading text-xl font-bold tracking-[0.08em] text-uva-text">
              U.V.A<span className="text-uva-accent">.</span>
            </p>
            <p className="m-0 max-w-[220px] text-[13px] text-uva-text-muted">
              Formación en línea para el gremio de la construcción en LATAM.
            </p>
          </div>

          {/* Sin categorías se omite la columna entera en vez de dejar un
              encabezado huérfano; el grid auto-fit reacomoda el resto. */}
          {escuelas.length > 0 && (
            <div>
              <p className={headingClass}>Escuelas</p>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {escuelas.map((escuela) => (
                  <li key={escuela.id}>
                    <Link href={`/catalogo/${escuela.slug}`} className={linkClass}>
                      {escuela.nombre}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {columns.map((column) => (
            <div key={column.heading}>
              <p className={headingClass}>{column.heading}</p>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
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
        </div>

        <div className="flex flex-col flex-wrap items-start justify-between gap-5 border-t border-uva-divider pt-7 min-[640px]:flex-row min-[640px]:items-center">
          <p className="text-[12.5px] text-uva-text-faint">
            Hecho en obra, para LATAM · © 2026 U.V.A.
          </p>
          <div className="flex gap-2.5">
            {socials.map(({ label, Icon, href }) => (
              <a
                key={label}
                href={href ?? "#"}
                target={href ? "_blank" : undefined}
                rel={href ? "noopener noreferrer" : undefined}
                aria-label={label}
                className="inline-flex h-10 w-10 items-center justify-center rounded-uva-md border border-uva-divider bg-transparent text-uva-text no-underline transition-[background,color,border-color] duration-[160ms] [transition-timing-function:ease] odd:hover:border-uva-accent odd:hover:bg-uva-accent odd:hover:text-uva-bg even:hover:border-uva-accent-2 even:hover:bg-uva-accent-2 even:hover:text-uva-bg hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
              >
                <Icon />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
