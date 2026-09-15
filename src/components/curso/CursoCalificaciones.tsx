"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, ShieldAlert } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EstrellasCalificacion, EstrellasInput } from "@/components/curso/EstrellasCalificacion";
import {
  calificarCurso,
  eliminarCalificacionPropia,
  moderarCalificacion,
  reaccionarCalificacion,
  quitarReaccionCalificacion,
} from "@/actions/cursos/calificaciones";
import type { CalificacionesCurso } from "@/lib/curso-calificaciones";

function iniciales(nombre: string) {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

function BotonMeGusta({
  calificacionId,
  ruta,
  meGusta: meGustaInicial,
  total: totalInicial,
  puedeReaccionar,
}: {
  calificacionId: string;
  ruta: string;
  meGusta: boolean;
  total: number;
  puedeReaccionar: boolean;
}) {
  const router = useRouter();
  const [optimista, setOptimista] = useState<{ meGusta: boolean; total: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const meGusta = optimista?.meGusta ?? meGustaInicial;
  const total = optimista?.total ?? totalInicial;

  function alternar() {
    if (!puedeReaccionar) return;
    const siguiente = { meGusta: !meGusta, total: meGusta ? total - 1 : total + 1 };
    setOptimista(siguiente);
    startTransition(async () => {
      const accion = siguiente.meGusta ? reaccionarCalificacion : quitarReaccionCalificacion;
      const resultado = await accion(calificacionId, ruta);
      if ("error" in resultado) {
        setOptimista({ meGusta, total });
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={!puedeReaccionar || pending}
      onClick={alternar}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-1.5 py-1 text-xs font-medium text-uva-text-faint transition-colors hover:bg-white/5 hover:text-uva-text-muted disabled:cursor-not-allowed disabled:hover:bg-transparent ${meGusta ? "text-uva-accent hover:text-uva-accent" : ""}`}
    >
      <Heart className="size-3.5" strokeWidth={2.4} fill={meGusta ? "currentColor" : "none"} />
      {total > 0 ? total : "Me gusta"}
    </button>
  );
}

/** Formulario para crear/editar la reseña propia — precargado desde
 * `miCalificacion` si ya existe (upsert de una fila por usuario, ver
 * calificarCurso). Solo se renderiza si `puedeCalificar` (curso.tieneAcceso
 * en CursoDetalleContent): mismo umbral que comentar una lección. */
function FormularioCalificacion({
  cursoId,
  ruta,
  miCalificacion,
}: {
  cursoId: string;
  ruta: string;
  miCalificacion: CalificacionesCurso["miCalificacion"];
}) {
  const router = useRouter();
  const [puntuacion, setPuntuacion] = useState(miCalificacion?.puntuacion ?? 0);
  const [comentario, setComentario] = useState(miCalificacion?.comentario ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function enviar() {
    if (puntuacion < 1) {
      setError("Elige una calificación de 1 a 5 estrellas.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const resultado = await calificarCurso(cursoId, puntuacion, comentario, ruta);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  function eliminar() {
    if (!miCalificacion) return;
    startTransition(async () => {
      const resultado = await eliminarCalificacionPropia(miCalificacion.id, ruta);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setPuntuacion(0);
      setComentario("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-uva-md bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-uva-text">
          {miCalificacion ? "Tu reseña" : "¿Qué te pareció este curso?"}
        </p>
        <EstrellasInput valor={puntuacion} onCambiar={setPuntuacion} disabled={pending} />
      </div>
      <Textarea
        value={comentario}
        onChange={(event) => setComentario(event.target.value)}
        placeholder="Cuéntale a otros estudiantes qué aprendiste (opcional)"
        maxLength={1000}
        disabled={pending}
        className="min-h-20"
      />
      {error && <p className="text-xs text-uva-error-text">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="uva-primary"
          size="uva"
          className="min-h-7 w-fit px-3 text-xs"
          disabled={pending}
          onClick={enviar}
        >
          {pending ? "Publicando…" : "Publicar"}
        </Button>
        {miCalificacion && (
          <button
            type="button"
            disabled={pending}
            onClick={eliminar}
            className="cursor-pointer border-0 bg-transparent p-0 text-xs text-uva-text-faint hover:text-uva-error-text disabled:cursor-not-allowed"
          >
            Eliminar mi reseña
          </button>
        )}
      </div>
    </div>
  );
}

/** Celda de reseña sin caja: nada de fondo ni borde propio — cada
 * columna se separa de la siguiente con una línea vertical fina entre
 * columnas (no antes de la primera de cada fila de 3), como las
 * secciones de un periódico, en vez de encerrar cada reseña en un
 * rectángulo. `h-full` estira la celda a la altura de su fila para que
 * la línea llegue de punta a punta. El botón "Me gusta" queda fijo justo
 * debajo del encabezado — no al final — así que no importa si el
 * comentario es largo, corto o no existe: nada más se desalinea. */
function CeldaResena({
  reseña,
  ruta,
  usuarioActualId,
  esAdmin,
  pendienteModerar,
  onModerar,
  columna,
}: {
  reseña: CalificacionesCurso["reseñas"][number];
  ruta: string;
  usuarioActualId: string | null;
  esAdmin: boolean;
  pendienteModerar: boolean;
  onModerar: (calificacionId: string) => void;
  /** Posición dentro de la fila de 3 (0, 1 o 2): decide si lleva línea
   * divisoria a la izquierda y/o padding para separarse de la siguiente. */
  columna: 0 | 1 | 2;
}) {
  return (
    <div
      className={`flex h-full min-w-0 gap-3 ${columna !== 0 ? "sm:border-l sm:border-uva-divider sm:pl-6" : ""} ${columna !== 2 ? "sm:pr-6" : ""}`}
    >
      <Avatar className="size-10 shrink-0 bg-uva-divider">
        {reseña.autorFotoUrl && <AvatarImage src={reseña.autorFotoUrl} alt="" />}
        <AvatarFallback className="bg-uva-divider text-xs text-uva-text">
          {iniciales(reseña.autorNombre)}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <p className="truncate text-sm font-medium text-uva-text">{reseña.autorNombre}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <EstrellasCalificacion puntuacion={reseña.puntuacion} size={13} />
            <span className="shrink-0 text-xs text-uva-text-faint">{reseña.tiempo}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <BotonMeGusta
            calificacionId={reseña.id}
            ruta={ruta}
            meGusta={reseña.meGusta}
            total={reseña.totalMeGusta}
            puedeReaccionar={Boolean(usuarioActualId)}
          />
          {esAdmin && reseña.autorId !== usuarioActualId && (
            <button
              type="button"
              disabled={pendienteModerar}
              onClick={() => onModerar(reseña.id)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-1.5 py-1 text-xs font-medium text-uva-text-faint transition-colors hover:bg-white/5 hover:text-uva-error-text disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <ShieldAlert className="size-3.5" strokeWidth={2.2} />
              Eliminar
            </button>
          )}
        </div>

        {reseña.comentario && (
          <p className="max-h-28 overflow-y-auto text-[15px] leading-relaxed break-words text-uva-text-muted">
            {reseña.comentario}
          </p>
        )}
      </div>
    </div>
  );
}

/** Sección completa de calificaciones de un curso: promedio + formulario
 * propio (si aplica) + lista pública de reseñas con "me gusta". Visible sin
 * sesión (a diferencia de Comunidad, el catálogo es público) — por eso
 * `usuarioActualId`/`puedeCalificar` llegan como `null`/`false` para un
 * visitante anónimo, y la UI de escribir/reaccionar simplemente no aparece. */
export function CursoCalificaciones({
  cursoId,
  ruta,
  usuarioActualId,
  puedeCalificar,
  esAdmin,
  datos,
}: {
  cursoId: string;
  ruta: string;
  usuarioActualId: string | null;
  puedeCalificar: boolean;
  esAdmin: boolean;
  datos: CalificacionesCurso;
}) {
  const router = useRouter();
  const [pendienteModerar, startTransitionModerar] = useTransition();

  function moderar(calificacionId: string) {
    startTransitionModerar(async () => {
      await moderarCalificacion(calificacionId, ruta);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-base text-uva-text">Reseñas</h2>

      {puedeCalificar && (
        // `key` fuerza a remontar el formulario cuando pasa de "sin reseña"
        // a "con reseña" (o cambia de id): así el estado local se
        // reinicializa desde `miCalificacion` recién confirmado por el
        // servidor en vez de quedarse con lo que había en el textarea
        // antes de publicar — el texto que se ve después es el que
        // realmente quedó guardado.
        <FormularioCalificacion
          key={datos.miCalificacion?.id ?? "nueva"}
          cursoId={cursoId}
          ruta={ruta}
          miCalificacion={datos.miCalificacion}
        />
      )}

      {datos.reseñas.length === 0 ? (
        <p className="text-sm text-uva-text-faint">Todavía no hay reseñas de este curso.</p>
      ) : (
        <div className="grid grid-cols-1 gap-y-5 sm:grid-cols-3">
          {datos.reseñas.map((reseña, index) => (
            <CeldaResena
              key={reseña.id}
              reseña={reseña}
              ruta={ruta}
              usuarioActualId={usuarioActualId}
              esAdmin={esAdmin}
              pendienteModerar={pendienteModerar}
              onModerar={moderar}
              columna={(index % 3) as 0 | 1 | 2}
            />
          ))}
        </div>
      )}
    </div>
  );
}
