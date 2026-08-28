"use client";

/**
 * Controles de paginación compartidos. Extraído de CatalogoContent, que era
 * el único sitio del proyecto que paginaba, para que la tabla de usuarios del
 * panel no duplique el markup ni los estilos.
 *
 * No conoce la URL: recibe `onCambiarPagina` y deja que cada pantalla decida
 * cómo navega (el catálogo y el panel construyen sus query params distinto).
 * Se oculta sola cuando hay una única página.
 */
export function Paginacion({
  pagina,
  totalPaginas,
  onCambiarPagina,
}: {
  pagina: number;
  totalPaginas: number;
  onCambiarPagina: (pagina: number) => void;
}) {
  if (totalPaginas <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-4" aria-label="Paginación">
      <button
        type="button"
        disabled={pagina <= 1}
        onClick={() => onCambiarPagina(pagina - 1)}
        className="rounded-uva-md border border-uva-divider px-4 py-2 text-[13px] text-uva-text disabled:opacity-40"
      >
        Anterior
      </button>
      {/* aria-live: al cambiar de página el foco se queda en el botón y un
          lector de pantalla no anunciaría nada sin esto. */}
      <span className="font-mono text-xs text-uva-text-faint" aria-live="polite">
        Página {pagina} de {totalPaginas}
      </span>
      <button
        type="button"
        disabled={pagina >= totalPaginas}
        onClick={() => onCambiarPagina(pagina + 1)}
        className="rounded-uva-md border border-uva-divider px-4 py-2 text-[13px] text-uva-text disabled:opacity-40"
      >
        Siguiente
      </button>
    </nav>
  );
}
