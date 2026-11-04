/* Reglas para validar la contraseña.
 *
 * Supabase Auth exige lo mismo en staging y producción (Authentication →
 * Password requirements: mínimo 10, "Lowercase, uppercase letters, digits
 * and symbols"), para que quien llame directo a la API no se salte estas
 * reglas. Si cambia una regla aquí, cambia también allá, o al revés: si la
 * API es más estricta que la app, el estudiante pasa la validación y luego
 * ve un error. Los símbolos de abajo están todos dentro de la lista de
 * Supabase. */
export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const passwordRules: PasswordRule[] = [
  {
    id: "length",
    label: "Mínimo 10 caracteres",
    test: (password) => password.length >= 10,
  },
  {
    id: "uppercase",
    label: "Una letra mayúscula",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    // Supabase Auth exige lo mismo del lado de la API ("Lowercase, uppercase
    // letters, digits and symbols", fase 8.4): sin esta regla, una contraseña
    // sin minúsculas pasaba aquí y Supabase la rechazaba después.
    id: "lowercase",
    label: "Una letra minúscula",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "Un número",
    test: (password) => /[0-9]/.test(password),
  },
  {
    id: "special",
    label: "Un carácter especial",
    test: (password) => /[!@#$%^&*()_+\-=[\]{};':"|,.<>/?]/.test(password),
  },
];

export function isPasswordValid(password: string): boolean {
  return passwordRules.every((rule) => rule.test(password));
}
