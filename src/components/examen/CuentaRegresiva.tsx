"use client";

import { useEffect, useState } from "react";

function formatear(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const mm = String(minutos).padStart(2, "0");
  const ss = String(segundos).padStart(2, "0");
  return horas > 0 ? `${horas}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Cuenta regresiva hasta que se habilita el siguiente intento. Al llegar a
 * cero recarga la página para que el servidor muestre el botón de iniciar —
 * el cliente no decide que ya se puede, solo avisa que es hora de preguntar.
 */
export function CuentaRegresiva({ hasta }: { hasta: string }) {
  const limite = new Date(hasta).getTime();
  const [restante, setRestante] = useState<number | null>(null);

  useEffect(() => {
    // Solo recarga si VIO la cuenta cruzar el cero. Si ya llega vencida (reloj
    // del navegador adelantado respecto al servidor), recargar entraría en un
    // bucle: el servidor seguiría diciendo "en espera" con la misma hora.
    let vistoPositivo = false;
    function tick() {
      const ms = limite - Date.now();
      setRestante(ms);
      if (ms > 0) vistoPositivo = true;
      else if (vistoPositivo) {
        clearInterval(id);
        window.location.reload();
      }
    }
    const id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
  }, [limite]);

  // Antes de hidratar no se conoce la hora del navegador: se reserva el
  // espacio para que no salte el layout.
  return (
    <span className="font-mono tabular-nums" aria-hidden={restante === null}>
      {restante === null ? "--:--" : formatear(restante)}
    </span>
  );
}
