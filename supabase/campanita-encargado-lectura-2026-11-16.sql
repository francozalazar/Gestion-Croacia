-- Fechas de los avisos de asignación propios, sin abrir tablas.
create or replace function public.campana_fechas_encargado() returns table(id bigint,created_at timestamptz) language sql stable security definer set search_path=public as $$ select a.id,a.created_at from asignaciones a join profiles p on p.id=a.usuario_id where p.id=auth.uid() and p.rol='ENCARGADO' and p.activo $$;
revoke all on function public.campana_fechas_encargado() from public,anon;
grant execute on function public.campana_fechas_encargado() to authenticated;
