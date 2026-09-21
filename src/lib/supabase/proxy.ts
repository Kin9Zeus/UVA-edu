import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getGuardiaSesion } from "@/lib/supabase/guardia-sesion";

// Los route groups entre paréntesis no aparecen en la URL, así que el muro
// de acceso debe matchear por el path público (ej. "/dashboard", "/admin"),
// no por el nombre de carpeta. "/cursos" y "/planes" son públicos a propósito
// (Detalle de curso y Precios se ven sin sesión, igual que Home) y por eso
// no están en esta lista.
const STUDENT_PATH_PREFIXES = ["/dashboard"];
const ADMIN_PATH_PREFIXES = ["/admin"];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

/**
 * `cabecerasPeticion` (P2-2, AUDIT-2026-09-08): cabeceras que hay que añadir
 * a la PETICIÓN que ve el renderizador, no a la respuesta. Hoy son dos, y
 * las dos las pone `src/proxy.ts`: `x-nonce` y `Content-Security-Policy`.
 *
 * Next extrae el nonce de esa cabecera de petición para ponérselo a sus
 * propios scripts (ver src/lib/csp.ts), así que tiene que viajar por aquí:
 * si solo se pusiera en la respuesta, los scripts del framework saldrían sin
 * numerar. Se aplican en los DOS sitios donde se construye la respuesta —el
 * inicial y el que rehace `setAll` al refrescar cookies—, porque el segundo
 * reemplaza al primero y perdería las cabeceras.
 */
export async function updateSession(request: NextRequest, cabecerasPeticion?: Headers) {
  /** Copia de las cabeceras de la petición con los añadidos aplicados.
   *  Se recalcula en cada uso: `request.cookies.set()` reescribe la cabecera
   *  `cookie` del propio request, y esa versión actualizada es la que tiene
   *  que llegar al renderizador. */
  const cabeceras = () => {
    const copia = new Headers(request.headers);
    cabecerasPeticion?.forEach((valor, clave) => copia.set(clave, valor));
    return copia;
  };

  let supabaseResponse = NextResponse.next({ request: { headers: cabeceras() } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin credenciales de Supabase (proyecto aún no creado en Fase 0/1) se
  // deja pasar la petición sin refrescar sesión, en vez de tumbar la app.
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request: { headers: cabeceras() } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca la sesión si el JWT expiró; requerido por Supabase Auth SSR.
  //
  // P2-4 (AUDIT-2026-09-15): antes acá se llamaba `getUser()`, que SIEMPRE
  // hace un GET a /auth/v1/user — un round-trip de red en CADA request que
  // pasa por el proxy, incluidas todas las públicas (home, catálogo, curso,
  // planes...). En esas rutas `requiresAuth` es false y el usuario ni
  // siquiera se usa: el único efecto que importaba era el refresco de
  // cookies. `getClaims()` conserva ese efecto y se ahorra la red.
  //
  // Verificado en node_modules (auth-js 2.112.2 / ssr 0.12.4): el refresco
  // NO depende del método que se llame. `getClaims()` -> `getSession()` ->
  // `_useSession()` -> `__loadSession()`, y es ahí donde, si el token
  // expiró, corre `_callRefreshToken()` -> `_saveSession()` +
  // `_notifyAllSubscribers('TOKEN_REFRESHED')`. El `setAll` de arriba lo
  // dispara `createServerClient` desde su `onAuthStateChange` al recibir ese
  // evento, no desde la función invocada. `getUser()` recorre exactamente el
  // mismo camino y además pide /user; lo único que se pierde acá es esa
  // petición. La firma del JWT se verifica igual, en local con WebCrypto
  // contra el JWKS ES256 del proyecto (cacheado en proceso), así que `sub`
  // sigue siendo un dato de confianza y no un claim sin validar.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims ?? null;

  const { pathname } = request.nextUrl;
  const requiresAuth = matchesPrefix(pathname, [
    ...STUDENT_PATH_PREFIXES,
    ...ADMIN_PATH_PREFIXES,
  ]);

  if (requiresAuth && !claims) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (requiresAuth && claims) {
    // Las dos comprobaciones de abajo (correo verificado + cuenta no
    // suspendida) viven ahora en `getGuardiaSesion`, con una caché de 30 s
    // por proceso y las dos consultas en paralelo en vez de en serie. El
    // porqué completo —y por qué cachearlas no abre ningún hueco, dado que
    // `private.cuenta_activa()` y `private.correo_verificado()` ya cierran
    // las escrituras en RLS— está en el comentario de cabecera de
    // src/lib/supabase/guardia-sesion.ts.
    const guardia = await getGuardiaSesion(supabase, claims.sub);

    if (!guardia) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Flujo 02 (ampliación, functional-spec.md): mientras el correo no esté
    // verificado no puede entrar al dashboard. En la práctica hoy esto casi
    // nunca se alcanza aquí (con "Confirm email" activo en Supabase,
    // signInWithPassword ya rechaza el login antes de crear sesión — ver
    // src/actions/auth/login.ts), pero queda como defensa en profundidad.
    if (!guardia.correoVerificado) {
      return NextResponse.redirect(new URL("/verificar-correo", request.url));
    }

    // Cuenta suspendida por un administrador: se cierra la sesión en cada
    // request a una ruta protegida, no solo al iniciar sesión — así una
    // suspensión hecha a mitad de sesión también saca al usuario.
    //
    // P2-8 (AUDIT-2026-09-04.md): el chequeo de ROL que antes había acá se
    // quitó porque `(admin)/admin/layout.tsx` ya hace la misma consulta y el
    // mismo redirect. `estado` sí se queda: es lo único que dispara este
    // signOut, y ese signOut no es redundante con el layout (que solo
    // redirige, no limpia la cookie) — verificado que un access_token ya
    // emitido sigue pasando auth.getUser() después de un
    // auth.admin.signOut(id, "global") hasta que expira solo.
    if (guardia.suspendido) {
      await supabase.auth.signOut();
      const loginUrl = new URL("/login", request.url);
      const response = NextResponse.redirect(loginUrl);
      supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
      return response;
    }
  }

  // TODO: Muro de Pago dinámico (Flujo 01 de functional-spec.md, sección 5
  // de technical-spec.md) — en las rutas de reproducción de lecciones y
  // de checkout, además de la sesión y el chequeo de email_confirmed_at
  // de arriba, validar que exista un registro en Suscripciones con
  // estado IN ('activa', 'past_due') o una Inscripción vigente para
  // el usuario antes de dejar pasar la request; si no, redirigir a
  // /checkout. Falta definir el path real del reproductor y de checkout
  // dentro de (student)/(public) para poder matchearlos acá.

  return supabaseResponse;
}
