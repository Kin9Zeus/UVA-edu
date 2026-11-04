-- ============================================================
-- Permisos de las funciones y de los buckets — FASE 5 del plan de blindaje
-- ("Supabase: la puerta que no pasa por Cloudflare").
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-134.
--
-- La llave pública de Supabase va en el navegador: cualquiera puede llamar
-- a la API sin pasar por la app. Aquí la defensa son los permisos.
--
-- Revisión de funciones (staging y producción, 2026-11-03)
-- --------------------------------------------------------
-- 26 funciones de `public` se pueden ejecutar con sesión; 6 también sin
-- ella. Todas las SECURITY DEFINER (las que corren con permisos elevados)
-- se protegen por dentro: las de administrador exigen
-- `private.es_administrador()` (con el 2FA del 131), y las demás solo actúan
-- sobre `auth.uid()`. La lista cerrada y su porqué están en
-- scripts/rls-test.ts ("PERMISOS DE FUNCIONES"): una función nueva fuera de
-- la lista hace fallar el CI hasta que alguien la justifique.
--
-- Lo único que sobraba: `admin_listar_usuarios` ejecutable sin sesión. El
-- 127 la recreó con dos parámetros nuevos y Postgres le da EXECUTE a
-- PUBLIC a toda función nueva. No filtraba datos (rechaza a quien no es
-- administrador), pero no tiene por qué estar abierta.
-- ============================================================

revoke execute on function public.admin_listar_usuarios(text, date, date, text, text, text, text, text, int, int)
  from public, anon;
grant execute on function public.admin_listar_usuarios(text, date, date, text, text, text, text, text, int, int)
  to authenticated;

-- ============================================================
-- Buckets: tipo y tamaño máximo
-- ------------------------------------------------------------
-- Ningún bucket restringía el tipo de archivo, y dos no tenían tope de
-- tamaño. La app ya valida todo antes de subir, pero quien sube directo por
-- la API (su propia carpeta en avatares, comunidad-adjuntos o certificados)
-- no pasaba por esa validación: podía subir HTML, SVG o un archivo enorme.
-- Ahora lo frena Storage. Solo afecta subidas nuevas; lo ya guardado
-- (revisado en producción) cumple estos tipos.
--
-- Los tipos son exactamente los que la app sube:
--   avatares            src/lib/fotoPerfilServidor.ts convierte todo a WebP.
--                       JPEG y PNG quedan por las fotos anteriores a eso.
--   comunidad-adjuntos  src/lib/comunidad-adjuntos.ts: imágenes a WebP, y
--                       PDF, ZIP, DOCX, XLSX y PPTX tal cual.
--   portadas-cursos     src/lib/admin/portada.ts convierte a WebP.
--   certificados        src/actions/certificados/descargar.ts, PDF de pdf-lib
--                       (el más grande hoy pesa 0,4 MB).
--
-- materiales-lecciones queda sin lista de tipos a propósito: la subida la
-- hace el navegador del administrador con el tipo que reporta el sistema
-- (un ZIP en Windows llega como application/x-zip-compressed, o vacío), y
-- restringirlo rompería subidas válidas. Ese bucket solo acepta escrituras
-- de administradores, tiene tope de 50 MB (066) y la app revisa el
-- contenido real del archivo después (src/lib/admin/recurso.ts).
-- ============================================================

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'],
    file_size_limit = 3145728 -- 3 MB, el mismo de 091
where id = 'avatares';

update storage.buckets
set allowed_mime_types = array[
      'image/webp',
      'application/pdf',
      'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ],
    file_size_limit = 10485760 -- 10 MB, el mismo de 086
where id = 'comunidad-adjuntos';

update storage.buckets
set allowed_mime_types = array['image/webp'],
    file_size_limit = 5242880 -- 5 MB; una portada procesada pesa ~100 KB
where id = 'portadas-cursos';

update storage.buckets
set allowed_mime_types = array['application/pdf'],
    file_size_limit = 2097152 -- 2 MB; un certificado pesa ~0,4 MB
where id = 'certificados';
