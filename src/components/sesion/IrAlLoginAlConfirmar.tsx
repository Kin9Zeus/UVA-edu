"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { escucharPestanas, mismoCorreo } from "@/lib/sesion/pestanas";

/**
 * Para "Verifica tu correo": cuando el enlace se abre en otra pestaña y
 * confirma este mismo correo, la sesión del enlace se cierra y esta pantalla
 * ya no tiene nada que esperar. Lleva al login con el correo escrito.
 */
export function IrAlLoginAlConfirmar({ correo }: { correo: string }) {
  const router = useRouter();
  useEffect(() => {
    return escucharPestanas((aviso) => {
      if (aviso.tipo === "correo-confirmado" && mismoCorreo(aviso.correo, correo)) {
        router.replace(`/login?email=${encodeURIComponent(correo)}`);
      }
    });
  }, [correo, router]);
  return null;
}
