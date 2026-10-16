import type { ReactNode, Ref } from "react";
import { NivelPlano } from "@/components/auth/NivelPlano";
import { RutaPasos } from "@/components/auth/RutaPasos";
import { ACCESO_SUBTITULO, ACCESO_TITULO } from "@/components/auth/acceso";

/** Los tres pasos de recuperar contraseña (Recuperar / Nueva contraseña lab 7). */
export const PASOS_RECUPERAR = [
  "Escribes tu correo",
  "Te enviamos el enlace",
  "Creas una contraseña nueva",
];

/**
 * Contenido de la tarjeta de AccesoMarco en recuperar contraseña: el nivel,
 * el título, el subtítulo y la ruta de pasos, y debajo lo propio de cada
 * paso. Mismos espacios y compactación por altura que el login (AuthFlow).
 */
export function PasoAcceso({
  nivel,
  titulo,
  subtitulo,
  paso,
  tituloRef,
  children,
}: {
  nivel: { aNivel: boolean; posicion: number; cota: string };
  titulo: string;
  subtitulo: string;
  /** Paso actual de PASOS_RECUPERAR (3 = todos hechos). */
  paso: number;
  /** Para llevar el foco al título cuando el contenido cambia entero. */
  tituloRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 medio:gap-4 bajo:gap-3 muy-bajo:gap-2.5">
      {/* `zoom` (no `scale`) para que el nivel también ocupe menos alto. */}
      <div className="bajo:[zoom:0.8] muy-bajo:[zoom:0.5]">
        <NivelPlano {...nivel} />
      </div>

      <div className="grid grid-cols-1 gap-2 bajo:gap-1">
        <h1 ref={tituloRef} tabIndex={tituloRef ? -1 : undefined} className={ACCESO_TITULO}>
          {titulo}
        </h1>
        <p className={ACCESO_SUBTITULO}>{subtitulo}</p>
      </div>

      <RutaPasos etiqueta="Pasos para recuperar tu contraseña" pasos={PASOS_RECUPERAR} actual={paso} />

      <div className="grid grid-cols-1 gap-3 bajo:gap-2">{children}</div>
    </div>
  );
}
