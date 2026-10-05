"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  aplicarTema,
  guardarPreferencia,
  leerPreferencia,
  suscribirTema,
  temaActual,
  type PreferenciaTema,
  type Tema,
} from "@/lib/tema";

type ContextoTema = {
  /** Lo que eligió el usuario ("sistema" si no eligió nada). */
  preferencia: PreferenciaTema;
  /** El tema que se está viendo. */
  tema: Tema;
  alternarTema: () => void;
  usarTemaDelSistema: () => void;
};

const TemaContext = createContext<ContextoTema | null>(null);

// Un solo string como snapshot: useSyncExternalStore compara con Object.is,
// así que un objeto nuevo en cada lectura re-renderizaría sin fin.
function leerSnapshot(): string {
  return `${leerPreferencia()}|${temaActual()}`;
}

// El servidor no conoce localStorage ni el sistema del visitante. Con este
// valor se hidrata sin desajuste y, justo después, React vuelve a leer el
// snapshot real del navegador y re-renderiza el selector con el ícono
// correcto (el <html> ya tiene el tema bien puesto por SCRIPT_TEMA_INICIAL).
function leerSnapshotServidor(): string {
  return "sistema|oscuro";
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(suscribirTema, leerSnapshot, leerSnapshotServidor);
  const [preferencia, tema] = snapshot.split("|") as [PreferenciaTema, Tema];

  // El script del <head> no toca las etiquetas theme-color (pueden no
  // existir todavía cuando corre): se sincronizan al montar.
  useEffect(() => {
    aplicarTema(temaActual());
  }, []);

  const alternarTema = useCallback(() => {
    guardarPreferencia(tema === "oscuro" ? "claro" : "oscuro");
  }, [tema]);

  const usarTemaDelSistema = useCallback(() => {
    guardarPreferencia("sistema");
  }, []);

  const valor = useMemo(
    () => ({ preferencia, tema, alternarTema, usarTemaDelSistema }),
    [preferencia, tema, alternarTema, usarTemaDelSistema],
  );

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export function useTema(): ContextoTema {
  const contexto = useContext(TemaContext);
  if (!contexto) throw new Error("useTema necesita estar dentro de <TemaProvider>");
  return contexto;
}
