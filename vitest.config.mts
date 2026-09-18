import { defineConfig } from "vitest/config";

// P2-7 (AUDIT-2026-08-24.md): empezó cubriendo solo lógica pura (src/lib/**).
// Desde P2-8 (AUDIT-2026-09-15.md) también Server Actions, con los bordes del
// servidor falseados por src/test/servidor-falso.ts: sin base real, así que
// RLS y las funciones SQL siguen siendo cosa de `npm run test:rls`.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
