-- Ejecutar después de publicar el servidor. Sin avisos retroactivos.
begin;
create table if not exists public.avisos_circuito (
 id bigint generated always as identity primary key,
 usuario_id uuid not null references public.profiles(id) on delete cascade,
 tipo text not null check(tipo in ('precio','aprobacion_pendiente','fabrica_aprobada','asignacion_vendedor')),
 solicitud_id bigint, solicitud_fabrica_id bigint, asignacion_id bigint,
 tecnico_id uuid, fecha date,
 clave text not null unique,
 created_at timestamptz not null default now(), procesado_at timestamptz,
 bloqueado_hasta timestamptz, intentos integer not null default 0
);
create table if not exists public.avisos_entregas (
 evento_id bigint not null references public.avisos_circuito(id) on delete cascade,
 endpoint text not null references public.push_suscripciones(endpoint) on delete cascade,
 enviado_at timestamptz not null default now(), primary key(evento_id,endpoint)
);
alter table public.avisos_entregas enable row level security;
revoke all on public.avisos_entregas from public,anon,authenticated;
grant all on public.avisos_entregas to service_role;
alter table public.avisos_circuito enable row level security;
revoke all on public.avisos_circuito from public,anon,authenticated;
grant select on public.avisos_circuito to authenticated;
grant all on public.avisos_circuito to service_role;
grant usage,select on sequence public.avisos_circuito_id_seq to service_role;
drop policy if exists avisos_propios on public.avisos_circuito;
create policy avisos_propios on public.avisos_circuito for select to authenticated
 using(usuario_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and activo is true));

create or replace function public.aviso_encolar_asignacion(p_id bigint) returns void
language plpgsql security definer set search_path=public as $$
declare a public.asignaciones%rowtype; autor uuid; estado_actual text; fecha_actual date;
begin
 select * into a from public.asignaciones where id=p_id;
 if a.tipo is distinct from 'TECNICO' or a.usuario_id is null or a.fecha is null then return; end if;
 if a.solicitud_fabrica_id is not null then
  select creado_por,estado,fecha into autor,estado_actual,fecha_actual from public.solicitudes_fabrica where id=a.solicitud_fabrica_id;
 else
  select creado_por,estado,fecha into autor,estado_actual,fecha_actual from public.solicitudes where id=a.solicitud_id;
 end if;
 if estado_actual not in ('ASIGNADO','EN_PROCESO') or fecha_actual is distinct from a.fecha then return; end if;
 if not exists(select 1 from public.profiles where id=autor and rol='OFICINA' and activo is true) then return; end if;
 if exists(select 1 from public.avisos_circuito where id=(select max(id) from public.avisos_circuito where asignacion_id=a.id and tipo='asignacion_vendedor')
 and usuario_id=autor and tecnico_id=a.usuario_id and fecha=a.fecha) then return; end if;
 update public.avisos_circuito set procesado_at=now() where asignacion_id=a.id and tipo='asignacion_vendedor' and procesado_at is null;
 insert into public.avisos_circuito(usuario_id,tipo,solicitud_id,solicitud_fabrica_id,asignacion_id,tecnico_id,fecha,clave)
 values(autor,'asignacion_vendedor',a.solicitud_id,a.solicitud_fabrica_id,a.id,a.usuario_id,a.fecha,
 'asignacion:'||a.id||':'||a.usuario_id||':'||a.fecha||':'||txid_current()) on conflict(clave) do nothing;
end $$;

create or replace function public.aviso_cambio_asignacion() returns trigger
language plpgsql security definer set search_path=public as $$
begin perform public.aviso_encolar_asignacion(new.id); return new; end $$;
drop trigger if exists aviso_cambio_asignacion on public.asignaciones;
create trigger aviso_cambio_asignacion after insert or update of usuario_id,tipo,fecha on public.asignaciones
 for each row execute function public.aviso_cambio_asignacion();

create or replace function public.aviso_cambio_trabajo() returns trigger
language plpgsql security definer set search_path=public as $$
declare a record; tipo_aviso text; es_fabrica boolean := tg_table_name='solicitudes_fabrica';
begin
 if es_fabrica then
  if tg_op='INSERT' then
   if new.estado='PENDIENTE_APROBACION' then tipo_aviso:='aprobacion_pendiente'; end if;
  elsif old.estado is distinct from new.estado then
   if new.estado='PENDIENTE_APROBACION' then tipo_aviso:='aprobacion_pendiente';
   elsif old.estado='PENDIENTE_APROBACION' and new.estado='ENVIADO_A_CORTAR' then tipo_aviso:='fabrica_aprobada'; end if;
  end if;
 else
  if tg_op='UPDATE' then
   if old.estado='PENDIENTE_PRECIO' and new.estado='PRESUPUESTADO'
    and lower(trim(new.tipo_visita)) in ('presupuesto','urgencia') then tipo_aviso:='precio'; end if;
  end if;
 end if;
 if tipo_aviso='aprobacion_pendiente' then
  insert into public.avisos_circuito(usuario_id,tipo,solicitud_fabrica_id,clave)
  select id,tipo_aviso,new.id,'aprobacion:'||new.id||':'||id||':'||txid_current()
  from public.profiles where rol='ADMIN' and activo is true on conflict(clave) do nothing;
 elsif tipo_aviso is not null then
  insert into public.avisos_circuito(usuario_id,tipo,solicitud_id,solicitud_fabrica_id,clave)
  select id,tipo_aviso,case when es_fabrica then null else new.id end,case when es_fabrica then new.id else null end,
   tipo_aviso||':'||new.id||':'||id||':'||txid_current()
  from public.profiles where id=new.creado_por and rol='OFICINA' and activo is true on conflict(clave) do nothing;
 end if;
 if new.estado in ('ASIGNADO','EN_PROCESO') then
  for a in select id from public.asignaciones where
   (es_fabrica and solicitud_fabrica_id=new.id) or (not es_fabrica and solicitud_id=new.id)
  loop perform public.aviso_encolar_asignacion(a.id); end loop;
 end if;
 return new;
end $$;
drop trigger if exists aviso_cambio_trabajo on public.solicitudes;
create trigger aviso_cambio_trabajo after insert or update of estado,fecha on public.solicitudes for each row execute function public.aviso_cambio_trabajo();
drop trigger if exists aviso_cambio_trabajo on public.solicitudes_fabrica;
create trigger aviso_cambio_trabajo after insert or update of estado,fecha on public.solicitudes_fabrica for each row execute function public.aviso_cambio_trabajo();

create or replace function public.avisos_reclamar() returns setof public.avisos_circuito
language sql security definer set search_path=public as $$
 update public.avisos_circuito set bloqueado_hasta=now()+interval '2 minutes',intentos=intentos+1
 where id in(select id from public.avisos_circuito where procesado_at is null and created_at>now()-interval '1 hour' and intentos<6
 and (bloqueado_hasta is null or bloqueado_hasta<now()) order by id for update skip locked limit 20) returning *;
$$;
-- Mantiene cron/secreto existentes. Reclamo técnico original sigue disponible.
revoke all on function public.avisos_reclamar(),public.aviso_encolar_asignacion(bigint),public.aviso_cambio_asignacion(),public.aviso_cambio_trabajo() from public,anon,authenticated;
grant execute on function public.avisos_reclamar() to service_role;
-- El cron existente debe despachar también si hay sólo eventos nuevos.
create or replace function public.push_solicitar_despacho() returns void
language plpgsql security definer set search_path=public as $$
declare clave text;
begin
 update public.push_eventos set procesado_at=now() where procesado_at is null and (created_at<now()-interval '1 hour' or intentos>=6);
 update public.avisos_circuito set procesado_at=now() where procesado_at is null and (created_at<now()-interval '1 hour' or intentos>=6);
 if not exists(select 1 from public.push_eventos where procesado_at is null and (bloqueado_hasta is null or bloqueado_hasta<now()))
 and not exists(select 1 from public.avisos_circuito where procesado_at is null and (bloqueado_hasta is null or bloqueado_hasta<now())) then return; end if;
 select decrypted_secret into clave from vault.decrypted_secrets where name='croacia_push_dispatch';
 if clave is null then raise exception 'Falta configurar secreto de despacho'; end if;
 perform net.http_post(url:='https://gestion-croacia.vercel.app/api/push/despachar',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||clave),body:='{}'::jsonb,timeout_milliseconds:=10000);
end $$;
revoke all on function public.push_solicitar_despacho() from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='avisos_circuito') then
  alter publication supabase_realtime add table public.avisos_circuito;
 end if;
end $$;
commit;
