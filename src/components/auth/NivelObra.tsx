/**
 * Nivel de obra del acceso (tablero "Nivel definitivo" del lienzo "UVA
 * Cursos", Login lab 7): barra de contorno fino con dos ojos, el tubo
 * amarillo con sus dos marcas y la burbuja. La burbuja sigue el recorrido de
 * cada flujo: a la izquierda al empezar, en el centro (entre las marcas)
 * cuando el paso está listo y a la derecha al terminar ("Contraseña
 * guardada"). Cada pantalla decide la posición; ver `POSICION_NIVEL`.
 *
 * Dibujo de tamaño fijo (400×36 en escritorio, 32 de alto en celular): sus
 * medidas van en px; donde hay que achicarlo se usa `zoom`. Solo marcado y
 * CSS, oculto para lectores de pantalla: el estado real lo cuentan el título
 * y el subtítulo. La transición de la burbuja la apaga la regla global de
 * `prefers-reduced-motion` (globals.css).
 */
export const POSICION_NIVEL = {
  inicio: "calc(25% - 10px)",
  avance: "37%",
  centro: "50%",
  final: "calc(75% + 10px)",
} as const;

export function NivelObra({ posicion }: { posicion: string }) {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto flex h-8 w-full max-w-[400px] items-center justify-center rounded-[6px] border-[1.5px] border-uva-text min-[900px]:h-9"
    >
      <Ojo className="left-[7%]" />
      <Ojo className="right-[7%]" />

      <span className="relative h-4 w-[52%] flex-none overflow-hidden rounded-full bg-uva-accent-2 ring-[1.5px] ring-uva-text min-[900px]:h-[18px]">
        <Marca className="left-[calc(50%-18px)] min-[900px]:left-[calc(50%-20px)]" />
        <Marca className="left-[calc(50%+13px)] min-[900px]:left-[calc(50%+15px)]" />
        <span
          className="absolute inset-y-[3px] w-5 -translate-x-1/2 rounded-full border-[1.5px] border-uva-on-bright bg-uva-on-accent transition-[left] duration-400 ease-[cubic-bezier(.3,1.5,.5,1)] min-[900px]:w-6"
          style={{ left: posicion }}
        />
      </span>
    </div>
  );
}

function Ojo({ className }: { className: string }) {
  return (
    <span
      className={`absolute top-1/2 size-3 -translate-y-1/2 rounded-full border-[1.5px] border-uva-text bg-[radial-gradient(circle,var(--uva-text)_0_1.5px,transparent_2px)] min-[900px]:size-3.5 ${className}`}
    />
  );
}

function Marca({ className }: { className: string }) {
  return (
    <span
      className={`absolute inset-y-0 w-[5px] bg-[linear-gradient(90deg,var(--uva-on-bright)_0_1.5px,transparent_1.5px_3.5px,var(--uva-on-bright)_3.5px_5px)] ${className}`}
    />
  );
}
