"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { aplicarTema, type Tema } from "@/lib/tema";

type ContextoTema = {
  tema: Tema;
  alternarTema: () => void;
};

const TemaContext = createContext<ContextoTema | null>(null);

/**
 * El layout raíz lee la cookie en el servidor y pasa el tema inicial: así el
 * selector se pinta con el ícono correcto desde el primer HTML, sin esperar a
 * hidratar para preguntarle al DOM.
 */
export function TemaProvider({ temaInicial, children }: { temaInicial: Tema; children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  const alternarTema = useCallback(() => {
    const siguiente: Tema = tema === "oscuro" ? "claro" : "oscuro";
    aplicarTema(siguiente);
    setTema(siguiente);
  }, [tema]);

  const valor = useMemo(() => ({ tema, alternarTema }), [tema, alternarTema]);

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export function useTema(): ContextoTema {
  const contexto = useContext(TemaContext);
  if (!contexto) throw new Error("useTema necesita estar dentro de <TemaProvider>");
  return contexto;
}
