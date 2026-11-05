import { defineConfig, devices } from "@playwright/test";

// .env.local no existe en CI, donde las variables llegan del entorno
// (mismo patrón que scripts/rls-test.ts).
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

// P2-7 Fase B (AUDIT-2026-08-24.md): corre contra el proyecto real de
// Supabase — no hay staging separado (Ground Truth del audit). Cada spec
// crea y borra sus propios datos desechables con la Service Role Key,
// mismo patrón que scripts/rls-test.ts y scripts/webhook-test.ts.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false, // los specs comparten el mismo servidor de dev; evita pisarse
  // next dev compila cada ruta la primera vez que se pide (on-demand); una
  // cadena de redirects que toca 3-4 rutas nuevas puede tardar bastante
  // más que el timeout por defecto de Playwright.
  timeout: 90_000,
  // Capturas (retroceso-visual.spec.ts): tolera el suavizado de imágenes y
  // texto, no un cambio de color, tamaño o posición.
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    video: process.env.CI ? "retain-on-failure" : "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /compat-/ },
  ],
  webServer: {
    // En CI el build ya está hecho: next start es estable y rápido; next dev
    // compila cada ruta en la primera visita y vuelve lentos los tiempos.
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // next dev con Turbopack no responde el primer GET hasta terminar de
    // compilar esa ruta on-demand; con Sentry/instrumentation de por
    // medio, el primer arranque puede tardar más que el minuto por
    // defecto.
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
