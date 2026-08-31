"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Refresca `/admin/codigos` cuando cambia cualquier fila de
 * `codigos_invitacion` en otra sesión (rev.md: "puede ver en tiempo real
 * cuántos se han canjeado"). Sin esto, la pantalla solo se actualiza cuando
 * el propio administrador dispara una acción (`revalidatePath`) — si un
 * estudiante canjea un código desde otra pestaña, esta tabla no se entera
 * hasta recargar.
 *
 * `router.refresh()` vuelve a ejecutar los Server Components de la página
 * (getCodigosInvitacion/getLotesCodigosInvitacion), no recarga el
 * navegador: mismo patrón que ya usan las mutaciones del panel admin.
 *
 * Seguridad: `046_realtime_codigos_invitacion.sql` agrega la tabla a la
 * publicación, pero quién recibe cada evento lo sigue decidiendo la policy
 * de SELECT (`codigos_invitacion_admin_select`, 016) — Realtime la evalúa
 * igual que un SELECT normal, así que un estudiante autenticado no recibe
 * estos cambios aunque intente suscribirse al mismo canal.
 */
export function useCodigosRealtime() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel("codigos_invitacion_admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "codigos_invitacion" },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [router]);
}
