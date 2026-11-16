-- Croacia 16/11: avisos solo para los eventos pedidos (ya aplicado en Supabase).
-- Quita 'para coordinar' y 'finalizado'; suma stock de motores (Admin y Encargado) y asignación al Encargado.
begin;
drop trigger if exists aviso_visita_estado on public.solicitudes;
drop function if exists public.aviso_visita_estado();
update public.avisos_circuito set procesado_at=now() where procesado_at is null and tipo in ('coordinar','finalizado');
alter table public.avisos_circuito add column if not exists motor_id bigint;
alter table public.avisos_circuito drop constraint if exists avisos_circuito_tipo_check;
alter table public.avisos_circuito add constraint avisos_circuito_tipo_check
 check(tipo in ('precio','aprobacion_pendiente','fabrica_aprobada','asignacion_vendedor','fabrica_lista','fabrica_nueva','coordinar','finalizado','stock_motores'));
create or replace function public.aviso_stock_motor() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.cantidad < old.cantidad and new.cantidad <= new.minimo and old.cantidad > old.minimo then
  insert into public.avisos_circuito(usuario_id,tipo,motor_id,clave)
  select id,'stock_motores',new.id,'stock:'||new.id||':'||id||':'||txid_current()
  from public.profiles where rol in ('ADMIN','ENCARGADO') and activo is true
  on conflict(clave) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.aviso_stock_motor() from public,anon,authenticated;
drop trigger if exists aviso_stock_motor on public.stock_motores;
create trigger aviso_stock_motor after update of cantidad on public.stock_motores
 for each row execute function public.aviso_stock_motor();
create or replace function public.push_encolar_asignacion() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.usuario_id is null or new.tipo is distinct from 'TECNICO' then return new; end if;
 if tg_op='UPDATE' then
   if old.usuario_id is not distinct from new.usuario_id and old.tipo is not distinct from new.tipo then return new; end if;
 end if;
 if not exists(select 1 from public.profiles where id=new.usuario_id and rol in ('TECNICO','ENCARGADO') and activo is true) then return new; end if;
 update public.push_eventos set procesado_at=now() where asignacion_id=new.id and procesado_at is null;
 insert into public.push_eventos(asignacion_id,usuario_id) values(new.id,new.usuario_id);
 return new;
end $$;
revoke all on function public.push_encolar_asignacion() from public,anon,authenticated;
commit;
