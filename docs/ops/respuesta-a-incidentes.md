# Respuesta a incidentes de seguridad

Fase 6 del plan de blindaje. Qué hacer cuando algo pasa: quién decide, los
primeros 30 minutos, cómo contener cada tipo de incidente y qué queda
escrito después. Nació del incidente de Railway del 2026-10-21 (variables
de entorno expuestas): ese día no había nada escrito.

**Lo revisa el compañero antes de darlo por terminado.** Mientras no esté
revisado, es un borrador.

## Roles

| Rol | Quién | Qué hace |
| --- | --- | --- |
| Ejecuta | Andrés | Cambia llaves, revierte despliegues, toca los paneles |
| Verifica y registra | Miguel | Comprueba cada paso y lleva la bitácora del incidente |
| Decide | Aleck | Aprueba lo que corta el servicio y lo que se comunica afuera |

Si quien tiene el rol no responde en 30 minutos, lo toma el siguiente de la
lista. En un incidente **crítico** no se espera aprobación para contener (por
ejemplo, cambiar una llave filtrada): se contiene y se avisa.

## Qué tan grave es

| Nivel | Ejemplos | Respuesta |
| --- | --- | --- |
| **Crítico** | Llave maestra, `DATABASE_URL` u otra llave de producción filtrada. Cuenta de administrador tomada. Datos de estudiantes expuestos. Sitio caído | De inmediato, a cualquier hora |
| **Alto** | Vulnerabilidad alta en Next.js, Supabase o una dependencia que usamos. Ataque en curso que el borde no frena. Webhooks que no llegan | El mismo día |
| **Medio** | Picos de errores sin pérdida de datos. Una llave de staging filtrada | En la semana |

## Los primeros 30 minutos

1. **Abrir la bitácora del incidente** (Miguel): una nota con hora de inicio
   y quién está. Todo lo que se haga se anota con la hora. **Nunca valores
   de llaves**, solo nombres.
2. **Confirmar que es real**: revisar Sentry, el registro de Railway y las
   páginas de estado de los proveedores (puede ser una falla de ellos, no
   nuestra).
3. **Contener** (siguiente sección). Contener primero, investigar después.
4. **No borrar evidencia**: no reiniciar ni borrar registros antes de
   copiar lo que muestran (registros de Supabase Auth y de la base, de
   Railway, de Sentry). Sirven para saber qué se tocó.
5. **Avisar a Aleck** con lo que se sabe y lo que se hizo.

## Contener, según el caso

| Caso | Qué hacer |
| --- | --- |
| **Una llave filtrada** | Cambiarla ya, aunque corte unos minutos: `docs/ops/salida-de-miembro-y-cambio-de-llaves.md`, sección 3 |
| **Railway comprometido** (como el 2026-10-21) | Asumir que **todas** las variables de Railway se filtraron y cambiarlas en el orden de la fase E: llave maestra → Mux → hook de correos → Resend → Gemini → Sentry. (`DATABASE_URL` ya no está en Railway desde el 2026-11-04.) Revisar los despliegues recientes por si alguien subió código |
| **Cuenta de administrador tomada** | Quitarle el rol en `perfiles` y cerrar todas sus sesiones (con la skill `pasar-a-produccion`). Quitarle el 2FA para que el dueño lo registre de nuevo. Revisar en la bitácora del panel (`/admin/bitacora`) qué hizo esa cuenta y desde cuándo |
| **Datos de estudiantes expuestos** | Cerrar la vía (revertir el despliegue o la política). Sacar del inventario de datos (`docs/ops/inventario-de-datos.md`) qué datos y de cuántas personas. Ver "Avisar afuera" |
| **Vulnerabilidad en una dependencia** | Ver "Compromiso de parcheo" |
| **Ataque al sitio** (muchas peticiones) | Con Cloudflare: activar *Under Attack Mode* y revisar Security → Events. Sin Cloudflare: los límites de la base (`134`) frenan a cada cuenta, y Railway permite reiniciar el servicio |
| **Despliegue que rompió algo** | `docs/ops/plan-de-reversion.md` |
| **Pago que quedó a medias** | `docs/ops/webhook-pago-perdido.md` |

## Avisar afuera

- **Superintendencia de Industria y Comercio (Habeas Data, Ley 1581 de
  2012):** si se expusieron datos personales, se reporta el incidente en el
  Registro Nacional de Bases de Datos. El plazo es corto (15 días hábiles
  desde que se detecta, según la guía vigente de la SIC). **Confirmar el
  plazo y el formato con asesoría legal** antes de contar con él.
- **Las personas afectadas:** decirles qué pasó, qué datos y qué hacer (por
  ejemplo, cambiar su contraseña). Lo redacta Miguel y lo aprueba Aleck.
- **Proveedores:** si el origen es de ellos (Railway, Supabase), abrir un
  ticket con la evidencia.

## Compromiso de parcheo

Responsable de vigilar los avisos: **(por decidir)**. Fuentes: los avisos de
seguridad de GitHub y las alertas de Dependabot del repo, el blog de
seguridad de Next.js y las notas de Supabase.

| Gravedad del aviso | Plazo para tenerlo en producción |
| --- | --- |
| Crítica | 48 horas |
| Alta | 7 días |
| Media o baja | En la siguiente tanda de actualizaciones |

Next.js va primero: es la vía más común en un despliegue como el nuestro.
El CI ya falla si aparece una vulnerabilidad alta en las dependencias de
producción (`npm audit --omit=dev --audit-level=high`).

## Después: el informe

En la semana siguiente, sin buscar culpables, en el registro de seguridad:

1. Qué pasó y cuándo (línea de tiempo con horas).
2. Cómo nos dimos cuenta y cuánto tardamos.
3. Qué se hizo para contenerlo.
4. A quién afectó y qué datos.
5. Qué cambiamos para que no vuelva a pasar, con responsable y fecha.

## Simulacro

Una vez por fase grande, o cada seis meses: tomar un caso de la tabla (por
ejemplo, "se filtró la llave de Resend") y recorrer el procedimiento en
staging, cronometrando. Lo que no funcione se corrige aquí.
