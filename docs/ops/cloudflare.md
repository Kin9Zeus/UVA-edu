# Cloudflare delante de producción (fases 1 y 2 del plan de blindaje)

Qué hace: el dominio apunta a Cloudflare, y Cloudflare reenvía a Railway.
Quien ataca habla con Cloudflare (WAF, límites, desafíos), nunca directo
con nuestro servidor. La fase 2 cierra la puerta de atrás: Railway responde
403 a quien no venga de Cloudflare.

El código ya está listo y **apagado**: nada cambia hasta poner
`ORIGEN_SECRETO` en Railway (`src/lib/origen.ts`, `src/proxy.ts`,
`src/lib/clientIp.ts`).

**Regla:** este documento lleva solo nombres. El valor del secreto vive en
la bóveda, en la regla de Cloudflare y en Railway (sellada).

## 0. Antes de empezar (decide Aleck)

- **Dominio.** `uvarq.com` está en GoDaddy y `www.uvarq.com` es el sitio
  corporativo. Pasar los nameservers a Cloudflare mueve **todo** el
  dominio, incluido ese sitio. Cloudflare copia los registros DNS
  existentes al agregarlo: revisar uno por uno antes de cambiar los
  nameservers. La plataforma puede ir en un subdominio, por ejemplo
  `app.uvarq.com`. Abajo se escribe `DOMINIO` por el que se elija.
- **Plan de Cloudflare.** Todo lo de abajo funciona en el plan gratuito,
  con dos límites que cambian el plan original (sección 3).
- Hacerlo en un horario tranquilo, con alguien que pueda probar en el
  celular.

## 1. Orden para encenderlo sin tumbar la app

Seguir el orden. El error que tumba el sitio es poner `ORIGEN_SECRETO` en
Railway **antes** de que Cloudflare mande la cabecera: todo responde 403.

1. **Dominio en Cloudflare:** agregar el dominio, revisar los registros
   copiados y cambiar los nameservers en GoDaddy. Esperar a que Cloudflare
   diga "Active" (de minutos a 24 h).
2. **Railway:** en el servicio `UVA-edu` → Settings → Networking → Custom
   Domain, agregar `DOMINIO`. Railway da un destino CNAME.
3. **DNS en Cloudflare:** registro CNAME de `DOMINIO` hacia ese destino,
   **con la nube naranja (proxy)**.
4. **SSL/TLS** (sección 2.1). Comprobar que `https://DOMINIO` abre con
   candado y que la respuesta trae la cabecera `cf-ray`.
5. **Variables y servicios que apuntan al dominio viejo** (sección 4).
   Probar login con correo, login con Google, recuperar contraseña, ver un
   video.
6. **Seguridad de Cloudflare** (secciones 2.2 a 2.6). Probar de nuevo los
   webhooks (sección 5) después de cada bloque.
7. **Secreto de origen, primero en Cloudflare:**
   - Generar un valor largo, por ejemplo con
     `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
     y guardarlo en la bóveda.
   - Rules → Transform Rules → Modify Request Header → regla
     "Secreto de origen": a todas las peticiones, **Set static**
     `X-Origen-Uva` = el valor.
8. **Después, en Railway:** variable `ORIGEN_SECRETO` = el mismo valor,
   **sellada**. Railway redespliega solo.
9. **Comprobar** (sección 5). Si algo falla: sección 6.
10. **Quitar el dominio de Railway** (`uva-edu-production.up.railway.app`):
    Settings → Networking → borrar el dominio generado. Solo cuando todo lo
    de la sección 5 esté en verde.
11. **Quitar la tarjeta "Diagnóstico de red"** de `/admin/configuracion`:
    volvió solo para este cambio (`src/components/admin/configuracion/DiagnosticoRed.tsx`).

## 2. Ajustes de Cloudflare

### 2.1 SSL/TLS
- SSL/TLS → Overview: **Full (strict)**. Railway tiene certificado propio;
  si todavía no lo emitió, dejar **Full** unas horas y volver a strict.
  Nunca "Flexible": entre Cloudflare y Railway iría sin cifrar.
- Edge Certificates: **Always Use HTTPS** activo, **Minimum TLS Version
  1.2**.
- La app ya manda HSTS (`next.config.ts`); no activar HSTS también en
  Cloudflare, para no tener dos fuentes.

### 2.2 WAF administrado
- Security → WAF → Managed rules: activar **Cloudflare Free Managed
  Ruleset**. (En Pro: además el OWASP Core Ruleset, en modo registro una
  semana antes de bloquear.)

### 2.3 Reglas propias (Security → WAF → Custom rules; el plan gratuito permite 5)

**a) Webhooks sin desafíos.** Mux y Supabase no resuelven CAPTCHAs.
- Si: `starts_with(http.request.uri.path, "/api/webhooks/")`
- Acción: **Skip** → todas las reglas personalizadas restantes, los límites
  de peticiones y el Super Bot Fight Mode. Ponerla **primera**.
- La firma de cada webhook la sigue verificando la app.

**b) `/_next/image` solo con lo que la app usa.** Capa extra ante fallas del
optimizador de imágenes. Next solo acepta imágenes locales y las portadas de
Supabase (`next.config.ts`, `remotePatterns`), con anchos fijos y calidad 75.
- Si (todo en una expresión):
  ```
  http.request.uri.path eq "/_next/image" and (
    not any(http.request.uri.args["w"][*] in {"32" "48" "64" "96" "128" "256" "384" "640" "750" "828" "1080" "1200" "1920" "2048" "3840"})
    or not any(http.request.uri.args["q"][*] eq "75")
    or not (
      (any(starts_with(http.request.uri.args["url"][*], "/")) and not any(starts_with(http.request.uri.args["url"][*], "//")))
      or any(starts_with(http.request.uri.args["url"][*], "https://eoewtxnheblzsspnubvt.supabase.co/storage/v1/object/public/portadas-cursos/"))
    )
  )
  ```
- Acción: **Block**.
- Si un día se cambian `deviceSizes`, `imageSizes`, `qualities` o
  `remotePatterns` en `next.config.ts`, hay que cambiar esta regla en el
  mismo PR. Si no, esas imágenes salen rotas.

**c) No bloquear Latinoamérica.** Nuestro público está ahí. Ninguna regla
bloquea por país. Si hace falta frenar tráfico sospechoso, la acción es
**Managed Challenge** (desafío), nunca Block.

### 2.4 Bots
- **Bot Fight Mode: dejarlo apagado en el plan gratuito.** No se le pueden
  excluir rutas: desafiaría también los webhooks de Mux y el hook de
  correos de Supabase, que dejarían de llegar sin aviso. Esto se aparta del
  plan original a propósito. En Pro, usar **Super Bot Fight Mode**, que sí
  respeta la regla (a), y probar los webhooks justo después.

### 2.5 Límites de peticiones (Security → WAF → Rate limiting rules)
El plan gratuito permite **una sola regla**, contando en ventanas de **10
segundos** y bloqueando 10 segundos. Ni el "20 por minuto con bloqueo de 10
minutos" ni el límite general de 600 por minuto del plan original caben ahí.
La regla útil es la de acceso:
- Si: `http.request.method eq "POST" and http.request.uri.path in {"/login" "/registro" "/recuperar" "/canjear" "/actualizar-password"}`
  (las Server Actions de esas pantallas hacen POST a la misma ruta).
- Contar por IP. **5 peticiones en 10 segundos** → **Block** 10 segundos.
  Una persona no llega a eso. Un script sí, y el límite fino por correo y
  por IP de la base (`private.intentos_*`) sigue igual detrás.
- En Pro: subir a la versión del plan original (20 por minuto, 10 minutos
  de bloqueo o desafío) y agregar el límite general.

### 2.6 Transform Rules (Rules → Transform Rules → Modify Request Header)
- **"Secreto de origen":** paso 7 de la sección 1.
- **"Quitar x-middleware-subrequest":** a todas las peticiones,
  **Remove** `x-middleware-subrequest`. Cierra la familia del
  CVE-2025-29927 aunque algún día se olvide actualizar Next.

### 2.7 Caché (Caching → Cache Rules)
- `/_next/static/*`: Cloudflare ya la guarda (son `.js` y `.css` con
  `Cache-Control: immutable`). No hace falta regla.
- `/_next/image`: regla **Eligible for cache**, respetando las cabeceras
  del origen. Si: `http.request.uri.path eq "/_next/image"`.
- **Nunca** cachear páginas: llevan la sesión del usuario.

### 2.8 Avisos (Notifications)
Activar, al correo que lee todo el equipo:
- HTTP DDoS Attack Alert.
- Security Events Alert (picos de eventos del WAF).

## 3. Diferencias con el plan original (para Aleck)

| Plan original | Con el plan gratuito de Cloudflare | Por qué |
| --- | --- | --- |
| Bot Fight Mode activo | Apagado | No se pueden excluir los webhooks |
| 20 POST/min por IP a acceso, bloqueo de 10 min | 5 POST cada 10 s, bloqueo de 10 s | Única ventana del plan gratuito |
| Límite general de 600/min | Sin él | El plan gratuito solo permite una regla |

Todo eso se recupera con Cloudflare Pro.

## 4. Lo que hay que cambiar al dominio nuevo

| Dónde | Qué |
| --- | --- |
| Railway, `UVA-edu` | `NEXT_PUBLIC_SITE_URL=https://DOMINIO`. Es `NEXT_PUBLIC_`: entra al compilar, así que hace falta un despliegue nuevo, no solo reiniciar |
| Supabase (producción) → Authentication → URL Configuration | Site URL = `https://DOMINIO`; agregar `https://DOMINIO/**` a Redirect URLs. Quitar la de Railway al final (paso 10) |
| Supabase → Authentication → Hooks → Send Email | URL = `https://DOMINIO/api/webhooks/supabase-auth` |
| Mux → Settings → Webhooks | URL = `https://DOMINIO/api/webhooks/mux` |
| Google Cloud → OAuth client | Agregar `https://DOMINIO` a los orígenes autorizados. El redirect sigue siendo el de Supabase |
| Monitor de disponibilidad | `https://DOMINIO/api/health` |

`serverActions.allowedOrigins` (`next.config.ts`) **no** se toca: con
Cloudflare delante el origen y el dominio coinciden solos (ver el
comentario ahí).

## 5. Comprobar (criterio de terminado)

- [ ] `https://DOMINIO` abre con certificado válido y la respuesta trae
      `cf-ray`.
- [ ] `/admin/configuracion` → Diagnóstico de red: la IP usada es la tuya
      (compárala con `ifconfig.me`), sale de `CF-Connecting-IP` y el cierre
      dice "encendido, y esta petición pasó por Cloudflare".
- [ ] La URL de Railway sin la cabecera responde 403 (o ya no existe, tras el
      paso 10): `curl -I https://uva-edu-production.up.railway.app/`.
- [ ] Una ráfaga de POST a `/login` desde una IP recibe 429 o bloqueo en el
      borde.
- [ ] Login con correo, con Google y recuperar contraseña funcionan.
- [ ] Los webhooks de Mux llegan: subir un video de prueba y mirar el panel
      de Mux (Webhooks → entregas en 200) y la tabla `eventos_webhook`.
- [ ] Llega el correo de confirmación de una cuenta nueva (hook de Supabase).

## 6. Volver atrás

- **El sitio responde 403 a todo:** borrar `ORIGEN_SECRETO` en Railway.
  Con la variable vacía el cierre se apaga solo. Revisar después que la
  regla de Cloudflare tenga exactamente el mismo valor.
- **Cloudflare da problemas:** en DNS, pasar el registro a nube gris (solo
  DNS) y borrar `ORIGEN_SECRETO`. El sitio queda como antes, sin la capa de
  Cloudflare.
- **Un webhook dejó de llegar:** revisar en Security → Events qué regla lo
  frenó y ajustar la regla (a).

## 7. Cambiar el secreto de origen

Sin dejar el sitio en 403:
1. En Railway: `ORIGEN_SECRETO=nuevo,viejo` (los dos, separados por coma).
   Esperar el despliegue.
2. En Cloudflare: cambiar el valor de la regla "Secreto de origen" al
   nuevo.
3. En Railway: `ORIGEN_SECRETO=nuevo`. Actualizar la bóveda.

Hacerlo cuando alguien que conocía el valor deja el equipo
(`docs/ops/salida-de-miembro-y-cambio-de-llaves.md`) o si se filtró.
