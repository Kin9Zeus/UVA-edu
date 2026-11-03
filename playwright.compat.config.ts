import { devices } from "@playwright/test";
import base from "./playwright.config";

// Matriz de compatibilidad (docs/qa/compatibilidad.md): `npm run test:compat`.
// Motores reales (WebKit = Safari, Firefox, Edge) y perfiles de dispositivo
// emulados; no reemplazan el celular físico. El resultado queda en
// docs/qa/compatibilidad/ (json + capturas) para el informe.
const config = {
  ...base,
  testIgnore: undefined,
  testMatch: /compat-.*.spec.ts/,
  outputDir: "docs/qa/compatibilidad/artefactos",
  reporter: [["list"], ["json", { outputFile: "docs/qa/compatibilidad/resultado.json" }]],
  use: { ...base.use, screenshot: "only-on-failure" as const },
  projects: [
    { name: "safari-escritorio", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
    { name: "iphone-se", use: { ...devices["iPhone SE"] } },
    { name: "iphone-grande", use: { ...devices["iPhone 15 Pro Max"] } },
    { name: "ipad-vertical", use: { ...devices["iPad (gen 7)"] } },
    { name: "ipad-horizontal", use: { ...devices["iPad (gen 7) landscape"] } },
    { name: "android-medio", use: { ...devices["Pixel 7"] } },
    { name: "android-bajo", use: { ...devices["Galaxy S9+"] } },
  ],
};

export default config;
