"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AvisoAcceso } from "@/components/auth/AvisoAcceso";
import { PasoAcceso, PASOS_CANJEAR } from "@/components/auth/PasoAcceso";
import { POSICION_NIVEL } from "@/components/auth/NivelObra";
import { ACCESO_BOTON, ACCESO_ENLACE } from "@/components/auth/acceso";
import { CanjearCodigoForm } from "@/components/dashboard/CanjearCodigoForm";
import { cn } from "@/lib/utils";

/**
 * Canjear una invitación (/canjear): el paso del recorrido de acceso que va
 * entre confirmar el correo y ver los cursos. Es el mismo formulario de
 * «Mi suscripción», con el marco y la ruta de pasos del resto del acceso.
 *
 * Tras un canje correcto el formulario refresca la página (router.refresh):
 * el servidor vuelve a leer la suscripción, `vigencia` llega con valor y esta
 * pantalla pasa sola a la bienvenida. Quien ya tenía acceso la ve directo.
 */
export function CanjearFlujo({ vigencia }: { vigencia: string | null }) {
  const tieneAcceso = vigencia !== null;

  // El contenido se reemplaza entero: el foco va al título nuevo para que el
  // lector de pantalla lo anuncie. Se salta el primer render.
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    tituloRef.current?.focus();
  }, [tieneAcceso]);

  if (tieneAcceso) {
    return (
      <PasoAcceso
        posicionNivel={POSICION_NIVEL.final}
        titulo="Ya tienes acceso a todos los cursos"
        subtitulo="Empieza por el que más te sirva en la obra."
        paso={PASOS_CANJEAR.length}
        pasos={PASOS_CANJEAR}
        etiquetaPasos="Pasos para canjear tu invitación"
        tituloRef={tituloRef}
      >
        <AvisoAcceso icono="ok">{vigencia}</AvisoAcceso>
        {/* Enlaces, no botones: son navegación. */}
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "uva-primary", size: "uva" }), ACCESO_BOTON)}
        >
          Ir a mis cursos
        </Link>
        <Link
          href="/dashboard/catalogo"
          className={cn(buttonVariants({ variant: "uva-secondary", size: "uva" }), ACCESO_BOTON)}
        >
          Ver el catálogo
        </Link>
      </PasoAcceso>
    );
  }

  return (
    <PasoAcceso
      posicionNivel={POSICION_NIVEL.centro}
      titulo="Canjea tu invitación"
      subtitulo="Pega el código tal como te llegó. Nosotros lo ordenamos."
      paso={1}
      pasos={PASOS_CANJEAR}
      etiquetaPasos="Pasos para canjear tu invitación"
      tituloRef={tituloRef}
    >
      <CanjearCodigoForm tieneSuscripcion={false} embebido sinEncabezado />
      <p>
        <Link href="/dashboard" className={ACCESO_ENLACE}>
          Ahora no, ir a mi panel
        </Link>
      </p>
    </PasoAcceso>
  );
}
