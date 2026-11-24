-- Los textos legales pasan a vivir en el código (src/content/legal): la
-- tabla nunca tuvo un texto real y se quitan los scripts que la llenaban.
-- Se borran también las funciones de supabase/sql/130, que ya no existe.

DROP TABLE IF EXISTS "textos_legales";

DROP FUNCTION IF EXISTS private.textos_legales_guarda();
DROP FUNCTION IF EXISTS public.purgar_texto_legal_de_prueba(text);
