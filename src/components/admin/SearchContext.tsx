"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * El mockup del panel admin (design-spec/project/Uva - Panel Admin.dc.html)
 * pone el buscador en el header, no dentro de la pantalla: `showSearch` se
 * activa solo en Cursos y Usuarios. El texto viaja por contexto desde el
 * header hasta la tabla.
 *
 * El texto se guarda junto a la ruta en la que se escribió, de forma que al
 * cambiar de pantalla vuelve a quedar vacío sin necesidad de un efecto.
 *
 * Sincronización con la URL
 * -------------------------
 * `/admin/usuarios` filtra en el SERVIDOR (RPC admin_listar_usuarios), así
 * que necesita el texto en la URL, no solo en memoria. En esas rutas el
 * contexto escribe `?q=` con debounce.
 *
 * `RUTAS_BUSQUEDA_SERVIDOR` mantiene el cambio acotado: `/admin/cursos` sigue
 * filtrando en cliente sobre el estado del contexto y no ve ninguna
 * diferencia. Cuando esa tabla también se mueva al servidor, basta con
 * añadir su ruta aquí.
 */
const RUTAS_BUSQUEDA_SERVIDOR = new Set(["/admin/usuarios"]);

/**
 * Sin esto cada tecla dispara una navegación y una consulta. 300 ms es el
 * punto donde el resultado ya se siente inmediato sin pedirle a Postgres una
 * consulta por pulsación.
 */
const DEBOUNCE_MS = 300;

const AdminSearchContext = createContext<{
  query: string;
  setQuery: (query: string) => void;
} | null>(null);

export function AdminSearchProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // La URL es la fuente de verdad al entrar: si alguien comparte o recarga
  // /admin/usuarios?q=ana, el input aparece con "ana" escrito.
  const queryDeUrl = RUTAS_BUSQUEDA_SERVIDOR.has(pathname) ? (searchParams.get("q") ?? "") : "";
  const [entrada, setEntrada] = useState({ pathname, query: queryDeUrl });

  const query = entrada.pathname === pathname ? entrada.query : queryDeUrl;

  // `router.replace`, no `push`: escribir en el buscador no debería llenar el
  // historial de una entrada por letra.
  const pendiente = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!RUTAS_BUSQUEDA_SERVIDOR.has(pathname)) return;
    if (query === (searchParams.get("q") ?? "")) return;

    pendiente.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (query) params.set("q", query);
      else params.delete("q");
      // Al cambiar la búsqueda hay que volver a la primera página: si estabas
      // en la 3 y filtras a dos resultados, la 3 queda vacía.
      params.delete("page");

      const cadena = params.toString();
      router.replace(cadena ? `${pathname}?${cadena}` : pathname, { scroll: false });
    }, DEBOUNCE_MS);

    return () => {
      if (pendiente.current) clearTimeout(pendiente.current);
    };
  }, [query, pathname, router, searchParams]);

  const valor = useMemo(
    () => ({
      query,
      setQuery: (texto: string) => setEntrada({ pathname, query: texto }),
    }),
    [query, pathname],
  );

  return (
    <AdminSearchContext.Provider value={valor}>{children}</AdminSearchContext.Provider>
  );
}

export function useAdminSearch() {
  const contexto = useContext(AdminSearchContext);
  if (!contexto) {
    throw new Error("useAdminSearch debe usarse dentro de AdminSearchProvider");
  }
  return contexto;
}
