import Link from "next/link";
import { Building2, Ruler, Calculator, HardHat, Layers } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const PORTADA_TRAMA = {
  backgroundColor: "#141417",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(250,250,250,.045) 0 2px, transparent 2px 9px)",
};

const rutasActivas = [
  {
    id: "presupuestos-obra-gris",
    tipo: "Ruta",
    titulo: "Presupuestos de obra gris",
    cursosCompletados: 3,
    cursosTotal: 6,
    horasRestantes: 8,
    progreso: 50,
  },
  {
    id: "residencia-de-obra",
    tipo: "Ruta",
    titulo: "Residencia de obra",
    cursosCompletados: 1,
    cursosTotal: 5,
    horasRestantes: 14,
    progreso: 20,
  },
];

const sigueAprendiendo = [
  {
    id: "apu-fundamentos",
    categoria: "Presupuestos",
    curso: "APU desde cero",
    clase: "Cuadrillas y rendimientos",
    minutos: "18/32 min",
    progreso: 56,
  },
  {
    id: "revit-basico",
    categoria: "Software",
    curso: "Revit para presupuestadores",
    clase: "Cómputos automáticos",
    minutos: "9/25 min",
    progreso: 36,
  },
  {
    id: "seguridad-obra",
    categoria: "Seguridad",
    curso: "SST en obra gris",
    clase: "Permisos de trabajo en altura",
    minutos: "22/40 min",
    progreso: 55,
  },
  {
    id: "concreto-estructural",
    categoria: "Estructuras",
    curso: "Concreto estructural",
    clase: "Curado y control de calidad",
    minutos: "5/28 min",
    progreso: 18,
  },
];

const categorias = [
  { id: "presupuestos", nombre: "Presupuestos", conteo: "18 rutas", icon: Calculator },
  { id: "estructuras", nombre: "Estructuras", conteo: "12 rutas", icon: Building2 },
  { id: "residencia", nombre: "Residencia de obra", conteo: "9 rutas", icon: HardHat },
  { id: "planos", nombre: "Planos y diseño", conteo: "15 rutas", icon: Ruler },
  { id: "acabados", nombre: "Acabados", conteo: "7 rutas", icon: Layers },
];

export function InicioContent({ nombre }: { nombre: string }) {
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? nombre;

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-10 px-[clamp(20px,3vw,44px)] py-8">
      <div>
        <h1 className="text-2xl text-uva-text">
          Hola {primerNombre}, tienes metas que alcanzar.
        </h1>
        <p className="mt-1 text-sm text-uva-text-muted">
          Retoma donde quedaste o explora algo nuevo del gremio.
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-base text-uva-text">Tus rutas activas</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rutasActivas.map((ruta) => (
            <div
              key={ruta.id}
              className="flex gap-4 rounded-uva-md border border-uva-divider bg-uva-surface p-4"
            >
              <div
                className="h-[88px] w-[120px] shrink-0 rounded-uva-sm"
                style={PORTADA_TRAMA}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-mono text-[11px] tracking-[.08em] text-uva-accent-text uppercase">
                  {ruta.tipo}
                </span>
                <h3 className="mt-0.5 truncate text-sm text-uva-text">{ruta.titulo}</h3>
                <p className="mt-1 text-xs text-uva-text-faint">
                  {ruta.cursosCompletados}/{ruta.cursosTotal} cursos · {ruta.horasRestantes} h restantes
                </p>
                <Progress value={ruta.progreso} className="mt-2" />
                <Button
                  render={<Link href="/dashboard/catalogo" />}
                  nativeButton={false}
                  variant="uva-ghost"
                  size="uva"
                  className="mt-2 h-8 w-auto self-start px-0 text-xs"
                >
                  Continuar ruta
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-base text-uva-text">Sigue aprendiendo</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sigueAprendiendo.map((clase) => (
            <Link
              key={clase.id}
              href="/dashboard/catalogo"
              className="group flex flex-col rounded-uva-md border border-uva-divider bg-uva-surface p-3 hover:border-uva-text-faint"
            >
              <div className="relative h-[100px] rounded-uva-sm" style={PORTADA_TRAMA}>
                <span className="absolute top-2 left-2 rounded-full bg-uva-accent-soft px-2 py-0.5 text-[10px] text-uva-accent-text">
                  En curso
                </span>
                <div className="absolute right-2 bottom-2 left-2">
                  <Progress value={clase.progreso} />
                </div>
              </div>
              <span className="mt-2 font-mono text-[10px] tracking-[.08em] text-uva-text-faint uppercase">
                {clase.categoria}
              </span>
              <h3 className="mt-0.5 truncate text-sm text-uva-text">{clase.curso}</h3>
              <p className="truncate text-xs text-uva-text-muted">{clase.clase}</p>
              <p className="mt-1 font-mono text-[11px] text-uva-text-faint tabular-nums">
                {clase.minutos}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-base text-uva-text">Explora por categoría</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categorias.map((categoria, index) => {
            const Icon = categoria.icon;
            const esFucsia = index % 2 === 0;
            return (
              <Link
                key={categoria.id}
                href="/dashboard/catalogo"
                className={`flex flex-col justify-between rounded-uva-md border border-uva-divider p-4 transition-colors ${
                  esFucsia ? "hover:border-uva-accent" : "hover:border-uva-accent-2"
                }`}
                style={{
                  background: esFucsia
                    ? "linear-gradient(160deg, color-mix(in oklch, var(--color-uva-accent) 16%, var(--color-uva-surface)) 0%, var(--color-uva-surface) 70%)"
                    : "linear-gradient(160deg, color-mix(in oklch, var(--color-uva-accent-2) 16%, var(--color-uva-surface)) 0%, var(--color-uva-surface) 70%)",
                }}
              >
                <Icon
                  className={`size-5 ${esFucsia ? "text-uva-accent" : "text-uva-accent-2"}`}
                  strokeWidth={1.9}
                />
                <div className="mt-6">
                  <p className="text-sm text-uva-text">{categoria.nombre}</p>
                  <p className="text-xs text-uva-text-faint">{categoria.conteo}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
