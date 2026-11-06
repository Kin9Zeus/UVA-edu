/**
 * Deja listo en STAGING el video del curso fixture de e2e/ (CURSO_FIXTURE).
 * Staging no tiene videos reales: genera un clip de ~10 s (grabando una
 * página con Playwright, no hace falta ffmpeg), lo sube a Mux con política
 * "signed" (igual que la app) y lo asigna a las 3 lecciones del fixture.
 *
 * Es un paso único: se repite solo si el asset de Mux se borra.
 *   npx tsx scripts/e2e-fixture-video.mts
 */
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const REF_STAGING = "tmvmthdwapegypveaosd";
if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(REF_STAGING)) throw new Error("Solo corre contra staging.");

const LECCIONES = [
  "0e000000-0000-4000-8000-000000007595",
  "0e000000-0000-4000-8000-000000007596",
  "0e000000-0000-4000-8000-0000000075f9",
];
const auth = "Basic " + Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString("base64");
const mux = (ruta: string, init: RequestInit = {}) =>
  fetch(`https://api.mux.com/video/v1${ruta}`, { ...init, headers: { Authorization: auth, "Content-Type": "application/json", ...init.headers } });

// 1. Grabar ~10 s de una página con un contador.
const dir = mkdtempSync(join(tmpdir(), "uva-clip-"));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, recordVideo: { dir, size: { width: 640, height: 360 } } });
const page = await ctx.newPage();
await page.setContent(`<body style="margin:0;background:#18181b;color:#fff;font:700 120px sans-serif;display:grid;place-items:center;height:100vh"><div id=n>0</div><script>let i=0;setInterval(()=>n.textContent=++i,250)</script>`);
await page.waitForTimeout(10_000);
const ruta = await page.video()!.path();
await ctx.close();
await browser.close();

// 2. Subir a Mux (direct upload) y esperar el asset.
const up = (await (await mux("/uploads", { method: "POST", body: JSON.stringify({ cors_origin: "*", new_asset_settings: { playback_policy: ["signed"] } }) })).json()).data;
const put = await fetch(up.url, { method: "PUT", body: readFileSync(ruta) });
if (!put.ok) throw new Error(`Falló la subida: ${put.status}`);
let asset: { id: string; status: string; playback_ids?: { id: string }[] } | undefined;
for (let i = 0; i < 60 && asset?.status !== "ready"; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const u = (await (await mux(`/uploads/${up.id}`)).json()).data;
  if (u.asset_id) asset = (await (await mux(`/assets/${u.asset_id}`)).json()).data;
}
if (asset?.status !== "ready") throw new Error("Mux no dejó el asset listo a tiempo.");
const playbackId = asset.playback_ids![0].id;

// 3. Asignarlo a las lecciones del fixture.
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { error } = await db.from("lecciones").update({ id_video_mux: playbackId, id_mux_asset_id: asset.id, duracion: 10, estado_procesamiento: "LISTO" }).in("id", LECCIONES);
if (error) throw new Error(error.message);
console.log(`Asset ${asset.id}, playback ${playbackId} asignado a ${LECCIONES.length} lecciones.`);
