-- Tecnico y ayudante al finalizar el trabajo (salen en el remito).
-- No modifica trabajos ya cargados. Para volver atras: ver bloque REVERTIR al final.
begin;
alter table public.solicitudes add column if not exists tecnico_remito text;
alter table public.solicitudes add column if not exists ayudante text;

drop function if exists public.finalizar_trabajo_con_foto(bigint,boolean,text,text,text,text,text);
create or replace function public.finalizar_trabajo_con_foto(
 p_solicitud_id bigint,p_es_fabrica boolean,p_path text,p_trabajo text,
 p_observaciones text,p_firma text,p_aclaracion text,
 p_tecnico text default null,p_ayudante text default null
) returns void language plpgsql security definer set search_path=public as $$
declare s public.solicitudes%rowtype; nuevo_estado text; asignado boolean; tipo text;
begin
 if auth.uid() is null or coalesce(public.get_my_role(),'') not in ('TECNICO','FABRICA') then
 raise exception 'Solo el tecnico asignado puede finalizar' using errcode='42501'; end if;
 select * into s from public.solicitudes where id=p_solicitud_id for update;
 if not found then raise exception 'Solicitud inexistente'; end if;
 select exists(select 1 from public.asignaciones a where a.usuario_id=auth.uid() and
 ((not p_es_fabrica and a.solicitud_id=s.id) or
 (p_es_fabrica and a.solicitud_fabrica_id=s.solicitud_fabrica_id))) into asignado;
 if not asignado then raise exception 'Sin asignacion' using errcode='42501'; end if;
 if s.estado in ('FINALIZADO','PENDIENTE_PRECIO','PRESUPUESTADO') then
 if exists(select 1 from public.fotos_trabajos f where f.solicitud_id=s.id and f.storage_path=p_path and f.creado_por=auth.uid()) then return; end if;
 raise exception 'El trabajo ya fue finalizado. Recarga la pagina.'; end if;
 if coalesce(trim(p_trabajo),'')='' or coalesce(trim(p_aclaracion),'')=''
 or coalesce(p_firma,'') not like 'data:image/png;base64,%' then
 raise exception 'Completa trabajo, firma y aclaracion'; end if;
 if p_path not like 'solicitudes/'||s.id||'/%' or not exists(
 select 1 from storage.objects o where o.bucket_id='fotos-trabajos' and o.name=p_path
 and o.owner_id=auth.uid()::text and o.metadata->>'mimetype'='image/jpeg'
 ) then raise exception 'Falta subir una foto valida del trabajo'; end if;
 tipo := s.tipo_visita;
 if p_es_fabrica then select coalesce(tipo_visita,s.tipo_visita) into tipo from public.solicitudes_fabrica where id=s.solicitud_fabrica_id; end if;
 nuevo_estado := case when lower(trim(coalesce(tipo,''))) in ('presupuesto','urgencia')
 then 'PENDIENTE_PRECIO' else 'PRESUPUESTADO' end;
 insert into public.fotos_trabajos(solicitud_id,storage_path,creado_por)
 values(s.id,p_path,auth.uid());
 update public.solicitudes set trabajo_realizado=p_trabajo,
 observaciones_tecnico=p_observaciones,firma_cliente=p_firma,aclaracion_cliente=p_aclaracion,
 tecnico_remito=nullif(trim(coalesce(p_tecnico,'')),''),ayudante=nullif(trim(coalesce(p_ayudante,'')),''),
 estado=nuevo_estado,fecha_finalizacion=now() where id=s.id;
 if p_es_fabrica then update public.solicitudes_fabrica set estado=nuevo_estado
 where id=s.solicitud_fabrica_id; end if;
end $$;
revoke all on function public.finalizar_trabajo_con_foto(bigint,boolean,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.finalizar_trabajo_con_foto(bigint,boolean,text,text,text,text,text,text,text) to authenticated;
commit;
