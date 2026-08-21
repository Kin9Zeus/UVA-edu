export type PlanRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_centavos: number;
  moneda: string;
  duracion_dias: number;
  nivel_acceso: string | null;
};

export const sharedBenefits = [
  "Catálogo completo",
  "Certificados digitales",
  "Plantillas y planos descargables",
  "Certificado físico de rutas",
  "Eventos y webinars en vivo",
];

/**
 * Cuántos de los `sharedBenefits` cubre cada nivel de acceso. El esquema no
 * tiene tabla de beneficios por plan (ver `docs/technical-spec.md` §4, tabla
 * Planes): `nivel_acceso` es el único campo que distingue el alcance de un
 * plan, así que es el que manda aquí. Un nivel desconocido cae en el mínimo.
 */
export const BENEFICIOS_POR_NIVEL: Record<string, number> = {
  TOTAL: sharedBenefits.length,
  BASICO: 2,
};
export const BENEFICIOS_POR_DEFECTO = 2;

export function formatearPrecio(centavos: number, moneda: string) {
  const formateado = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(centavos / 100);
  // Intl mete un espacio duro entre el símbolo y la cifra ("$ 89.900"); el
  // diseño lo muestra pegado.
  return formateado.replace(/\s/g, "");
}

export function periodo(duracionDias: number) {
  if (duracionDias >= 360) return "/año";
  if (duracionDias >= 28 && duracionDias <= 31) return "/mes";
  return `/${duracionDias} días`;
}

export function meta(plan: PlanRow) {
  if (plan.descripcion) return plan.descripcion;
  return `Facturado cada ${plan.duracion_dias} días`;
}

/**
 * "Ahorras N meses" comparando contra el plan activo de menor duración, que
 * es el precio de referencia. Se redondea hacia abajo para no prometer un
 * ahorro mayor al real, y no se muestra badge si no hay ahorro entero.
 */
export function ahorroEnMeses(plan: PlanRow, referencia: PlanRow) {
  if (plan.id === referencia.id) return null;
  if (plan.moneda !== referencia.moneda) return null;

  const equivalente =
    referencia.precio_centavos * (plan.duracion_dias / referencia.duracion_dias);
  const meses = Math.floor(
    (equivalente - plan.precio_centavos) / referencia.precio_centavos,
  );

  return meses >= 1 ? `Ahorras ${meses} ${meses === 1 ? "mes" : "meses"}` : null;
}

/**
 * Igual que `ahorroEnMeses`, pero como porcentaje ("Ahorra 38%") — la
 * variante de badge que usa la pantalla de Planes del dashboard
 * (design-spec: sección `isPrecios`). Compara contra lo que costaría `plan`
 * si se pagara al prorrateo diario de `referencia`, en vez de a meses
 * enteros, así que también sirve para reflejar ahorros no exactos.
 */
export function ahorroPorcentaje(plan: PlanRow, referencia: PlanRow) {
  if (plan.id === referencia.id) return null;
  if (plan.moneda !== referencia.moneda) return null;

  const precioProrrateado =
    (referencia.precio_centavos / referencia.duracion_dias) * plan.duracion_dias;
  const porcentaje = Math.round(
    (1 - plan.precio_centavos / precioProrrateado) * 100,
  );

  return porcentaje >= 1 ? `Ahorra ${porcentaje}%` : null;
}
