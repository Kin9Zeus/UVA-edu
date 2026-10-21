import type { ReactNode, Ref } from "react";
import { NivelObra } from "@/components/auth/NivelObra";
import { RutaPasos } from "@/components/auth/RutaPasos";
import { ACCESO_SUBTITULO, ACCESO_TITULO } from "@/components/auth/acceso";

/** Los tres pasos de recuperar contraseña (Recuperar / Nueva contraseña lab 7). */
export const PASOS_RECUPERAR = [
  "Escribes tu correo",
  "Te enviamos el enlace",
  "Creas una contraseña nueva",
];

/** Los tres pasos de canjear una invitación (/canjear). */
export const PASOS_CANJEAR = ["Tu cuenta", "Tu código", "Listo"];

/**
 * Contenido de la tarjeta de AccesoMarco en recuperar contraseña: el nivel,
 * el título, el subtítulo y la ruta de pasos, y debajo lo propio de cada
 * paso. Mismos espacios y compactación por altura que el login (AuthFlow).
 */
export function PasoAcceso({
  posicionNivel,
  titulo,
  subtitulo,
  paso,
  tituloRef,
  pasos = PASOS_RECUPERAR,
  etiquetaPasos = "Pasos para recuperar tu contraseña",
  children,
}: {
  /** Posición de la burbuja del nivel (POSICION_NIVEL). */
  posicionNivel: string;
  titulo: string;
  subtitulo: string;
  /** Paso actual de PASOS_RECUPERAR (`pasos.length` = todos hechos). */
  paso: number;
  /** Para llevar el foco al título cuando el contenido cambia entero. */
  tituloRef?: Ref<HTMLHeadingElement>;
  /** Los pasos de la ruta; por defecto, los de recuperar contraseña. */
  pasos?: string[];
  etiquetaPasos?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 medio:gap-4 bajo:gap-3 muy-bajo:gap-2.5">
      {/* `zoom` (no `scale`) para que el nivel también ocupe menos alto. */}
      <div className="muy-bajo:[zoom:0.85]">
        <NivelObra posicion={posicionNivel} />
      </div>

      <div className="grid grid-cols-1 gap-2 bajo:gap-1">
        {/* Estas tarjetas llevan la ruta de pasos y son más altas que el
            login: el título baja un escalón ya en `medio`, y en `muy-bajo`
            el subtítulo queda solo para el lector de pantalla. */}
        <h1
          ref={tituloRef}
          tabIndex={tituloRef ? -1 : undefined}
          className={`${ACCESO_TITULO} medio:text-uva-titulo-4`}
        >
          {titulo}
        </h1>
        <p className={`${ACCESO_SUBTITULO} muy-bajo:sr-only`}>{subtitulo}</p>
      </div>

      <RutaPasos etiqueta={etiquetaPasos} pasos={pasos} actual={paso} />

      <div className="grid grid-cols-1 gap-3 bajo:gap-2">{children}</div>
    </div>
  );
}
