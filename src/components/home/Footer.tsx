import {
  YoutubeIcon,
  InstagramIcon,
  WhatsappIcon,
  SpotifyIcon,
  TiktokIcon,
} from "@/components/home/icons";

const columns = [
  {
    heading: "Escuelas",
    links: [
      "Arquitectura",
      "Residencia de obra",
      "Presupuestos y APU",
      "Coordinación BIM",
    ],
  },
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

export function Footer() {
  return (
    <footer className="home-footer">
      <div className="home-footer__inner">
        <div className="home-footer__grid">
          <div>
            <p className="home-footer__brand">
              U.V.A<span>.</span>
            </p>
            <p className="home-footer__desc">
              Formación en línea para el gremio de la construcción en LATAM.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <p className="home-footer__heading">{column.heading}</p>
              <ul className="home-footer__links">
                {column.links.map((link) => (
                  <li key={link}>
                    <a href="#">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="home-footer__bottom">
          <p className="home-footer__copy">
            Hecho en obra, para LATAM · © 2026 U.V.A.
          </p>
          <div className="home-footer__social">
            {socials.map(({ label, Icon, href }) => (
              <a
                key={label}
                href={href ?? "#"}
                target={href ? "_blank" : undefined}
                rel={href ? "noopener noreferrer" : undefined}
                className="home-footer__social-btn"
                aria-label={label}
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
