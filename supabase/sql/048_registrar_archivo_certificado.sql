-- ============================================================
-- registrar_archivo_certificado(): cachear la ruta del PDF ya generado
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 047.
--
-- Certificado.md: "generar bajo demanda y cachear en Supabase Storage... no
-- regenerar en cada descarga". `certificados.archivo_pdf` ya existía en el
-- modelo pero nada lo escribía. `certificados_select_propio` (001) es la
-- única política de la tabla — no hay UPDATE para `authenticated` — así que
-- hace falta un RPC angosto en vez de abrir una política de UPDATE general,
-- que dejaría a un estudiante reescribir cualquier columna de su propio
-- certificado (fecha_emision, codigo_verificacion) vía PATCH directo a
-- PostgREST.
--
-- Mismo criterio de exposición que crear_lote_codigos_invitacion (045):
-- SECURITY DEFINER, grant a `authenticated` porque quien llama es la sesión
-- real del estudiante (descargarCertificadoPdf, con su propio cliente RLS),
-- no el service role. El `where ... and id_usuario = auth.uid()` en el
-- UPDATE es el único chequeo de autorización que hace falta: si la fila no
-- es suya, el UPDATE afecta 0 filas en vez de fallar, que es intencional —
-- no hay nada que reportar de vuelta al llamador que ya intentó tocar un
-- certificado ajeno.
-- ============================================================

create or replace function public.registrar_archivo_certificado(p_certificado_id uuid, p_archivo_pdf text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.certificados
  set archivo_pdf = p_archivo_pdf
  where id = p_certificado_id
    and id_usuario = auth.uid();
end;
$$;

grant execute on function public.registrar_archivo_certificado(uuid, text) to authenticated;
