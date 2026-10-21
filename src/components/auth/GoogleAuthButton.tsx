"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GoogleIcon } from "@/components/auth/icons";
import { createClient } from "@/lib/supabase/client";
import { logErrorDelCliente } from "@/lib/reportar-cliente";

/**
 * Botón «Continuar con Google» con la plantilla oficial de la marca (guía de
 * Google Identity): fondo, borde y texto fijos por tema. Es la única excepción
 * a «solo tokens» (CLAUDE.md 3.3), porque Google exige estos colores exactos
 * para reconocer el botón. Claro: #FFFFFF, borde #747775, texto #1F1F1F.
 * Oscuro: #131314, borde #8E918F, texto #E3E3E3. El borde de 1 px y la «G» de
 * cuatro colores no cambian; el alto lo decide quien lo usa.
 */
const ESTILO_GOOGLE =
  "border border-[#747775] bg-white font-medium text-[#1F1F1F] hover:border-[#747775] hover:bg-[#F2F2F2] dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3] dark:hover:border-[#8E918F] dark:hover:bg-[#232324]";

export function GoogleAuthButton({
  label,
  next = "/dashboard",
  className,
}: {
  label: string;
  next?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      logErrorDelCliente("GoogleAuthButton", "signInWithOAuth falló", error);
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="uva-secondary"
      size="uva"
      className={cn(ESTILO_GOOGLE, className)}
      onClick={handleClick}
      disabled={pending}
    >
      <GoogleIcon />
      {pending ? "Redirigiendo…" : label}
    </Button>
  );
}
