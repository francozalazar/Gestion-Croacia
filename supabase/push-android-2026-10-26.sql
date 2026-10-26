-- PREPARACIÓN: no ejecutar hasta configurar servidor y secreto de despacho.
-- No cambia cuentas, pedidos, RLS existentes ni asignaciones.
begin;
create table if not exists public.push_suscripciones (
 endpoint text primary key,
 usuario_id uuid not null references public.profiles(id) on delete cascade,
 p256dh text not null,
 auth text not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.push_eventos (
 id bigint generated always as identity primary key,
 asignacion_id bigint not null,
 usuario_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 procesado_at timestamptz,
 bloqueado_hasta timestamptz,
 intentos integer not null default 0
);
create table if not exists public.push_entregas (
 evento_id bigint not null references public.push_eventos(id) on delete cascade,
 endpoint text not null references public.push_suscripciones(endpoint) on delete cascade,
 enviado_at timestamptz,
 primary key(evento_id,endpoint)
);
alter table public.push_suscripciones enable row level security;
alter table public.push_eventos enable row level security;
alter table public.push_entregas enable row level security;
revoke all on public.push_suscripciones, public.push_eventos, public.push_entregas from public, anon, authenticated;
grant all on public.push_suscripciones, public.push_eventos, public.push_entregas to service_role;
grant usage,select on sequence public.push_eventos_id_seq to service_role;

create or replace function public.push_encolar_asignacion() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.usuario_id is null or new.tipo is distinct from 'TECNICO' then return new; end if;
 if tg_op='UPDATE' then
   if old.usuario_id is not distinct from new.usuario_id and old.tipo is not distinct from new.tipo then return new; end if;
 end if;
 if not exists(select 1 from public.profiles where id=new.usuario_id and rol='TECNICO' and activo is true) then return new; end if;
 -- Invalida sólo lo que aún no fue despachado de esta asignación.
 update public.push_eventos set procesado_at=now() where asignacion_id=new.id and procesado_at is null;
 insert into public.push_eventos(asignacion_id,usuario_id) values(new.id,new.usuario_id);
 return new;
end $$;
revoke all on function public.push_encolar_asignacion() from public,anon,authenticated;
drop trigger if exists push_asignacion_encolar on public.asignaciones;
create trigger push_asignacion_encolar after insert or update of usuario_id,tipo on public.asignaciones for each row execute function public.push_encolar_asignacion();

-- Reclamo atómico: dos despachadores no procesan la misma fila a la vez.
create or replace function public.push_reclamar() returns setof public.push_eventos
language sql security definer set search_path=public as $$
 update public.push_eventos set bloqueado_hasta=now()+interval '2 minutes',intentos=intentos+1
 where id in (
  select id from public.push_eventos where procesado_at is null
   and created_at>now()-interval '1 hour' and intentos<6
   and (bloqueado_hasta is null or bloqueado_hasta<now())
  order by id for update skip locked limit 20
 ) returning *;
$$;
revoke all on function public.push_reclamar() from public,anon,authenticated;
grant execute on function public.push_reclamar() to service_role;
commit;
-- Despacho: pendiente habilitar pg_net/pg_cron y secreto de autorización en Vault.
-- No incluye secretos ni activa tareas periódicas por sí mismo.

-- ACTIVACIÓN: ejecutar sólo después de publicar y configurar servidor.
-- Crear previamente en Supabase Vault el secreto "croacia_push_dispatch".
-- Debe coincidir con PUSH_DISPATCH_SECRET en Vercel; no pegarlo acá.
begin;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create or replace function public.push_solicitar_despacho() returns void
language plpgsql security definer set search_path=public as $$
declare clave text;
begin
 -- Depurar vencidos: no entregar asignaciones antiguas al reactivar el servidor.
 update public.push_eventos set procesado_at=now()
 where procesado_at is null and (created_at<now()-interval '1 hour' or intentos>=6);
 if not exists(select 1 from public.push_eventos where procesado_at is null and (bloqueado_hasta is null or bloqueado_hasta<now())) then return; end if;
 select decrypted_secret into clave from vault.decrypted_secrets where name='croacia_push_dispatch';
 if clave is null then raise exception 'Falta configurar secreto de despacho'; end if;
 perform net.http_post(
   url:='https://gestion-croacia.vercel.app/api/push/despachar',
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||clave),
   body:='{}'::jsonb, timeout_milliseconds:=10000
 );
end $$;
revoke all on function public.push_solicitar_despacho() from public,anon,authenticated;
-- Nombre estable: cron.schedule actualiza el trabajo por nombre, no duplica.
select cron.schedule('croacia-push-asignaciones','* * * * *','select public.push_solicitar_despacho()');
commit;
-- Desactivar sin borrar asignaciones ni usuarios:
-- select cron.unschedule('croacia-push-asignaciones');
-- alter table public.asignaciones disable trigger push_asignacion_encolar;
