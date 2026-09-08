import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Excepción deliberada a CLAUDE.md §3.1 ("Route Handlers reservados
 * únicamente para Webhooks externos"): `navigator.sendBeacon`, que es el
 * único transporte del navegador que garantiza el envío al cerrar la
 * pestaña (Revf3, "usar sendBeacon para el guardado final"), no permite
 * fijar el header `Next-Action` que Next.js exige para enrutar una llamada
 * a un Server Action. No hay forma de cumplir ese requisito sin un endpoint
 * de URL plana — este es ese único caso, acotado a esto.
 *
 * Hace exactamente lo mismo que guardarSegundoActual en
 * actions/progreso/marcar.ts (mismo cliente con sesión de cookies, mismo
 * upsert acotado a `segundo_actual`, nunca toca `completado`, nunca usa
 * service role) — solo cambia el transporte.
 */

const cuerpoSchema = z.object({
  leccionId: z.string().uuid(),
  segundos: z.number().int().min(0).max(24 * 60 * 60),
});

/**
 * P3-2 (AUDIT-2026-09-04.md): esta es la única ruta con cookies de sesión
 * que acepta escrituras y que no pasa por el anti-CSRF que Next.js aplica
 * solo a las Server Actions, así que un `fetch` desde otro sitio con
 * `Content-Type: text/plain` sería una petición simple (sin preflight).
 *
 * Hoy eso ya no llega a ningún lado, y conviene dejar escrito por qué: las
 * cookies de sesión las emite `@supabase/ssr` con `sameSite: "lax"` (su
 * default, que este proyecto no sobreescribe en ninguna parte), y con `Lax`
 * el navegador no adjunta la cookie en un POST cross-site — la petición
 * llega sin sesión y muere en el 401 de más abajo.
 *
 * Este chequeo es el cinturón, no el tirante: si algún día alguien pasa las
 * cookies a `sameSite: "none"` —lo que haría falta para poder embeber la app
 * en un iframe de otro dominio—, esa protección desaparece en silencio y
 * esta ruta volvería a ser escribible desde fuera. Cuesta tres líneas.
 *
 * Se compara contra el `Host` de la propia petición y no contra `siteUrl()`,
 * que es lo contrario de lo que pide P1-1. No es una contradicción: P1-1
 * prohíbe usar `Host` para construir algo que sale hacia afuera (el enlace
 * de un correo, el QR de un certificado), donde un `Host` falsificado
 * termina en manos de la víctima. Acá solo se comparan dos headers de la
 * misma petición para decidir si es del propio sitio, y falsificar los dos
 * no logra nada: quien puede fijar sus propios headers no está dentro de un
 * navegador y por lo tanto no tiene las cookies de ninguna víctima, que es
 * lo único que hace de esto un CSRF. Usar `siteUrl()` sí rompería algo real:
 * la app es alcanzable por más de un host a la vez (el `*.up.railway.app`
 * del servicio y el dominio propio), y quien navegara por el que no está en
 * `NEXT_PUBLIC_SITE_URL` perdería el guardado final de cada clase.
 *
 * Se rechaza solo cuando el header viene y NO coincide: `sendBeacon` sí
 * manda `Origin`, pero hay clientes legítimos que lo borran (extensiones de
 * privacidad, algún navegador viejo), y el objetivo de acá no vale perder
 * el guardado final de una clase.
 */
function origenAjeno(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host !== host;
  } catch {
    // `Origin` que no parsea como URL no lo manda ningún navegador.
    return true;
  }
}

export async function POST(request: Request) {
  if (origenAjeno(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const resultado = cuerpoSchema.safeParse(payload);
  if (!resultado.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });

  await supabase.from("progreso").upsert(
    {
      id_usuario: user.id,
      id_leccion: resultado.data.leccionId,
      segundo_actual: resultado.data.segundos,
    },
    { onConflict: "id_usuario,id_leccion" },
  );

  return NextResponse.json({ ok: true });
}
