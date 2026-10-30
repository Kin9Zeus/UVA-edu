"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Accordion } from "@base-ui/react/accordion";
import {
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  Flag,
  MessageCircle,
  Minus,
  Plus,
  Search,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { VerificarCertificadoForm } from "@/components/home/VerificarCertificadoForm";
import {
  PREGUNTAS_CENTRO_AYUDA,
  TEMAS_SOPORTE,
  URL_REPORTE_PROBLEMA,
  type TemaSoporte,
} from "@/lib/soporte";
import { HORARIO_ATENCION, WHATSAPP_VISIBLE, urlWhatsapp } from "@/lib/contacto";
import { cn } from "@/lib/utils";

/** Para buscar sin que importen tildes ni mayúsculas ("certificacion" = "Certificación"). */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Texto en el que busca cada pregunta: la pregunta y, si es texto, la respuesta. */
const PREGUNTAS = PREGUNTAS_CENTRO_AYUDA.map((item, i) => ({
  ...item,
  id: `pregunta-${i}`,
  busqueda: normalizar(
    `${item.pregunta} ${typeof item.respuesta === "string" ? item.respuesta : ""}`,
  ),
}));

const PANEL =
  "h-[var(--accordion-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0";

/**
 * Centro de soporte (tablero "Soporte sin sesion" del lienzo "UVA Cursos"):
 * buscador de dudas, tres accesos directos (WhatsApp, reportar un problema y
 * verificar un certificado), los temas de soporte en acordeón con las
 * preguntas frecuentes adentro y, sin sesión, la invitación a entrar.
 *
 * Lo usan `/soporte` (con el encabezado y el pie del sitio) y
 * `/dashboard/soporte` (dentro del panel, con el mismo diseño). El panel no
 * tiene el pie con el formulario de verificar certificados, así que ahí va
 * en la página (`verificacionEnPagina`) y "Verifica un certificado" baja a él.
 *
 * El contenido es el de src/lib/soporte.tsx (el mismo del pie de página);
 * `temaAbierto` viene de `?tema=` y abre ese tema.
 */
export function SoporteCentro({
  temaAbierto,
  conSesion,
  verificacionEnPagina = false,
}: {
  temaAbierto?: TemaSoporte;
  conSesion: boolean;
  /** Pinta aquí el formulario de verificar certificados (el panel no tiene pie). */
  verificacionEnPagina?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [temas, setTemas] = useState<string[]>(() =>
    Array.from(new Set(["centro-de-ayuda", ...(temaAbierto ? [temaAbierto] : [])])),
  );
  const [preguntasAbiertas, setPreguntasAbiertas] = useState<string[]>([]);

  const consulta = normalizar(busqueda.trim());
  const buscando = consulta.length > 0;
  const visibles = buscando
    ? PREGUNTAS.filter((p) => p.busqueda.includes(consulta))
    : PREGUNTAS;

  // Mientras se busca, el centro de ayuda queda abierto y cada pregunta que
  // coincide, desplegada: el resultado se ve sin más clics.
  const temasValor = buscando ? Array.from(new Set([...temas, "centro-de-ayuda"])) : temas;
  const preguntasValor = buscando ? visibles.map((p) => p.id) : preguntasAbiertas;

  return (
    <div className="mx-auto grid w-full max-w-[820px] grid-cols-1 gap-7 px-uva-margen pt-10 pb-uva-seccion sm:pt-14">
      <div className="grid gap-2.5">
        <h1 className="text-uva-titulo-2 text-balance text-uva-text">¿En qué te podemos ayudar?</h1>
        <p className="text-uva-lead text-uva-text-muted">
          Busca tu duda o escríbenos. Respondemos de lunes a viernes, de 8 a. m. a 6 p. m.
        </p>
      </div>

      <div className="relative">
        <label htmlFor="soporte-buscar" className="sr-only">
          Buscar en soporte
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-uva-text-muted"
          strokeWidth={1.8}
        />
        <input
          id="soporte-buscar"
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Busca una duda: acceso, certificados, examen…"
          className="h-[52px] w-full rounded-uva-md border-[1.5px] border-uva-line-strong bg-uva-surface pr-3.5 pl-12 text-base text-uva-text placeholder:text-uva-text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
        />
        <p aria-live="polite" className="sr-only">
          {buscando
            ? visibles.length === 1
              ? "1 pregunta encontrada"
              : `${visibles.length} preguntas encontradas`
            : ""}
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Acceso
          href={urlWhatsapp()}
          externo
          icono={<MessageCircle className="size-[22px]" strokeWidth={2} />}
          titulo="Escríbenos por WhatsApp"
          detalle={`${WHATSAPP_VISIBLE} · ${HORARIO_ATENCION}`}
        />
        <Acceso
          href={URL_REPORTE_PROBLEMA}
          externo
          icono={<Flag className="size-[22px]" strokeWidth={2} />}
          titulo="Reportar un problema"
          detalle="Respondemos en un día hábil"
        />
        <Acceso
          href="#verificar-certificado"
          icono={<BadgeCheck className="size-[22px]" strokeWidth={2} />}
          titulo="Verifica un certificado"
          detalle="Con el código que aparece en el PDF"
        />
      </ul>

      <div className="overflow-hidden rounded-uva-lg border border-uva-divider bg-uva-surface">
        <Accordion.Root
          multiple
          value={temasValor}
          onValueChange={(valor) => setTemas(valor as string[])}
        >
          {TEMAS_SOPORTE.map((tema) => (
            <Accordion.Item
              key={tema.id}
              value={tema.id}
              className="border-b border-uva-divider"
            >
              {/* h2: son las secciones de la página, justo bajo el h1 (Base UI pone h3). */}
              <Accordion.Header render={<h2 />} className="m-0">
                <Accordion.Trigger className="group flex min-h-[60px] w-full items-center gap-3 px-4 text-left text-uva-cuerpo font-bold text-uva-text hover:text-uva-accent-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-uva-accent sm:px-[22px]">
                  <span className="flex-1">{tema.titulo}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className="size-[18px] shrink-0 text-uva-text-muted transition-transform duration-200 group-data-panel-open:rotate-180"
                    strokeWidth={2}
                  />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className={PANEL}>
                <div className="px-4 pb-4 text-uva-cuerpo text-uva-text-muted sm:px-[22px]">
                  {tema.id === "centro-de-ayuda" ? (
                    <PreguntasFrecuentes
                      preguntas={visibles}
                      abiertas={preguntasValor}
                      alCambiar={setPreguntasAbiertas}
                      sinResultados={buscando && visibles.length === 0 ? busqueda.trim() : null}
                    />
                  ) : (
                    tema.contenido
                  )}
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion.Root>

        {/* No es un tema más: sale de la app, por eso flecha diagonal en vez
            de chevron y no vive dentro del acordeón. */}
        <a
          href={URL_REPORTE_PROBLEMA}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[60px] items-center gap-3 px-4 text-uva-cuerpo font-bold text-uva-text hover:text-uva-accent-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-uva-accent sm:px-[22px]"
        >
          <Flag aria-hidden="true" className="size-[18px] shrink-0 text-uva-text-muted" strokeWidth={2} />
          <span className="flex-1">
            Reportar un problema<span className="sr-only"> (abre en otra pestaña)</span>
          </span>
          <ArrowUpRight aria-hidden="true" className="size-[18px] shrink-0 text-uva-text-muted" strokeWidth={2} />
        </a>
      </div>

      <p className="-mt-3 text-uva-detalle text-uva-text-muted">
        Los textos de Términos y Privacidad están en preparación.
      </p>

      {verificacionEnPagina && (
        <section
          aria-labelledby="soporte-verificar"
          className="flex scroll-mt-6 flex-col gap-3 rounded-uva-lg border border-uva-divider bg-uva-surface p-6"
        >
          <div>
            <h2 id="soporte-verificar" className="text-uva-titulo-4 text-uva-text">
              Verifica un certificado
            </h2>
            <p className="mt-1 text-uva-cuerpo text-uva-text-muted">
              Escribe el código que aparece en el PDF para confirmar que es válido.
            </p>
          </div>
          <VerificarCertificadoForm />
        </section>
      )}

      {!conSesion && (
        <section
          aria-labelledby="soporte-cuenta"
          className="flex flex-col gap-4 rounded-uva-lg border border-uva-divider bg-uva-surface p-6 sm:flex-row sm:items-center"
        >
          <div className="flex-1">
            <h2 id="soporte-cuenta" className="text-uva-titulo-4 text-uva-text">
              ¿Ya tienes cuenta?
            </h2>
            <p className="mt-1 text-uva-cuerpo text-uva-text-muted">
              Inicia sesión para ver tu acceso y tus certificados.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "uva-primary", size: "uva" }), "h-12 w-auto px-6 text-uva-cuerpo")}
            >
              Acceder
            </Link>
            <Link
              href="/dashboard/suscripcion"
              className={cn(buttonVariants({ variant: "uva-secondary", size: "uva" }), "h-12 w-auto border-[1.5px] border-uva-line-strong px-6 text-uva-cuerpo")}
            >
              Tengo un código
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function Acceso({
  href,
  externo = false,
  icono,
  titulo,
  detalle,
}: {
  href: string;
  externo?: boolean;
  icono: ReactNode;
  titulo: string;
  detalle: string;
}) {
  return (
    <li>
      <a
        href={href}
        {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        // "Verifica un certificado" baja al formulario (el del pie en /soporte,
        // el de la página en el panel): además de desplazarse, deja el foco
        // en el campo para escribir el código.
        onClick={
          externo
            ? undefined
            : () => requestAnimationFrame(() => document.getElementById("verificar-certificado")?.focus())
        }
        className="group flex h-full items-center gap-3 rounded-uva-lg border border-uva-divider bg-uva-surface p-4 hover:border-uva-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent sm:flex-col sm:items-start"
      >
        <span
          aria-hidden="true"
          className="grid size-[42px] flex-none place-items-center rounded-uva-md bg-uva-accent-2-soft text-uva-accent-2-text"
        >
          {icono}
        </span>
        <span className="min-w-0">
          <span className="block text-uva-cuerpo font-bold text-uva-text group-hover:text-uva-accent-ink">
            {titulo}
            {externo && <span className="sr-only"> (abre en otra pestaña)</span>}
          </span>
          <span className="mt-0.5 block text-uva-detalle text-uva-text-muted tabular-nums">{detalle}</span>
        </span>
      </a>
    </li>
  );
}

function PreguntasFrecuentes({
  preguntas,
  abiertas,
  alCambiar,
  sinResultados,
}: {
  preguntas: { id: string; pregunta: string; respuesta: ReactNode }[];
  abiertas: string[];
  alCambiar: (valor: string[]) => void;
  sinResultados: string | null;
}) {
  return (
    <>
      <p className="text-uva-detalle font-bold text-uva-text-muted">Preguntas frecuentes</p>
      {sinResultados !== null ? (
        <p className="mt-2 border-t border-uva-divider pt-3.5 text-uva-cuerpo text-uva-text-muted">
          No encontramos «{sinResultados}». Prueba con otra palabra o{" "}
          <a
            href={urlWhatsapp()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-uva-accent-ink underline underline-offset-4"
          >
            escríbenos por WhatsApp<span className="sr-only"> (abre en otra pestaña)</span>
          </a>
          .
        </p>
      ) : (
        <Accordion.Root
          multiple
          value={abiertas}
          onValueChange={(valor) => alCambiar(valor as string[])}
          className="mt-1.5"
        >
          {preguntas.map((item) => (
            <Accordion.Item key={item.id} value={item.id} className="border-t border-uva-divider">
              <Accordion.Header className="m-0">
                <Accordion.Trigger className="group flex min-h-[52px] w-full items-center gap-3 py-2.5 text-left text-uva-cuerpo font-medium text-uva-text data-panel-open:font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-[22px] flex-none place-items-center rounded-uva-xs border-[1.5px]",
                      "border-uva-line-strong text-uva-text-muted group-data-panel-open:border-uva-btn group-data-panel-open:text-uva-accent-ink",
                    )}
                  >
                    <Plus className="size-3.5 group-data-panel-open:hidden" strokeWidth={2.4} />
                    <Minus className="hidden size-3.5 group-data-panel-open:block" strokeWidth={2.4} />
                  </span>
                  <span className="min-w-0 flex-1">{item.pregunta}</span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className={PANEL}>
                <div className="pb-3.5 pl-[34px] text-uva-cuerpo text-uva-text-muted">{item.respuesta}</div>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      )}
    </>
  );
}
