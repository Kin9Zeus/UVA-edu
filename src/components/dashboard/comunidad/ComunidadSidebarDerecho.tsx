import Link from "next/link";
import { getComunidadActividadReciente, getComunidadDestacados } from "@/lib/comunidad";
import { cn } from "@/lib/utils";

/** Riel derecho de Comunidad, solo desktop (`ComunidadLayout` lo oculta
 * antes de `xl`). Se auto-alimenta (componente de servidor async) para no
 * duplicar las consultas en cada página que use el layout. Ambos bloques
 * salen de datos reales ya existentes — ver `getComunidadActividadReciente`
 * y `getComunidadDestacados` en src/lib/comunidad.ts. Si no hay nada que
 * mostrar, no renderiza un hueco vacío. */
export async function ComunidadSidebarDerecho() {
  const [actividad, destacados] = await Promise.all([getComunidadActividadReciente(), getComunidadDestacados()]);

  if (actividad.length === 0 && destacados.length === 0) return null;

  return (
    <>
      {/* Sin marco: son dos listas de enlaces, no dos objetos. Enmarcadas
          pesaban exactamente lo mismo que las publicaciones del feed, y un
          riel es contexto — tiene que leerse más callado que el contenido,
          no competir con él. Una línea basta para separar las dos. */}
      {destacados.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-uva-cuerpo font-extrabold text-uva-text">Más respondidas esta semana</h2>
          <ul className="flex flex-col gap-1">
            {destacados.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/dashboard/comunidad/${post.slug}`}
                  className="block min-h-11 py-1 text-uva-detalle leading-snug text-uva-text-muted hover:text-uva-accent-ink"
                >
                  <b className="font-bold text-uva-text">{post.titulo}</b>
                  <small className="mt-0.5 block text-uva-detalle text-uva-text-muted">
                    {post.totalRespuestas} respuesta{post.totalRespuestas === 1 ? "" : "s"}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {actividad.length > 0 && (
        <div
          className={cn(
            "flex flex-col gap-3",
            // La línea solo existe si hay algo arriba de lo que separarse.
            destacados.length > 0 && "border-t border-uva-divider pt-5",
          )}
        >
          <h2 className="text-uva-cuerpo font-extrabold text-uva-text">Publicaciones recientes</h2>
          <ul className="flex flex-col gap-1">
            {actividad.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/dashboard/comunidad/${item.slug}`}
                  className="block min-h-11 py-1 text-uva-detalle leading-snug text-uva-text-muted hover:text-uva-accent-ink"
                >
                  <b className="font-bold text-uva-text">{item.autorNombre}</b> publicó{" "}
                  <b className="font-bold text-uva-text">{item.titulo}</b>
                  <small className="mt-0.5 block text-uva-detalle text-uva-text-muted">{item.tiempo}</small>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
