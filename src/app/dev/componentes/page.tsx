import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SelectorTemaBoton } from "@/components/tema/SelectorTema";
import { Button } from "@/components/ui/button";
import { MensajeError } from "@/components/auth/MensajeError";
import { Campo } from "@/components/ui/campo";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DemoAvisos } from "@/components/dev/DemoAvisos";
import { CursoTarjetaPublica } from "@/components/catalogo/CursoTarjetaPublica";
import type { CursoDeCategoria } from "@/lib/categoria";
import { DemoDialogo, DemoSelector } from "@/components/dev/DemoControles";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { EsqueletoRegion, Skeleton } from "@/components/ui/skeleton";
import { DemoErrorCarga } from "@/components/dev/DemoErrorCarga";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "U.V.A. — Componentes base",
  robots: { index: false, follow: false },
};

const FOCO = "outline-2 outline-offset-2 outline-solid outline-uva-accent";

const VARIANTES_BOTON = [
  { variant: "primary", nombre: "Principal" },
  { variant: "default", nombre: "Secundario" },
  { variant: "link", nombre: "De texto" },
  { variant: "ghost", nombre: "Fantasma" },
  { variant: "destructive", nombre: "Destructivo" },
] as const;

/** Hover y presionado no se pueden fijar con CSS: se prueban con el puntero
 *  (columna «Normal»). Foco se fuerza con una clase para poder capturarlo. */
function SeccionBoton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-y-3 text-left text-uva-detalle">
        <thead>
          <tr className="text-uva-text-muted">
            <th scope="col" className="font-medium">Variante</th>
            <th scope="col" className="font-medium">Normal (pasa el cursor / presiona)</th>
            <th scope="col" className="font-medium">Foco</th>
            <th scope="col" className="font-medium">Deshabilitado</th>
            <th scope="col" className="font-medium">Cargando</th>
          </tr>
        </thead>
        <tbody>
          {VARIANTES_BOTON.map(({ variant, nombre }) => (
            <tr key={variant}>
              <th scope="row" className="pr-4 font-medium">{nombre}</th>
              <td><Button variant={variant}>Guardar</Button></td>
              <td><Button variant={variant} className={FOCO}>Guardar</Button></td>
              <td><Button variant={variant} disabled>Guardar</Button></td>
              <td><Button variant={variant} cargando>Guardando</Button></td>
            </tr>
          ))}
          <tr>
            <th scope="row" className="pr-4 font-medium">Con ícono</th>
            <td>
              <Button variant="primary">
                Continuar <ArrowRight aria-hidden="true" />
              </Button>
            </td>
            <td>
              <Button variant="default" size="icon" aria-label="Siguiente">
                <ArrowRight aria-hidden="true" />
              </Button>
            </td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SeccionCampo() {
  return (
    <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
      <Campo id="c-normal" name="normal" etiqueta="Nombre" placeholder="Ana Pérez" />
      <Campo id="c-ayuda" name="ayuda" etiqueta="Correo" type="email" ayuda="Te escribimos aquí, nunca compartimos tu correo." />
      <Campo id="c-req" name="req" etiqueta="Ciudad" required placeholder="Medellín" />
      <Campo id="c-error" name="error" etiqueta="Correo" type="email" defaultValue="ana@" error="Escribe un correo válido, por ejemplo ana@correo.com." />
      <Campo id="c-foco" name="foco" etiqueta="Foco (forzado)" className="[&_input]:border-uva-accent [&_input]:outline-2 [&_input]:outline-solid [&_input]:outline-uva-accent" />
      <Campo id="c-dis" name="dis" etiqueta="Deshabilitado" disabled defaultValue="No editable" />
      <Campo id="c-pass" name="pass" etiqueta="Contraseña" type="password" ayuda="Mínimo 8 caracteres." />
      <Campo id="c-pass-err" name="passerr" etiqueta="Contraseña con error" type="password" error="La contraseña es muy corta." />
    </div>
  );
}

const CURSO_DEMO: CursoDeCategoria = {
  id: "demo",
  slug: "demo",
  titulo: "Estructuras de concreto reforzado desde cero, con ejemplos de obra real",
  nivel: "INTERMEDIO",
  instructorNombre: "Ana Ruiz, Daniel Castaño",
  categorias: [{ id: "c1", nombre: "Estructuras" }],
  totalClases: 24,
  duracionTotalSegundos: 5 * 3600 + 20 * 60,
  imagenPortada: "",
};

/** Un solo enlace (el título) estirado sobre toda la tarjeta. Tab pasa una vez. */
function SeccionTarjetaCurso() {
  return (
    <div className="grid max-w-5xl gap-8 md:grid-cols-3">
      <CursoTarjetaPublica curso={CURSO_DEMO} categoria={CURSO_DEMO.categorias[0]} disposicion="tarjeta" />
      <CursoTarjetaPublica curso={{ ...CURSO_DEMO, titulo: "Título corto" }} categoria={CURSO_DEMO.categorias[0]} disposicion="tarjeta" />
      <CursoTarjetaPublica
        curso={CURSO_DEMO}
        categoria={CURSO_DEMO.categorias[0]}
        disposicion="tarjeta"
        sobrePortada={<Badge variant="completada" className="absolute top-2 left-2 bg-uva-surface">Completada</Badge>}
      />
    </div>
  );
}

function SeccionTextarea() {
  return (
    <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
      <div>
        <Label htmlFor="t-normal" className="text-uva-detalle font-medium text-uva-text">Comentario</Label>
        <Textarea id="t-normal" placeholder="Cuéntanos qué te pareció" />
      </div>
      <div>
        <Label htmlFor="t-error" className="text-uva-detalle font-medium text-uva-text">Motivo</Label>
        <Textarea id="t-error" aria-invalid="true" aria-describedby="t-error-msg" defaultValue="." />
        <div className="mt-1.5"><MensajeError id="t-error-msg">Escribe al menos 10 caracteres.</MensajeError></div>
      </div>
      <div>
        <Label htmlFor="t-dis" className="text-uva-detalle font-medium text-uva-text">Deshabilitado</Label>
        <Textarea id="t-dis" disabled defaultValue="No editable" />
      </div>
    </div>
  );
}

function SeccionInsignias() {
  return (
    <div className="flex flex-wrap gap-3">
      <Badge variant="nivel">Intermedio</Badge>
      <Badge variant="categoria">Diseño estructural</Badge>
      <Badge variant="bloqueada">Bloqueada</Badge>
      <Badge variant="completada">Completada</Badge>
    </div>
  );
}

function SeccionProgreso() {
  return (
    <div className="grid max-w-md gap-5">
      {[0, 35, 100].map((v) => (
        <div key={v} className="flex items-center gap-3">
          <Progress value={v} aria-label={`Avance del curso, ${v} por ciento`} className="flex-1" />
          <span className="w-12 text-right font-mono text-uva-detalle font-bold">{v}%</span>
        </div>
      ))}
    </div>
  );
}

function SeccionEstados() {
  return (
    <div className="grid max-w-3xl gap-6 md:grid-cols-3">
      <EsqueletoRegion etiqueta="Cargando cursos" className="flex flex-col gap-3 rounded-uva-lg border border-uva-divider bg-uva-surface p-6">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </EsqueletoRegion>
      <EstadoVacio
        titulo="Todavía no tienes cursos"
        texto="Elige uno en el catálogo y arranca con la primera clase."
        accion={{ etiqueta: "Ver el catálogo", href: "/dashboard/catalogo" }}
        nivel={3}
      />
      <DemoErrorCarga />
    </div>
  );
}

/** Cada componente base se agrega aquí con todos sus estados, uno por commit. */
const SECCIONES: { id: string; titulo: string; contenido?: React.ReactNode }[] = [
  { id: "boton", titulo: "Botón", contenido: <SeccionBoton /> },
  { id: "campo", titulo: "Campo de texto", contenido: <><SeccionCampo /><div className="mt-8"><SeccionTextarea /></div></> },
  { id: "selector", titulo: "Selector y filtros", contenido: <DemoSelector /> },
  { id: "tarjeta-curso", titulo: "Tarjeta de curso", contenido: <SeccionTarjetaCurso /> },
  { id: "insignias", titulo: "Insignias", contenido: <SeccionInsignias /> },
  { id: "progreso", titulo: "Barra de progreso", contenido: <SeccionProgreso /> },
  { id: "estados", titulo: "Estados: carga, vacío y error", contenido: <SeccionEstados /> },
  { id: "toast", titulo: "Aviso emergente", contenido: <DemoAvisos /> },
  { id: "dialogo", titulo: "Diálogo", contenido: <DemoDialogo /> },
];

/**
 * Catálogo interno del sistema de diseño: todos los componentes base con sus
 * estados, para revisarlos en claro y oscuro. Solo existe en desarrollo
 * (en producción responde 404). Vive en `/dev/` fuera de los grupos de rutas
 * para no heredar el header ni el sidebar del producto.
 */
export default function ComponentesPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-screen bg-uva-bg text-uva-text">
      <header className="sticky top-0 z-40 border-b border-uva-divider bg-uva-bg">
        <div className="mx-auto flex max-w-uva items-center justify-between gap-4 px-uva-margen py-3">
          <h1 className="text-uva-titulo-4 font-bold">Componentes base</h1>
          <SelectorTemaBoton />
        </div>
        <nav aria-label="Componentes" className="mx-auto max-w-uva overflow-x-auto px-uva-margen">
          <ul className="flex gap-1 pb-2">
            {SECCIONES.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="inline-flex min-h-11 items-center rounded-uva-md px-3 text-uva-detalle whitespace-nowrap text-uva-text-muted hover:bg-uva-hover hover:text-uva-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
                >
                  {s.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-uva px-uva-margen py-10">
        {SECCIONES.map((s) => (
          <section
            key={s.id}
            id={s.id}
            aria-labelledby={`${s.id}-titulo`}
            className="scroll-mt-32 border-b border-uva-divider py-8 first:pt-0"
          >
            <h2 id={`${s.id}-titulo`} className="mb-4 text-uva-titulo-3 font-bold">
              {s.titulo}
            </h2>
            {s.contenido ?? (
              <p className="text-uva-detalle text-uva-text-muted">Pendiente.</p>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
