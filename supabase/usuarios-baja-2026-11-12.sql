-- Al eliminar un usuario desde Admin, cierra sus sesiones abiertas.
-- Solo la clave de servidor de la app puede usarla. No toca trabajos ni historial.
begin;
create or replace function public.cerrar_sesiones_usuario(uid uuid) returns void
language sql security definer set search_path=public,auth as $$
  delete from auth.sessions where user_id = uid;
$$;
revoke all on function public.cerrar_sesiones_usuario(uuid) from public, anon, authenticated;
grant execute on function public.cerrar_sesiones_usuario(uuid) to service_role;
commit;
