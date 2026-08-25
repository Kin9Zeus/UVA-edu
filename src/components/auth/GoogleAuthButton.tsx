"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/auth/icons";
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";

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
      logError("GoogleAuthButton", "signInWithOAuth falló", error);
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="uva-secondary"
      size="uva"
      className={className}
      onClick={handleClick}
      disabled={pending}
    >
      <GoogleIcon />
      {pending ? "Redirigiendo…" : label}
    </Button>
  );
}
