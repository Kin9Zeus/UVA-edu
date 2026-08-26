import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // _next/hmr (Turbopack, Next 16) y _next/webpack-hmr (fallback Webpack) se
  // excluyen igual que _next/static: son el socket de Hot Module Reload de
  // `next dev`, no tráfico de la app. updateSession() hace un round-trip a
  // Supabase Auth por cada request que deja pasar; sobre un upgrade de
  // WebSocket eso rompe el handshake, y un proxy delante (p. ej. Cloudflare
  // Tunnel) lo ve como una respuesta HTTP malformada. En producción no existe
  // este tráfico, así que excluirlo es inerte ahí.
  matcher: [
    "/((?!_next/static|_next/image|_next/hmr|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
