import Link from "next/link";
import { getComunidadActividadReciente, getComunidadDestacados } from "@/lib/comunidad";

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
      {destacados.length > 0 && (
        <div className="flex flex-col gap-3 rounded-uva-md border border-uva-divider bg-uva-surface p-4">
          <h2 className="text-xs font-semibold tracking-[.08em] text-uva-text-faint uppercase">
            Más respondidas esta semana
          </h2>
          <ul className="flex flex-col gap-2.5">
            {destacados.map((post) => (
              <li key={post.id}>
                <Link href={`/dashboard/comunidad/${post.slug}`} className="block truncate text-sm text-uva-text hover:text-uva-accent">
                  {post.titulo}
                </Link>
                <span className="text-xs text-uva-text-faint">
                  {post.totalRespuestas} respuesta{post.totalRespuestas === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {actividad.length > 0 && (
        <div className="flex flex-col gap-3 rounded-uva-md border border-uva-divider bg-uva-surface p-4">
          <h2 className="text-xs font-semibold tracking-[.08em] text-uva-text-faint uppercase">Publicaciones recientes</h2>
          <ul className="flex flex-col gap-3">
            {actividad.map((item) => (
              <li key={item.id} className="text-sm">
                <Link href={`/dashboard/comunidad/${item.slug}`} className="text-uva-text-muted hover:text-uva-text">
                  <span className="text-uva-text">{item.autorNombre}</span> publicó{" "}
                  <span className="text-uva-text">{item.titulo}</span>
                </Link>
                <div className="mt-0.5 text-xs text-uva-text-faint">{item.tiempo}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
