// Prueba de carga ligera (fase 6 del plan de blindaje). Nunca contra producción.
//
// Qué comprueba: que las páginas públicas y /api/health aguantan una ráfaga
// moderada sin caerse ni ponerse lentas. Los límites de uso de la base (134)
// no se miden aquí: se aplican por usuario con sesión y ya se prueban con
// concurrencia real en `npm run test:rls` ("15 a la vez con 9 de cupo").
//
// Uso (con la app corriendo contra la base de STAGING):
//   npm run build && npx next start -p 3100
//   k6 run -e BASE_URL=http://localhost:3100 scripts/carga/humo.js
//
// Ojo: staging corre en Supabase Nano, que se atraganta con ráfagas. Si
// fallan las consultas, mirar primero si es la base (registros de Supabase)
// antes de culpar a la app. No correrla mientras el CI usa staging.

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3100";

// Nunca producción: ni el dominio de Railway ni uno propio que no sea local.
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL) && !__ENV.PERMITIR_STAGING_REMOTO) {
  throw new Error(`BASE_URL=${BASE_URL} no es local. Esta prueba no corre contra producción.`);
}

export const options = {
  stages: [
    { duration: "20s", target: 10 },
    { duration: "40s", target: 20 },
    { duration: "20s", target: 0 },
  ],
  thresholds: {
    // Menos del 1 % de errores y el 95 % de las respuestas en menos de 1,5 s.
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

const RUTAS = ["/", "/catalogo", "/login", "/registro", "/api/health"];

export default function recorrido() {
  for (const ruta of RUTAS) {
    const respuesta = http.get(`${BASE_URL}${ruta}`, { tags: { ruta } });
    check(respuesta, { [`${ruta} responde 200`]: (r) => r.status === 200 });
  }
  sleep(1);
}
