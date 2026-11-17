/**
 * Auditoría de dependencias de producción, con excepciones documentadas.
 *
 * Uso: npm run audit:produccion
 *
 * Corre `npm audit --omit=dev --omit=optional --json` (el mismo alcance que
 * tenía el paso bloqueante del CI) y decide con `evaluarAuditoria`
 * (src/lib/seguridad/auditoria-dependencias.ts): falla ante cualquier aviso
 * alto o crítico que no tenga una excepción vigente, y ante una excepción
 * vencida. Las excepciones, con su motivo y su fecha de revisión, viven en
 * ese mismo archivo.
 */
import { spawnSync } from "node:child_process";
import { evaluarAuditoria } from "../src/lib/seguridad/auditoria-dependencias";

const salida = spawnSync("npm", ["audit", "--omit=dev", "--omit=optional", "--json"], {
  encoding: "utf8",
  // En Windows npm es npm.cmd; en el runner de Linux no hace falta shell.
  shell: process.platform === "win32",
  maxBuffer: 50 * 1024 * 1024,
});

let informe: unknown = null;
try {
  informe = JSON.parse(salida.stdout);
} catch {
  // Se queda en null: evaluarAuditoria falla cerrado.
}

const hoy = new Date().toISOString().slice(0, 10);
const r = evaluarAuditoria(informe, hoy);

for (const a of r.aceptados) {
  console.log(`⚠️  Aceptado por excepción: ${a.ghsa} en ${a.paquete} (${a.severidad})`);
}
for (const e of r.sinUso) {
  console.log(`ℹ️  La excepción ${e.ghsa} (${e.paquete}) ya no corresponde a ningún aviso: se puede borrar.`);
}
for (const e of r.vencidas) {
  console.error(`❌ Excepción vencida el ${e.revisarAntes}: ${e.ghsa} (${e.paquete}). Revisa si ya hay parche y actualiza o renueva la fecha.`);
}
for (const a of r.bloqueantes) {
  console.error(`❌ ${a.severidad.toUpperCase()} ${a.ghsa} en ${a.paquete}: ${a.titulo}`);
}
if (r.errorLectura) {
  console.error(`❌ ${r.errorLectura}. Salida de npm:\n${salida.stderr || salida.stdout}`);
}

if (r.aprobada) {
  console.log("✅ Sin vulnerabilidades altas o críticas fuera de las excepciones documentadas.");
} else {
  process.exit(1);
}
