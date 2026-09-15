import { createAdminClient } from "@/lib/supabase/admin";
import {
  MENSAJE_CUPON_INVALIDO,
  validarCupon,
  type TipoDescuento,
} from "@/lib/pagos/descuento";

/**
 * Búsqueda de un cupón por código, compartida por la validación en vivo
 * (`validarCodigoCupon`) y por el checkout (`iniciarCheckout`).
 *
 * POR QUÉ SERVICE ROLE Y NO EL CLIENTE DEL ESTUDIANTE
 * ---------------------------------------------------
 * `cupones` tiene RLS con políticas EXCLUSIVAMENTE de administrador —
 * `cupones_admin_select` (supabase/sql/014, recreada en 077). El comentario
 * de 014 lo dice con todas las letras: nunca hubo un SELECT para anon ni
 * para authenticated, y fue deliberado.
 *
 * Así que leer `cupones` con el cliente de RLS del estudiante devuelve CERO
 * filas siempre, y el código de arriba lo interpreta como "ese cupón no
 * existe". Es decir: todo cupón válido se rechazaba, y no como un error sino
 * como una mentira convincente. `scripts/rls-test.ts` afirma justamente eso
 * ("estudiante con acceso no puede leer cupones") y pasa — RLS hacía su
 * trabajo; el que estaba mal era quien preguntaba.
 *
 * Bajar la barrera con una policy de SELECT para `authenticated` sería peor:
 * expondría el catálogo entero de cupones (códigos, valores y topes) a
 * cualquiera con la llave anónima, que es exactamente lo que 014 evitó. La
 * salida correcta es preguntar con Service Role desde el servidor y devolver
 * SOLO lo que hace falta para calcular el descuento — nunca la fila completa.
 *
 * EL RATE LIMIT VIVE AQUÍ, NO EN LOS SERVER ACTIONS (P2-1, supabase/sql/106)
 * -------------------------------------------------------------------------
 * Esta función es el punto ÚNICO por donde pasan los dos caminos que
 * consultan cupones: `validarCodigoCupon` (la validación en vivo, que es la
 * que menciona el hallazgo) e `iniciarCheckout`. Poner el tope en cada
 * llamador dejaría el oráculo abierto en el otro, y es exactamente el tipo
 * de cosa que se olvida al agregar el tercero.
 *
 * Por eso `idUsuario` es obligatorio: sin él no se puede contar, y hacerlo
 * opcional permitiría que un llamador nuevo se saltara el límite sin
 * enterarse. Debe venir de `auth.getUser()` sobre la sesión real, nunca de
 * un parámetro que mande el cliente — mismo criterio que
 * `canjearCodigoInvitacion`.
 */

/** Lo mínimo para calcular y registrar el descuento. Nunca la fila completa. */
export type CuponEncontrado = {
  id: string;
  tipo_descuento: TipoDescuento;
  valor: number;
};

export type BusquedaCupon =
  | { ok: true; cupon: CuponEncontrado }
  /** `error` ya viene redactado para el estudiante. */
  | {
      ok: false;
      error: string;
      /**
       * Solo presente cuando el rechazo vino del rate limit: cuántos segundos
       * faltan para volver a poder intentar. La pantalla lo usa para
       * deshabilitar el campo con una cuenta regresiva, igual que hace
       * `CanjearCodigoForm` con `canjearCodigoInvitacion`.
       */
      segundosEspera?: number;
    };

export async function buscarCuponVigente(
  codigo: string,
  idUsuario: string,
): Promise<BusquedaCupon> {
  const limpio = codigo.trim();
  if (!limpio) {
    return { ok: false, error: "Escribe un código." };
  }

  const admin = createAdminClient();

  // Antes de consultar nada: un código vacío ya salió arriba, así que a
  // partir de aquí toda llamada es un intento real y cuenta.
  const { data: limite, error: limiteError } = await admin
    .rpc("verificar_limite_validar_cupon", { p_usuario_id: idUsuario })
    .single();

  if (limiteError) {
    return { ok: false, error: "No pudimos validar el cupón. Intenta de nuevo." };
  }

  const { permitido, segundos_espera } = limite as {
    permitido: boolean;
    segundos_espera: number;
  };
  if (!permitido) {
    return {
      ok: false,
      error: "Demasiados intentos. Espera un momento antes de volver a intentar.",
      segundosEspera: segundos_espera,
    };
  }

  const { data: cupon, error } = await admin
    .from("cupones")
    .select("id, tipo_descuento, valor, fecha_vencimiento, limite_usos, veces_usado")
    .eq("codigo", limpio)
    .maybeSingle();

  // Un fallo de red y un código inexistente se le cuentan igual al
  // estudiante: decir "no pudimos consultar" invita a reintentar en bucle, y
  // distinguirlos le confirmaría a quien sondea códigos cuáles existen.
  if (error || !cupon) {
    await admin.rpc("registrar_validacion_cupon_fallida", { p_usuario_id: idUsuario });
    return { ok: false, error: "Ese cupón no existe." };
  }

  // También cuenta como fallo cuando el código SÍ existe pero venció o se
  // agotó: distinguirlos aquí sería justo el oráculo que esto cierra —
  // "código válido pero vencido" ya confirma que el código existe.
  const motivo = validarCupon(cupon);
  if (motivo) {
    await admin.rpc("registrar_validacion_cupon_fallida", { p_usuario_id: idUsuario });
    return { ok: false, error: MENSAJE_CUPON_INVALIDO[motivo] };
  }

  // Acertó: se limpia el contador, igual que un canje exitoso en
  // `canjearCodigoInvitacion`. Quien tiene un cupón bueno no debe quedar
  // bloqueado por errores de tecleo previos.
  await admin.rpc("limpiar_intentos_validar_cupon", { p_usuario_id: idUsuario });

  return {
    ok: true,
    cupon: {
      id: cupon.id,
      tipo_descuento: cupon.tipo_descuento as TipoDescuento,
      // `valor` es BigInt en el esquema y PostgREST lo entrega como string
      // cuando se pasa del entero seguro de JS.
      valor: Number(cupon.valor),
    },
  };
}
