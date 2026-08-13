/* Reglas para validar la contraseña */
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
