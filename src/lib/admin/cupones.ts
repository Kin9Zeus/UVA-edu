import { createClient } from "@/lib/supabase/server";
import { estadoCupon, type EstadoCupon, type TipoDescuentoCupon } from "@/lib/admin/cupones-tipos";

export type CuponAdmin = {
  id: string;
  codigo: string;
  tipoDescuento: TipoDescuentoCupon;
  /**
   * OJO — la unidad depende de `tipoDescuento`, igual que la columna
   * `cupones.valor`: centavos cuando es MONTO_FIJO, porcentaje entero (0-100)
   * cuando es PORCENTAJE. Quien la pinte tiene que ramificar.
   */
  valor: number;
  fechaVencimiento: string;
  /** null = sin tope de usos. */
  limiteUsos: number | null;
  vecesUsado: number;
  creadoEn: string;
  estado: EstadoCupon;
};

/**
 * Los cupones del panel, el más nuevo primero.
 *
 * Con el cliente de RLS y no con Service Role: `cupones` tiene políticas
 * exclusivamente de administrador (`cupones_admin_select`, supabase/sql/014,
 * recreada en 077) y el layout de `/admin` ya exige ese rol, así que la
 * política deja pasar la consulta. Es justo lo contrario del checkout del
 * estudiante, que sí necesita Service Role porque para él la tabla se ve
 * vacía — ver el encabezado de `src/lib/pagos/cupones.ts`.
 */
export async function getCuponesAdmin(): Promise<CuponAdmin[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cupones")
    .select("id, codigo, tipo_descuento, valor, fecha_vencimiento, limite_usos, veces_usado, creado_en")
    .order("creado_en", { ascending: false });

  return (data ?? []).map((fila) => {
    const fechaVencimiento = fila.fecha_vencimiento as string;
    const limiteUsos = (fila.limite_usos as number | null) ?? null;
    const vecesUsado = fila.veces_usado as number;

    return {
      id: fila.id as string,
      codigo: fila.codigo as string,
      tipoDescuento: fila.tipo_descuento as TipoDescuentoCupon,
      // `valor` es BigInt en el esquema y PostgREST lo entrega como string
      // cuando se pasa del entero seguro de JS — mismo trato que en
      // `buscarCuponVigente`.
      valor: Number(fila.valor),
      fechaVencimiento,
      limiteUsos,
      vecesUsado,
      creadoEn: fila.creado_en as string,
      estado: estadoCupon({ fechaVencimiento, limiteUsos, vecesUsado }),
    };
  });
}
