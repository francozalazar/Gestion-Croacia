-- BORRADOR: validar/aplicar completo en una sola transaccion antes de publicar UI.
-- No modifica historicos. Las fotos son privadas y pertenecen a una solicitud.
begin;
create table if not exists public.fotos_trabajos (
 solicitud_id bigint primary key references public.solicitudes(id),
 storage_path text unique not null,
 creado_por uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
alter table public.fotos_trabajos enable row level security;
revoke all on public.fotos_trabajos from anon, authenticated;
grant select on public.fotos_trabajos to authenticated;
drop policy if exists fotos_trabajos_lectura on public.fotos_trabajos;
create policy fotos_trabajos_lectura on public.fotos_trabajos for select to authenticated
using (exists(select 1 from public.solicitudes s where s.id=fotos_trabajos.solicitud_id
 and (public.get_my_role()='ADMIN' or s.creado_por=auth.uid()
 or exists(select 1 from public.asignaciones a where a.usuario_id=auth.uid()
 and (a.solicitud_id=s.id or a.solicitud_fabrica_id=s.solicitud_fabrica_id)))));
drop policy if exists sol_select_instalacion_asignada on public.solicitudes;
create policy sol_select_instalacion_asignada on public.solicitudes for select to authenticated using (
 public.get_my_role() in ('TECNICO','FABRICA') and exists(select 1 from public.asignaciones a
 where a.solicitud_fabrica_id=solicitudes.solicitud_fabrica_id and a.usuario_id=auth.uid())
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('fotos-trabajos','fotos-trabajos',false,5242880,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg'];
drop policy if exists fotos_trabajos_subir on storage.objects;
create policy fotos_trabajos_subir on storage.objects for insert to authenticated with check (
 bucket_id='fotos-trabajos' and public.get_my_role() in ('TECNICO','FABRICA')
 and (storage.foldername(name))[1]='solicitudes'
 and exists(select 1 from public.solicitudes s join public.asignaciones a
 on (a.solicitud_id=s.id or a.solicitud_fabrica_id=s.solicitud_fabrica_id)
 where s.id::text=(storage.foldername(name))[2] and a.usuario_id=auth.uid()
 and s.estado not in ('FINALIZADO','PENDIENTE_PRECIO','PRESUPUESTADO'))
);
drop policy if exists fotos_trabajos_ver on storage.objects;
create policy fotos_trabajos_ver on storage.objects for select to authenticated using (
 bucket_id='fotos-trabajos' and exists(select 1 from public.fotos_trabajos f
 where f.storage_path=name)
);
create or replace function public.finalizar_trabajo_con_foto(
 p_solicitud_id bigint,p_es_fabrica boolean,p_path text,p_trabajo text,
 p_observaciones text,p_firma text,p_aclaracion text
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
 -- Misma regla que lib/tipoVisita: solo Presupuesto y Urgencia requieren precio.
 tipo := s.tipo_visita;
 if p_es_fabrica then select coalesce(tipo_visita,s.tipo_visita) into tipo from public.solicitudes_fabrica where id=s.solicitud_fabrica_id; end if;
 nuevo_estado := case when lower(trim(coalesce(tipo,''))) in ('presupuesto','urgencia')
 then 'PENDIENTE_PRECIO' else 'PRESUPUESTADO' end;
 insert into public.fotos_trabajos(solicitud_id,storage_path,creado_por)
 values(s.id,p_path,auth.uid());
 update public.solicitudes set trabajo_realizado=p_trabajo,
 observaciones_tecnico=p_observaciones,firma_cliente=p_firma,aclaracion_cliente=p_aclaracion,
 estado=nuevo_estado,fecha_finalizacion=now() where id=s.id;
 if p_es_fabrica then update public.solicitudes_fabrica set estado=nuevo_estado
 where id=s.solicitud_fabrica_id; end if;
end $$;
revoke all on function public.finalizar_trabajo_con_foto(bigint,boolean,text,text,text,text,text) from public,anon;
grant execute on function public.finalizar_trabajo_con_foto(bigint,boolean,text,text,text,text,text) to authenticated;
commit;
