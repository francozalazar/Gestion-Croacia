-- Rol operativo separado. Sin cambios de usuarios ni datos de negocio.
begin;
alter table public.profiles drop constraint profiles_rol_check;
alter table public.profiles add constraint profiles_rol_check check (rol in ('ADMIN','OFICINA','COORDINACION','TECNICO','FABRICA','ENCARGADO'));
-- app_metadata sólo lo escribe el servidor de Auth, no el formulario de registro.
-- El perfil nace ENCARGADO en la misma transacción, nunca OFICINA provisional.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
 insert into public.profiles(id,nombre,apellido,rol)
 values(new.id,coalesce(new.raw_user_meta_data->>'nombre','Usuario'),new.raw_user_meta_data->>'apellido',
 case when new.raw_app_meta_data->>'rol_inicial'='ENCARGADO' then 'ENCARGADO' else 'OFICINA' end);
 return new;
end $$;
-- Las policies restrictivas se combinan con AND y no afectan otros roles.
drop policy if exists encargado_sin_acceso_directo on public.asignaciones;
create policy encargado_sin_acceso_directo on public.asignaciones as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.clientes;
create policy encargado_sin_acceso_directo on public.clientes as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.direcciones;
create policy encargado_sin_acceso_directo on public.direcciones as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.fotos;
create policy encargado_sin_acceso_directo on public.fotos as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.fotos_trabajos;
create policy encargado_sin_acceso_directo on public.fotos_trabajos as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.pagos;
create policy encargado_sin_acceso_directo on public.pagos as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.pedido_items;
create policy encargado_sin_acceso_directo on public.pedido_items as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.presupuestos_archivados;
create policy encargado_sin_acceso_directo on public.presupuestos_archivados as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.solicitudes;
create policy encargado_sin_acceso_directo on public.solicitudes as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.solicitudes_fabrica;
create policy encargado_sin_acceso_directo on public.solicitudes_fabrica as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.stock_consumos_pedido;
create policy encargado_sin_acceso_directo on public.stock_consumos_pedido as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.stock_motores;
create policy encargado_sin_acceso_directo on public.stock_motores as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.stock_movimientos;
create policy encargado_sin_acceso_directo on public.stock_movimientos as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.trabajo_eventos;
create policy encargado_sin_acceso_directo on public.trabajo_eventos as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.trabajos;
create policy encargado_sin_acceso_directo on public.trabajos as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.ventas;
create policy encargado_sin_acceso_directo on public.ventas as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO')
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_sin_acceso_directo on public.stock_operaciones;
create policy encargado_sin_acceso_directo on public.stock_operaciones as restrictive for all to authenticated using (coalesce(public.get_my_role(),'') <> 'ENCARGADO') with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
drop policy if exists encargado_perfil_propio on public.profiles;
create policy encargado_perfil_propio on public.profiles as restrictive for all to authenticated
using (coalesce(public.get_my_role(),'') <> 'ENCARGADO' or id=auth.uid())
with check (coalesce(public.get_my_role(),'') <> 'ENCARGADO');
create or replace function public.encargado_asignado(p_solicitud bigint) returns boolean
language sql stable security definer set search_path=public as $$
select exists(select 1 from public.profiles p join public.solicitudes s on s.id=p_solicitud
join public.asignaciones a on a.usuario_id=p.id and (a.solicitud_id=s.id or a.solicitud_fabrica_id=s.solicitud_fabrica_id)
where p.id=auth.uid() and p.rol='ENCARGADO' and p.activo and s.estado not in ('FINALIZADO','PENDIENTE_PRECIO','PRESUPUESTADO','ANULADO','CANCELADO'));
$$;
revoke all on function public.encargado_asignado(bigint) from public,anon;
grant execute on function public.encargado_asignado(bigint) to authenticated;
CREATE OR REPLACE FUNCTION public.finalizar_trabajo_con_foto(p_solicitud_id bigint, p_es_fabrica boolean, p_path text, p_trabajo text, p_observaciones text, p_firma text, p_aclaracion text, p_tecnico text DEFAULT NULL::text, p_ayudante text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.solicitudes%rowtype; nuevo_estado text; asignado boolean; tipo text;
begin
 if public.get_my_role()='ENCARGADO' and not exists(select 1 from profiles where id=auth.uid() and activo) then raise exception 'Sin acceso' using errcode='42501';end if;
 if auth.uid() is null or coalesce(public.get_my_role(),'') not in ('TECNICO','FABRICA','ENCARGADO') then
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
end $function$
;
CREATE OR REPLACE FUNCTION public.sol_restringir_tecnico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.get_my_role() = 'ENCARGADO' then
    if (to_jsonb(new) - array['trabajo_realizado','observaciones_tecnico','firma_cliente','aclaracion_cliente','estado','fecha_finalizacion','tecnico_remito','ayudante','fecha','horario_desde','horario_hasta']) is distinct from (to_jsonb(old) - array['trabajo_realizado','observaciones_tecnico','firma_cliente','aclaracion_cliente','estado','fecha_finalizacion','tecnico_remito','ayudante','fecha','horario_desde','horario_hasta']) then raise exception 'Sin permiso para esos datos' using errcode='42501'; end if;
  end if;
  if public.get_my_role() = 'TECNICO' then
    if (to_jsonb(new) - array['trabajo_realizado','observaciones_tecnico','firma_cliente','aclaracion_cliente','estado','fecha_finalizacion','tecnico_remito','ayudante'])
       is distinct from (to_jsonb(old) - array['trabajo_realizado','observaciones_tecnico','firma_cliente','aclaracion_cliente','estado','fecha_finalizacion','tecnico_remito','ayudante']) then
      raise exception 'El tecnico solo puede completar el trabajo (trabajo realizado, observaciones, firma, aclaracion, estado, fecha de finalizacion, tecnico y ayudante)' using errcode = '42501';
    end if;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.sf_restringir_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r text := public.get_my_role();
begin
  if r = 'ADMIN' then return new; end if;
  if r in ('OFICINA','COORDINACION','ENCARGADO') then
    if (to_jsonb(new) - array['estado','fecha','horario_desde','horario_hasta','observaciones','fecha_enviada_cortar','fecha_finalizado'])
       is distinct from (to_jsonb(old) - array['estado','fecha','horario_desde','horario_hasta','observaciones','fecha_enviada_cortar','fecha_finalizado']) then
      raise exception 'Este rol solo puede cambiar estado, fecha, horario y observaciones del pedido' using errcode = '42501';
    end if;
    return new;
  end if;
  if r in ('FABRICA','TECNICO') then
    if (to_jsonb(new) - 'estado') is distinct from (to_jsonb(old) - 'estado') then
      raise exception 'Este rol solo puede cambiar el estado del pedido' using errcode = '42501';
    end if;
    return new;
  end if;
  raise exception 'Sin permiso' using errcode = '42501';
end $function$
;
drop policy if exists encargado_foto_subir on storage.objects;
create policy encargado_foto_subir on storage.objects for insert to authenticated
with check (bucket_id='fotos-trabajos' and (storage.foldername(name))[1]='solicitudes'
and public.encargado_asignado(case when (storage.foldername(name))[2] ~ '^[0-9]+$' then (storage.foldername(name))[2]::bigint else null end));
drop policy if exists encargado_foto_ver on storage.objects;
create policy encargado_foto_ver on storage.objects for select to authenticated
using (bucket_id='fotos-trabajos' and owner_id=auth.uid()::text and public.get_my_role()='ENCARGADO');
create or replace function public.encargado_datos() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare resultado jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and rol='ENCARGADO' and activo) then raise exception 'Sin acceso' using errcode='42501'; end if;
 select jsonb_build_object(
 'tecnicos',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',trim(nombre||' '||coalesce(apellido,'')))),'[]') from public.profiles where activo and rol in ('TECNICO','ENCARGADO')),
 'asignaciones',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'solicitud_id',solicitud_id,'solicitud_fabrica_id',solicitud_fabrica_id,'usuario_id',usuario_id,'fecha',fecha,'prioridad',prioridad)),'[]') from public.asignaciones a where tipo='TECNICO' and (exists(select 1 from solicitudes s where s.id=a.solicitud_id and s.estado in ('PENDIENTE_COORDINACION','COORDINACION','ENVIADO_COORDINACION','LISTO_PARA_COLOCAR','ASIGNADO','ASIGNADO_FABRICA','EN_PROCESO')) or exists(select 1 from solicitudes_fabrica s where s.id=a.solicitud_fabrica_id and s.estado in ('PENDIENTE_COORDINACION','COORDINACION','ENVIADO_COORDINACION','LISTO_PARA_COLOCAR','ASIGNADO','EN_PROCESO')))),
 'visitas',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'numero',s.numero,'estado',s.estado,'cliente_nombre',s.cliente_nombre,'cliente_telefono',s.cliente_telefono,'direccion',s.direccion,'localidad',s.localidad,'fecha',s.fecha,'horario_desde',s.horario_desde,'horario_hasta',s.horario_hasta,'tipo_visita',s.tipo_visita,'observaciones',s.observaciones,'solicitud_fabrica_id',s.solicitud_fabrica_id)),'[]') from public.solicitudes s where s.estado in ('PENDIENTE_COORDINACION','COORDINACION','ENVIADO_COORDINACION','LISTO_PARA_COLOCAR','ASIGNADO','ASIGNADO_FABRICA','EN_PROCESO')),
 'pedidos',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'numero',s.numero_remito,'estado',s.estado,'cliente_nombre',s.cliente_nombre,'cliente_telefono',s.cliente_telefono,'direccion',s.direccion,'localidad',s.localidad,'fecha',s.fecha,'horario_desde',s.horario_desde,'horario_hasta',s.horario_hasta,'tipo_visita',s.tipo_visita,'observaciones',s.observaciones)),'[]') from public.solicitudes_fabrica s where s.estado in ('ENVIADO_A_CORTAR','EN_CORTE','EN_FABRICACION','EN_FABRICA','FALTANTES','PENDIENTE_COORDINACION','COORDINACION','ENVIADO_COORDINACION','LISTO_PARA_COLOCAR','ASIGNADO','EN_PROCESO')),
 'motores',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'cantidad',cantidad,'minimo',minimo)),'[]') from public.stock_motores)
 ) into resultado;
 return resultado;
end $$;
revoke all on function public.encargado_datos() from public,anon;
grant execute on function public.encargado_datos() to authenticated;
create or replace function public.encargado_operar(p_accion text,p_datos jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_id bigint; v_fab boolean; v_tabla text; v_estado text; v_tecnico uuid; v_fecha date; v_prioridad integer; v_desde time; v_hasta time; v_count integer; v_motor bigint; v_cantidad integer; v_operacion uuid; v_asignacion bigint;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and rol='ENCARGADO' and activo) then raise exception 'Sin acceso' using errcode='42501'; end if;
 v_id:=(p_datos->>'id')::bigint; v_fab:=coalesce((p_datos->>'fabrica')::boolean,false);
 v_tabla:=case when v_fab then 'solicitudes_fabrica' else 'solicitudes' end;
 if p_accion in ('asignar','prioridad','quitar','produccion') then
  execute format('select estado from public.%I where id=$1 for update',v_tabla) into v_estado using v_id;
  if v_estado is null then raise exception 'Trabajo inexistente'; end if;
 end if;
 if p_accion='asignar' then
  if not v_fab and exists(select 1 from solicitudes where id=v_id and solicitud_fabrica_id is not null) then raise exception 'Asigná por el pedido de fábrica';end if;
  if v_estado not in ('PENDIENTE_COORDINACION','COORDINACION','ENVIADO_COORDINACION','LISTO_PARA_COLOCAR','ASIGNADO','ASIGNADO_FABRICA') then raise exception 'El trabajo no está en coordinación'; end if;
  v_tecnico:=(p_datos->>'tecnico')::uuid;v_fecha:=(p_datos->>'fecha')::date;v_prioridad:=nullif(p_datos->>'prioridad','')::integer;
  if v_fecha is null or (v_prioridad is not null and v_prioridad not between 1 and 5) then raise exception 'Revisá fecha y prioridad (1 a 5)'; end if;
  if not exists(select 1 from profiles where id=v_tecnico and activo and rol in ('TECNICO','ENCARGADO')) then raise exception 'Técnico no habilitado'; end if;
  execute format('select horario_desde,horario_hasta from public.%I where id=$1',v_tabla) into v_desde,v_hasta using v_id;
  -- Respetar horario pactado. Sólo se elige franja cuando no hay horario previo.
  if v_desde is null and v_hasta is null then
   if p_datos->>'franja'='TARDE' then v_desde:='13:00';v_hasta:='17:00';
   elsif p_datos->>'franja'='MANANA' then v_desde:='08:30';v_hasta:='12:30';
   else v_desde:='08:30';v_hasta:='17:00';end if;
  end if;
  if v_fab then
   select id into v_asignacion from asignaciones where solicitud_fabrica_id=v_id for update;
   if v_asignacion is null then
    insert into asignaciones(solicitud_fabrica_id,usuario_id,tipo,fecha,prioridad,asignado_por) values(v_id,v_tecnico,'TECNICO',v_fecha,v_prioridad,auth.uid());
   else update asignaciones set usuario_id=v_tecnico,tipo='TECNICO',fecha=v_fecha,prioridad=v_prioridad,asignado_por=auth.uid() where id=v_asignacion;end if;
  else
   select id into v_asignacion from asignaciones where solicitud_id=v_id for update;
   if v_asignacion is null then
    insert into asignaciones(solicitud_id,usuario_id,tipo,fecha,prioridad,asignado_por) values(v_id,v_tecnico,'TECNICO',v_fecha,v_prioridad,auth.uid());
   else update asignaciones set usuario_id=v_tecnico,tipo='TECNICO',fecha=v_fecha,prioridad=v_prioridad,asignado_por=auth.uid() where id=v_asignacion;end if;
  end if;
  execute format('update public.%I set estado=''ASIGNADO'',fecha=$2,horario_desde=$3,horario_hasta=$4 where id=$1',v_tabla) using v_id,v_fecha,v_desde,v_hasta;
  if v_fab then update solicitudes set estado='ASIGNADO',fecha=v_fecha,horario_desde=v_desde,horario_hasta=v_hasta where solicitud_fabrica_id=v_id;end if;
 elsif p_accion='prioridad' then
  v_tecnico:=(p_datos->>'tecnico')::uuid;v_fecha:=(p_datos->>'fecha')::date;v_prioridad:=nullif(p_datos->>'prioridad','')::integer;
  if v_prioridad is not null and v_prioridad not between 1 and 5 then raise exception 'La prioridad debe estar entre 1 y 5';end if;
  update asignaciones set prioridad=v_prioridad where usuario_id=v_tecnico and fecha=v_fecha and ((v_fab and solicitud_fabrica_id=v_id) or (not v_fab and solicitud_id=v_id));
  get diagnostics v_count=row_count;if v_count<>1 then raise exception 'La asignación cambió. Actualizá la lista.';end if;
 elsif p_accion='produccion' then
  if not v_fab or v_estado not in ('ENVIADO_A_CORTAR','EN_CORTE','EN_FABRICACION','EN_FABRICA','FALTANTES') then raise exception 'El pedido no está en producción';end if;
  if coalesce(p_datos->>'estado','') not in ('ENVIADO_A_CORTAR','EN_CORTE','EN_FABRICACION','FALTANTES','LISTO_PARA_COLOCAR') then raise exception 'Estado no permitido';end if;
  update solicitudes_fabrica set estado=p_datos->>'estado' where id=v_id;
  if p_datos->>'estado'='LISTO_PARA_COLOCAR' then update solicitudes set estado='LISTO_PARA_COLOCAR' where solicitud_fabrica_id=v_id;end if;
 elsif p_accion='stock' then
  v_motor:=(p_datos->>'motor')::bigint;v_cantidad:=(p_datos->>'cantidad')::integer;
  if v_cantidad is null or v_cantidad<=0 or coalesce(p_datos->>'tipo','') not in ('ENTRADA','SALIDA') or length(trim(coalesce(p_datos->>'detalle','')))=0 then raise exception 'Indicá modelo, cantidad y motivo';end if;
  v_operacion:=(p_datos->>'operacion')::uuid;
  if v_operacion is null then raise exception 'Falta identificador de operación';end if;
  insert into stock_operaciones(id,creado_por) values(v_operacion,auth.uid()) on conflict(id) do nothing;
  get diagnostics v_count=row_count;if v_count=0 then return jsonb_build_object('ok',true,'ya_aplicado',true);end if;
  if not exists(select 1 from stock_motores where id=v_motor) then raise exception 'Motor inexistente';end if;
  insert into stock_movimientos(motor_id,tipo,cantidad,detalle,creado_por,operacion_id) values(v_motor,p_datos->>'tipo',v_cantidad,trim(p_datos->>'detalle'),auth.uid(),v_operacion);
 elsif p_accion='minimo' then
  v_cantidad:=(p_datos->>'cantidad')::integer;
  if v_cantidad is null or v_cantidad<0 then raise exception 'Mínimo inválido';end if;
  update stock_motores set minimo=v_cantidad where id=(p_datos->>'motor')::bigint;
 else raise exception 'Acción no permitida';
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.encargado_operar(text,jsonb) from public,anon;
grant execute on function public.encargado_operar(text,jsonb) to authenticated;

create or replace function public.encargado_trabajo(p_id bigint,p_fabrica boolean) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare s public.solicitudes%rowtype;f public.solicitudes_fabrica%rowtype;c public.clientes%rowtype;
begin
 if not exists(select 1 from profiles where id=auth.uid() and rol='ENCARGADO' and activo) then raise exception 'Sin acceso' using errcode='42501';end if;
 if p_fabrica then
  if not exists(select 1 from asignaciones where solicitud_fabrica_id=p_id and usuario_id=auth.uid()) then raise exception 'Sin asignación' using errcode='42501';end if;
  select * into f from solicitudes_fabrica where id=p_id;
  select * into s from solicitudes where solicitud_fabrica_id=p_id order by id limit 1;
 else
  if not exists(select 1 from asignaciones where solicitud_id=p_id and usuario_id=auth.uid()) then raise exception 'Sin asignación' using errcode='42501';end if;
  select * into s from solicitudes where id=p_id;
 end if;
 if s.id is null then raise exception 'No existe solicitud para completar';end if;
 select * into c from clientes where id=s.cliente_id;
 return jsonb_build_object('id',p_id,'solicitudPrincipalId',s.id,'numero',coalesce(f.numero_remito,s.numero,s.id),'estado',coalesce(f.estado,s.estado),'cliente_nombre',coalesce(f.cliente_nombre,s.cliente_nombre,c.nombre),'cliente_telefono',coalesce(f.cliente_telefono,s.cliente_telefono,c.telefono),'direccion',coalesce(f.direccion,s.direccion),'localidad',coalesce(f.localidad,s.localidad),'fecha',coalesce(f.fecha,s.fecha),'horario_desde',coalesce(f.horario_desde,s.horario_desde),'horario_hasta',coalesce(f.horario_hasta,s.horario_hasta),'tipo_visita',coalesce(f.tipo_visita,s.tipo_visita),'observaciones',coalesce(f.observaciones,s.observaciones),'trabajo_realizado',s.trabajo_realizado,'observaciones_tecnico',s.observaciones_tecnico,'firma_cliente',s.firma_cliente,'aclaracion_cliente',s.aclaracion_cliente,'tecnico_remito',s.tecnico_remito,'ayudante',s.ayudante);
end $$;
revoke all on function public.encargado_trabajo(bigint,boolean) from public,anon;
grant execute on function public.encargado_trabajo(bigint,boolean) to authenticated;
create or replace function public.encargado_version() returns integer
language plpgsql stable security definer set search_path=public as $$
begin
 if not exists(select 1 from profiles where id=auth.uid() and rol='ADMIN' and activo) then raise exception 'Sin acceso' using errcode='42501';end if;
 return 1;
end $$;
revoke all on function public.encargado_version() from public,anon;
grant execute on function public.encargado_version() to authenticated;
commit;
