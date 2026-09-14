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
 * PENDIENTE: rate limit por usuario, al estilo de
 * `verificar_limite_canjear_codigo` (supabase/sql/023, hallazgo P2-2 de
 * AUDIT-2026-09-04). Ahora importa MÁS que antes: esto consulta saltándose
 * RLS con un texto que escribe el usuario, así que sin tope es un oráculo
 * para adivinar códigos a fuerza bruta. Requiere SQL nuevo y una corrida de
 * `npm run db:rls`, que está en espera mientras otra rama trabaja sobre la
 * misma base.
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
  | { ok: false; error: string };

export async function buscarCuponVigente(codigo: string): Promise<BusquedaCupon> {
  const limpio = codigo.trim();
  if (!limpio) {
    return { ok: false, error: "Escribe un código." };
  }

  const admin = createAdminClient();

  const { data: cupon, error } = await admin
    .from("cupones")
    .select("id, tipo_descuento, valor, fecha_vencimiento, limite_usos, veces_usado")
    .eq("codigo", limpio)
    .maybeSingle();

  // Un fallo de red y un código inexistente se le cuentan igual al
  // estudiante: decir "no pudimos consultar" invita a reintentar en bucle, y
  // distinguirlos le confirmaría a quien sondea códigos cuáles existen.
  if (error || !cupon) {
    return { ok: false, error: "Ese cupón no existe." };
  }

  const motivo = validarCupon(cupon);
  if (motivo) {
    return { ok: false, error: MENSAJE_CUPON_INVALIDO[motivo] };
  }

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
