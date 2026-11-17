-- Cobrado en efectivo por el tecnico (Franco, 17/11/2026):
-- al finalizar una visita tipo Presupuesto/Urgencia, el tecnico marca si cobro
-- en efectivo en el momento. Esos trabajos vuelven a Presupuestos resaltados
-- en verde ("ya recibio el dinero") y NO pasan por el paso de Precio del admin
-- (van directo a PRESUPUESTADO sin quedar PENDIENTE_PRECIO, asi que tampoco
-- disparan el aviso de "precio asignado", que exige venir de PENDIENTE_PRECIO).
-- Es solo una marca de estado: no toca montos ni genera pagos.
begin;

alter table public.solicitudes
  add column if not exists cobrado_efectivo boolean not null default false;

drop function if exists public.finalizar_trabajo_con_foto(bigint,boolean,text,text,text,text,text,text,text);
create or replace function public.finalizar_trabajo_con_foto(
  p_solicitud_id bigint, p_es_fabrica boolean, p_path text, p_trabajo text,
  p_observaciones text, p_firma text, p_aclaracion text,
  p_tecnico text default null, p_ayudante text default null,
  p_cobrado_efectivo boolean default false
) returns void language plpgsql security definer set search_path=public as $$
declare
  s public.solicitudes%rowtype;
  nuevo_estado text;
  asignado boolean;
  tipo text;
  cobrado boolean;
begin
  if public.get_my_role()='ENCARGADO' and not exists(select 1 from profiles where id=auth.uid() and activo) then
    raise exception 'Sin acceso' using errcode='42501';
  end if;
  if auth.uid() is null or coalesce(public.get_my_role(),'') not in ('TECNICO','FABRICA','ENCARGADO') then
    raise exception 'Solo el tecnico asignado puede finalizar' using errcode='42501';
  end if;
  select * into s from public.solicitudes where id=p_solicitud_id for update;
  if not found then raise exception 'Solicitud inexistente'; end if;
  select exists(select 1 from public.asignaciones a where a.usuario_id=auth.uid() and
    ((not p_es_fabrica and a.solicitud_id=s.id) or
     (p_es_fabrica and a.solicitud_fabrica_id=s.solicitud_fabrica_id))) into asignado;
  if not asignado then raise exception 'Sin asignacion' using errcode='42501'; end if;
  if s.estado in ('FINALIZADO','PENDIENTE_PRECIO','PRESUPUESTADO') then
    if exists(select 1 from public.fotos_trabajos f where f.solicitud_id=s.id and f.storage_path=p_path and f.creado_por=auth.uid()) then
      return;
    end if;
    raise exception 'El trabajo ya fue finalizado. Recarga la pagina.';
  end if;
  if coalesce(trim(p_trabajo),'')='' or coalesce(trim(p_aclaracion),'')=''
     or coalesce(p_firma,'') not like 'data:image/png;base64,%' then
    raise exception 'Completa trabajo, firma y aclaracion';
  end if;
  if p_path not like 'solicitudes/'||s.id||'/%' or not exists(
    select 1 from storage.objects o where o.bucket_id='fotos-trabajos' and o.name=p_path
      and o.owner_id=auth.uid()::text and o.metadata->>'mimetype'='image/jpeg'
  ) then raise exception 'Falta subir una foto valida del trabajo'; end if;

  tipo := s.tipo_visita;
  if p_es_fabrica then
    select coalesce(tipo_visita,s.tipo_visita) into tipo from public.solicitudes_fabrica where id=s.solicitud_fabrica_id;
  end if;

  -- El cobrado en efectivo solo aplica a visitas que llevan precio (presupuesto/urgencia).
  cobrado := coalesce(p_cobrado_efectivo,false)
             and lower(trim(coalesce(tipo,''))) in ('presupuesto','urgencia');

  nuevo_estado := case
    when s.solicitud_fabrica_id is not null and lower(trim(coalesce(tipo,''))) = 'cortar e instalar' then 'FINALIZADO'
    when lower(trim(coalesce(tipo,''))) in ('presupuesto','urgencia') and not cobrado then 'PENDIENTE_PRECIO'
    else 'PRESUPUESTADO'
  end;

  insert into public.fotos_trabajos(solicitud_id,storage_path,creado_por)
    values(s.id,p_path,auth.uid());
  update public.solicitudes set trabajo_realizado=p_trabajo,
    observaciones_tecnico=p_observaciones,firma_cliente=p_firma,aclaracion_cliente=p_aclaracion,
    tecnico_remito=nullif(trim(coalesce(p_tecnico,'')),''),ayudante=nullif(trim(coalesce(p_ayudante,'')), ''),
    cobrado_efectivo=cobrado,
    estado=nuevo_estado,fecha_finalizacion=now()
  where id=s.id;
  if p_es_fabrica then
    update public.solicitudes_fabrica set estado=nuevo_estado where id=s.solicitud_fabrica_id;
  end if;
end $$;

revoke all on function public.finalizar_trabajo_con_foto(bigint,boolean,text,text,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.finalizar_trabajo_con_foto(bigint,boolean,text,text,text,text,text,text,text,boolean) to authenticated;

commit;
