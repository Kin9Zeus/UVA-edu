/**
 * Primer elemento enfocable de toda página: con Tab aparece arriba a la
 * izquierda y Enter lleva el foco al `<main id="contenido">`. Oculto hasta
 * recibir foco (`sr-only` + `focus:not-sr-only`).
 */
export function SaltarAlContenido() {
  return (
    <a
      href="#contenido"
      className="sr-only focus:not-sr-only focus:fixed focus:top-[max(0.5rem,env(safe-area-inset-top))] focus:left-[max(0.75rem,env(safe-area-inset-left))] focus:z-[100] focus:min-h-11 focus:content-center focus:rounded-uva-md focus:bg-uva-text focus:px-4 focus:text-uva-cuerpo focus:font-bold focus:text-uva-bg focus:outline-2 focus:outline-offset-2 focus:outline-uva-accent"
    >
      Saltar al contenido
    </a>
  );
}
