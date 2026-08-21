import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca la sesión si el JWT expiró; requerido por Supabase Auth SSR.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const requiresAuth = matchesPrefix(pathname, [
    ...STUDENT_PATH_PREFIXES,
    ...ADMIN_PATH_PREFIXES,
  ]);
  const requiresAdmin = matchesPrefix(pathname, ADMIN_PATH_PREFIXES);

  if (requiresAuth && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Flujo 02 (ampliación, functional-spec.md): mientras el correo no esté
  // verificado no puede entrar al dashboard. En la práctica hoy esto casi
  // nunca se alcanza aquí (con "Confirm email" activo en Supabase,
  // signInWithPassword ya rechaza el login antes de crear sesión — ver
  // src/actions/auth/login.ts), pero queda como defensa en profundidad.
  if (requiresAuth && user && !user.email_confirmed_at) {
    return NextResponse.redirect(new URL("/verificar-correo", request.url));
  }

  if (requiresAuth && user) {
    // TODO: optimizar esta consulta (ej. leer el rol desde un claim del
    // JWT en vez de golpear Perfiles en cada request al dashboard/panel admin).
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol, estado")
      .eq("id", user.id)
      .single();

    // Cuenta suspendida por un administrador: se cierra la sesión en cada
    // request a una ruta protegida, no solo al iniciar sesión — así una
    // suspensión hecha a mitad de sesión también saca al usuario.
    if (perfil?.estado === "SUSPENDIDO") {
      await supabase.auth.signOut();
      const loginUrl = new URL("/login", request.url);
      const response = NextResponse.redirect(loginUrl);
      supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
      return response;
    }

    if (requiresAdmin && perfil?.rol !== "ADMINISTRADOR") {
      return NextResponse.redirect(new URL("/", request.url));
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
