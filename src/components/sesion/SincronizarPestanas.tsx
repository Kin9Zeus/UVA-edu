"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { destinoInternoSeguro } from "@/lib/redirect-seguro";
import {
  CLAVE_USUARIO,
  escucharPestanas,
  reaccionAlCambio,
  usuarioDeCookies,
} from "@/lib/sesion/pestanas";

/**
 * Mantiene al día las pestañas abiertas cuando la sesión cambia en otra:
 * entrar desde otra pestaña saca del login, cerrar sesión o cambiar de cuenta
 * recarga los paneles, y un canje de código refresca lo que dependía del
 * acceso. Ver src/lib/sesion/pestanas.ts.
 *
 * Revisa al cargar cada ruta, al volver a la pestaña (foco o visibilidad) y
 * cuando otra pestaña anota un usuario distinto en localStorage. No dibuja
 * nada.
 */
export function SincronizarPestanas() {
  const router = useRouter();
  const ruta = usePathname();

  useEffect(() => {
    let conocido = usuarioDeCookies(document.cookie);

    // Anota quién tiene sesión al cargar esta ruta: si cambió, las otras
    // pestañas reciben el evento `storage` y se revisan.
    try {
      if (window.localStorage.getItem(CLAVE_USUARIO) !== (conocido ?? "")) {
        window.localStorage.setItem(CLAVE_USUARIO, conocido ?? "");
      }
    } catch {
      // Sin almacenamiento queda la revisión al volver a la pestaña.
    }

    function revisar() {
      const ahora = usuarioDeCookies(document.cookie);
      const reaccion = reaccionAlCambio(window.location.pathname, conocido, ahora);
      conocido = ahora;
      if (reaccion === "ir-al-destino") {
        const pedido = new URLSearchParams(window.location.search).get("redirect");
        router.replace(destinoInternoSeguro(pedido));
      } else if (reaccion === "recargar") {
        window.location.reload();
      }
    }

    function alVisible() {
      if (document.visibilityState === "visible") revisar();
    }
    function alStorage(evento: StorageEvent) {
      if (evento.key === CLAVE_USUARIO) revisar();
    }
    // Un canje en otra pestaña cambia lo que esta puede ver (paneles, la
    // ficha de un curso, una lección bloqueada): se refresca si tiene sesión.
    const dejarDeEscuchar = escucharPestanas((aviso) => {
      if (aviso.tipo === "acceso-cambio" && usuarioDeCookies(document.cookie)) {
        router.refresh();
      }
    });

    window.addEventListener("focus", revisar);
    document.addEventListener("visibilitychange", alVisible);
    window.addEventListener("storage", alStorage);
    return () => {
      dejarDeEscuchar();
      window.removeEventListener("focus", revisar);
      document.removeEventListener("visibilitychange", alVisible);
      window.removeEventListener("storage", alStorage);
    };
  }, [ruta, router]);

  return null;
}
