import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // P2-2 (AUDIT-2026-08-26.md): sin esto, ESLint analiza el handoff de
    // diseño (código de terceros, exportado tal cual desde Claude Design)
    // y el cliente de Prisma generado — ninguno de los dos es código que
    // el equipo escriba o mantenga.
    "design-spec/**",
    "design-spec-errores/**",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
