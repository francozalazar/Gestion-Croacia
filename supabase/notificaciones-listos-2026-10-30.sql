-- Aviso al vendedor que cargó el trabajo cuando Fábrica pasa a Listos para colocar.
-- No modifica trabajos, stock, pagos, permisos ni el proceso de producción.
begin;
alter table public.avisos_circuito drop constraint if exists avisos_circuito_tipo_check;
alter table public.avisos_circuito add constraint avisos_circuito_tipo_check
 check(tipo in ('precio','aprobacion_pendiente','fabrica_aprobada','asignacion_vendedor','fabrica_lista'));
create or replace function public.aviso_fabrica_lista() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.estado='LISTO_PARA_COLOCAR'
 and old.estado in ('ENVIADO_A_CORTAR','EN_CORTE','EN_FABRICACION','EN_FABRICA','FALTANTES') then
  insert into public.avisos_circuito(usuario_id,tipo,solicitud_fabrica_id,clave)
  select id,'fabrica_lista',new.id,'fabrica_lista:'||new.id||':'||id||':'||txid_current()
  from public.profiles where id=new.creado_por and rol='OFICINA' and activo is true
  on conflict(clave) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.aviso_fabrica_lista() from public,anon,authenticated;
drop trigger if exists aviso_fabrica_lista on public.solicitudes_fabrica;
create trigger aviso_fabrica_lista after update of estado on public.solicitudes_fabrica
 for each row execute function public.aviso_fabrica_lista();
commit;
