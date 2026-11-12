-- Aviso al celular o compu de Fábrica cuando un pedido pasa a cortar (aprobado).
-- Requiere notificaciones-circuito y notificaciones-listos ya aplicadas.
-- No modifica trabajos, stock, pagos ni permisos. Sin avisos retroactivos.
begin;
do $$ begin
 if to_regclass('public.avisos_circuito') is null or to_regclass('public.solicitudes_fabrica') is null
  or not exists(select 1 from pg_proc where proname='aviso_fabrica_lista') then
  raise exception 'Primero ejecutá notificaciones-circuito y notificaciones-listos. No se cambió nada.';
 end if;
end $$;
alter table public.avisos_circuito drop constraint if exists avisos_circuito_tipo_check;
alter table public.avisos_circuito add constraint avisos_circuito_tipo_check
 check(tipo in ('precio','aprobacion_pendiente','fabrica_aprobada','asignacion_vendedor','fabrica_lista','fabrica_nueva'));
create or replace function public.aviso_fabrica_nueva() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.estado='ENVIADO_A_CORTAR' and old.estado='PENDIENTE_APROBACION' then
  insert into public.avisos_circuito(usuario_id,tipo,solicitud_fabrica_id,clave)
  select id,'fabrica_nueva',new.id,'fabrica_nueva:'||new.id||':'||id||':'||txid_current()
  from public.profiles where rol='FABRICA' and activo is true
  on conflict(clave) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.aviso_fabrica_nueva() from public,anon,authenticated;
drop trigger if exists aviso_fabrica_nueva on public.solicitudes_fabrica;
create trigger aviso_fabrica_nueva after update of estado on public.solicitudes_fabrica
 for each row execute function public.aviso_fabrica_nueva();
commit;
