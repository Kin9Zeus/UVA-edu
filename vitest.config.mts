import { defineConfig } from "vitest/config";

// P2-7 (AUDIT-2026-08-24.md): solo cubre lógica pura por ahora
// (src/lib/**). Nada de Server Actions ni componentes — eso es la Fase B
// (Playwright, contra la base real) que queda como paso aparte.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
