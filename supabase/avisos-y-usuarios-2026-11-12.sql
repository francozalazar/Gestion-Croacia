-- Croacia 12/11: campanita compartida, avisos nuevos y baja segura de usuarios.
-- Un solo bloque. Requiere notificaciones-circuito y notificaciones-listos ya aplicadas
-- (si faltan, corta con un mensaje y no cambia nada). No toca trabajos, stock ni pagos.
-- Para deshacer la baja segura:
--   alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';
begin;

do $$ begin
 if to_regclass('public.profiles') is null or to_regclass('public.avisos_circuito') is null
  or to_regclass('public.solicitudes') is null or to_regclass('public.solicitudes_fabrica') is null
  or not exists(select 1 from pg_proc where proname='aviso_fabrica_lista') then
  raise exception 'Primero ejecutá notificaciones-circuito y notificaciones-listos. No se cambió nada.';
 end if;
 if exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole, unnest(s.setconfig) c
   where r.rolname='authenticator' and c like 'pgrst.db_pre_request=%' and c<>'pgrst.db_pre_request=public.bloquear_inactivos') then
  raise exception 'Ya existe otro filtro previo en la API. No se cambió nada; avisá antes de seguir.';
 end if;
end $$;

-- 1) Campanita: lo leído se comparte entre celular y computadora.
create table if not exists public.campana_lecturas (
 usuario_id uuid primary key references public.profiles(id) on delete cascade,
 visto_hasta timestamptz not null default now()
);
alter table public.campana_lecturas enable row level security;
revoke all on public.campana_lecturas from public, anon;
grant select, insert, update on public.campana_lecturas to authenticated;
drop policy if exists campana_lecturas_ver on public.campana_lecturas;
create policy campana_lecturas_ver on public.campana_lecturas for select to authenticated using (usuario_id = auth.uid());
drop policy if exists campana_lecturas_crear on public.campana_lecturas;
create policy campana_lecturas_crear on public.campana_lecturas for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists campana_lecturas_cambiar on public.campana_lecturas;
create policy campana_lecturas_cambiar on public.campana_lecturas for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 2) Avisos al celular o compu: trabajo nuevo para fábrica, para coordinar y finalizado. Sin retroactivos.
alter table public.avisos_circuito drop constraint if exists avisos_circuito_tipo_check;
alter table public.avisos_circuito add constraint avisos_circuito_tipo_check
 check(tipo in ('precio','aprobacion_pendiente','fabrica_aprobada','asignacion_vendedor','fabrica_lista','fabrica_nueva','coordinar','finalizado'));

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

create or replace function public.aviso_visita_estado() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.estado='PENDIENTE_COORDINACION' and (tg_op='INSERT' or old.estado is distinct from new.estado) then
  insert into public.avisos_circuito(usuario_id,tipo,solicitud_id,clave)
  select id,'coordinar',new.id,'coordinar:'||new.id||':'||id||':'||txid_current()
  from public.profiles where rol in ('ADMIN','COORDINACION','ENCARGADO') and activo is true
  on conflict(clave) do nothing;
 end if;
 if new.estado='FINALIZADO' and tg_op='UPDATE' and old.estado is distinct from new.estado then
  insert into public.avisos_circuito(usuario_id,tipo,solicitud_id,clave)
  select id,'finalizado',new.id,'finalizado:'||new.id||':'||id||':'||txid_current()
  from public.profiles where activo is true
   and (rol in ('ADMIN','COORDINACION') or (rol='OFICINA' and id=new.creado_por))
  on conflict(clave) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.aviso_visita_estado() from public,anon,authenticated;
drop trigger if exists aviso_visita_estado on public.solicitudes;
create trigger aviso_visita_estado after insert or update of estado on public.solicitudes
 for each row execute function public.aviso_visita_estado();

-- 3) Baja segura: un usuario con activo=false es rechazado en TODA llamada a la base
-- (tablas y funciones), aunque conserve un token anterior. Los usuarios activos no cambian.
create or replace function public.bloquear_inactivos() returns void
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and activo is false) then
  raise exception 'Sin acceso' using errcode='42501';
 end if;
end $$;
grant execute on function public.bloquear_inactivos() to anon, authenticated, service_role;
alter role authenticator set pgrst.db_pre_request = 'public.bloquear_inactivos';

create or replace function public.cerrar_sesiones_usuario(uid uuid) returns void
language sql security definer set search_path=public,auth as $$
 delete from auth.sessions where user_id = uid;
$$;
revoke all on function public.cerrar_sesiones_usuario(uuid) from public, anon, authenticated;
grant execute on function public.cerrar_sesiones_usuario(uuid) to service_role;

notify pgrst, 'reload config';
commit;
