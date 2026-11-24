/**
 * Las casillas del registro con correo (P1-5, AUDIT-2026-11-23). Los nombres
 * son los del `<input name>` y la acción exige las tres; la prueba la guarda
 * la base (supabase/sql/140).
 */
export const CASILLAS_LEGALES = ["terminos", "datos-personales", "mayoria-de-edad"] as const;

export const MENSAJE_FALTAN_CASILLAS =
  "Para crear tu cuenta, acepta los Términos, autoriza el tratamiento de tus datos y confirma que eres mayor de 18 años.";
