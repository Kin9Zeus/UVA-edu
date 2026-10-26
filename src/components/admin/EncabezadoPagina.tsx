/**
 * Título de cada pantalla del panel, con una frase que dice para qué sirve.
 * Mismo tratamiento que el panel del estudiante («Hola Andrés, tienes metas
 * que alcanzar.»): el título va en la página, no en el encabezado.
 */
export function EncabezadoPagina({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div>
      <h1 className="text-uva-titulo-3 text-balance text-uva-text">{titulo}</h1>
      <p className="mt-2 max-w-[68ch] text-uva-lead text-uva-text-muted">{descripcion}</p>
    </div>
  );
}
