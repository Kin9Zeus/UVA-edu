# Plan B: levantar la plataforma en otro proveedor (fase 11.2)

Objetivo: si Railway cae por mucho tiempo, suspende la cuenta o hay que
salir de él, U.V.A queda arriba en otro proveedor en **menos de 2 horas**.
Con Cloudflare delante (fases 1 y 2), el cambio final es solo apuntar el DNS
al origen nuevo: los estudiantes no notan nada más.

Lo que no cambia: la base y la autenticación siguen en Supabase, los videos
en Mux y los correos en Resend. Solo se mueve el servidor de la app.

## Antes de que haga falta (una vez)

- [ ] La imagen de Docker se construye en cada PR (job `imagen` del CI). Si
      ese job está en rojo, este plan no funciona: se arregla primero.
- [ ] Elegir el proveedor B y abrir la cuenta: **Render** (el más parecido a
      Railway, lee un Dockerfile del repo) o **Fly.io** (corre la imagen
      donde se le diga). Mejor si lo paga una tarjeta distinta a la de
      Railway.
- [ ] Hacer la prueba completa una vez en staging (abajo) y anotar el
      tiempo real.
- [ ] Tener las variables de producción en el gestor de contraseñas (tabla
      de `salida-de-miembro-y-cambio-de-llaves.md`). Sin eso, este plan
      tarda un día, no dos horas.

## Paso a paso (con reloj)

1. **Crear el servicio** en el proveedor B desde el repo, rama `master`,
   con el Dockerfile `infra/Dockerfile` y como contexto la raíz del repo.
2. **Variables de build** (públicas): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (el dominio
   definitivo), `NEXT_PUBLIC_SENTRY_DSN`, y las banderas
   `NEXT_PUBLIC_PRICING_ENABLED` y `NEXT_PUBLIC_LEGAL_ENABLED` con el mismo
   valor que en Railway.
3. **Variables del servidor**: las mismas de Railway (lista en la tabla de
   llaves), **incluida** `ORIGEN_SECRETO`. `TRUSTED_PROXY_HOPS` puede
   cambiar si el proveedor pone su propio proxy delante: comprobarlo con la
   tarjeta "Diagnóstico de red" de /admin/configuracion.
4. **Puerto** 3000 y chequeo de salud en `/api/health`.
5. **Desplegar** y esperar el verde. Con el cierre de origen encendido, la
   URL directa del proveedor responde 403, y eso es lo correcto: se prueba
   después del paso 7, ya por Cloudflare.
6. **Crons y webhooks**: no hay nada que mover. Los crons viven en Supabase
   y los webhooks apuntan al dominio, no a Railway.
7. **Cloudflare → DNS**: cambiar el registro del dominio al host del
   proveedor B. Con el proxy de Cloudflare encendido (nube naranja), el
   cambio se nota en minutos.
8. **Probar en el celular**: entrar, ver una clase, publicar en la
   Comunidad, descargar un certificado.
9. **Avisar en el canal** y anotar el tiempo total abajo.

Para volver a Railway: el paso 7 al revés.

## Prueba en staging (obligatoria una vez)

Igual que arriba, con las variables de **staging** y sin tocar el DNS de
producción (usar la URL del proveedor o un subdominio de prueba). Para que
la URL directa responda, dejar `ORIGEN_SECRETO` vacía en esa prueba.

| Fecha | Proveedor | Quién | Tiempo total | ¿Todo funcionó? | Qué hubo que corregir |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
