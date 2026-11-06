import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { construirCsp, generarNonce } from "@/lib/csp";
import { CABECERA_ORIGEN, RUTA_SIN_SESION, decidirOrigen } from "@/lib/origen";
import { resolverIp, saltosConfiables } from "@/lib/clientIp";
import { registrarEventoSeguridad } from "@/lib/eventos-seguridad";

export async function proxy(request: NextRequest) {
  // Fase 2 del plan de blindaje: con ORIGEN_SECRETO puesta, quien llame directo
  // a Railway sin pasar por Cloudflare recibe 403 (src/lib/origen.ts). Va
  // primero y cubre también /_next/image, la ruta del optimizador que protege
  // el WAF: la regla no sirve si el origen responde por otra vía.
  if (decidirOrigen(request.nextUrl.pathname, request.headers.get(CABECERA_ORIGEN)) === "rechazar") {
    // Fase 10.2. Sin el secreto no se confía en CF-Connecting-IP: la IP sale
    // de X-Forwarded-For, igual que en el resto de la app.
    registrarEventoSeguridad("origen_rechazado", {
      ruta: request.nextUrl.pathname,
      ip: resolverIp({
        cfConnectingIp: null,
        forwardedFor: request.headers.get("x-forwarded-for"),
        desdeCloudflare: false,
        saltos: saltosConfiables(),
      }).ip,
    });
    return new NextResponse("Acceso directo no permitido.", { status: 403 });
  }

  if (RUTA_SIN_SESION.test(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // P2-2 (AUDIT-2026-09-08): la CSP se arma aquí y no en next.config.ts
  // porque lleva un nonce distinto en cada petición.
  const nonce = generarNonce();
  const csp = construirCsp({
    nonce,
    desarrollo: process.env.NODE_ENV !== "production",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });

  // En la PETICIÓN va `Content-Security-Policy` a secas: es el nombre exacto
  // que Next busca para extraer el nonce y ponérselo a sus propios scripts
  // (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
  // Esta cabecera no sale hacia el navegador.
  const cabecerasPeticion = new Headers();
  cabecerasPeticion.set("x-nonce", nonce);
  cabecerasPeticion.set("Content-Security-Policy", csp);

  const response = await updateSession(request, cabecerasPeticion);

  // En la RESPUESTA va en modo informe. La política todavía no se ha
  // probado contra tráfico real —el riesgo concreto es que el reproductor
  // de Mux o el editor TipTap tropiecen con `style-src` sin más aviso que
  // la consola—, así que durante la fase de observación esto no bloquea
  // nada: solo reporta a Sentry vía el `report-uri` que arma construirCsp().
  //
  // Para forzarla, cuando el informe salga limpio, basta cambiar el nombre
  // de esta cabecera por "Content-Security-Policy". Ese cambio es de una
  // línea a propósito: el resto ya está en su sitio y probado.
  response.headers.set("Content-Security-Policy-Report-Only", csp);

  return response;
}

export const config = {
  // _next/hmr (Turbopack, Next 16) y _next/webpack-hmr (fallback Webpack) se
  // excluyen igual que _next/static: son el socket de Hot Module Reload de
  // `next dev`, no tráfico de la app. updateSession() hace un round-trip a
  // Supabase Auth por cada request que deja pasar; sobre un upgrade de
  // WebSocket eso rompe el handshake, y un proxy delante (p. ej. Cloudflare
  // Tunnel) lo ve como una respuesta HTTP malformada. En producción no existe
  // este tráfico, así que excluirlo es inerte ahí.
  //
  // _next/static, _next/image y las imágenes sí pasan desde la fase 2, por el
  // cierre del origen; el propio proxy() las despacha antes de la sesión.
  matcher: ["/((?!_next/hmr|_next/webpack-hmr).*)"],
};
