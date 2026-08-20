"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * El mockup del panel admin (design-spec/project/Uva - Panel Admin.dc.html)
 * pone el buscador en el header, no dentro de la pantalla: `showSearch` se
 * activa solo en Cursos y Usuarios. Como el filtrado sigue viviendo en las
 * tablas (client components), el texto viaja por contexto desde el header.
 *
 * El texto se guarda junto a la ruta en la que se escribió, de forma que al
 * cambiar de pantalla vuelve a quedar vacío sin necesidad de un efecto.
 */
const AdminSearchContext = createContext<{
  query: string;
  setQuery: (query: string) => void;
} | null>(null);

export function AdminSearchProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [entrada, setEntrada] = useState({ pathname, query: "" });

  const valor = useMemo(() => {
    const query = entrada.pathname === pathname ? entrada.query : "";
    return { query, setQuery: (texto: string) => setEntrada({ pathname, query: texto }) };
  }, [entrada, pathname]);

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
