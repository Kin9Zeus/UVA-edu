import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const providerError = searchParams.get("error_description");

  if (providerError) {
    console.error("[auth/callback] proveedor devolvió error:", providerError);
  } else if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      redirect(next);
    }

    console.error(
      "[auth/callback] exchangeCodeForSession falló:",
      error.message,
    );
  } else {
    console.error("[auth/callback] falta el parámetro code en la URL:", {
      url: request.url,
    });
  }

  redirect("/login?error=enlace_invalido");
}
