"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/auth/icons";
import { createClient } from "@/lib/supabase/client";

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
      console.error("[GoogleAuthButton] signInWithOAuth falló:", error.message);
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
