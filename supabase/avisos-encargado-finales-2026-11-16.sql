-- Croacia 16/11 (parte 2): copia de referencia de las definiciones FINALES que quedaron
-- vivas en Supabase el 16/11/2026. Complementa a notificaciones-matriz-2026-11-16.sql,
-- que solo tiene la primera tanda. Son CREATE OR REPLACE: reejecutar es seguro pero no
-- hace falta si la base ya las tiene (verificado por lectura el 16/11).
--
-- 1) aviso_encolar_asignacion: el aviso de asignación llega al autor del trabajo con rol
--    OFICINA o ADMIN (antes solo OFICINA; por eso Franco-admin no recibía el aviso).
-- 2) encargado_operar: incluye las acciones 'quitar' (borra la asignación y el trabajo
--    vuelve a PENDIENTE_COORDINACION) y 'anular' (borrado definitivo; la base lo rechaza
--    con mensaje si el trabajo tiene ventas, pagos o fotos asociadas).

-- 1) Aviso de asignación al vendedor (OFICINA o ADMIN) que cargó el trabajo
CREATE OR REPLACE FUNCTION public.aviso_encolar_asignacion(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 if not exists(select 1 from public.profiles where id=autor and rol in ('OFICINA','ADMIN') and activo is true) then return; end if;
 if exists(select 1 from public.avisos_circuito where id=(select max(id) from public.avisos_circuito where asignacion_id=a.id and tipo='asignacion_vendedor')
 and usuario_id=autor and tecnico_id=a.usuario_id and fecha=a.fecha) then return; end if;
 update public.avisos_circuito set procesado_at=now() where asignacion_id=a.id and tipo='asignacion_vendedor' and procesado_at is null;
 insert into public.avisos_circuito(usuario_id,tipo,solicitud_id,solicitud_fabrica_id,asignacion_id,tecnico_id,fecha,clave)
 values(autor,'asignacion_vendedor',a.solicitud_id,a.solicitud_fabrica_id,a.id,a.usuario_id,a.fecha,
 'asignacion:'||a.id||':'||a.usuario_id||':'||a.fecha||':'||txid_current()) on conflict(clave) do nothing;
end $function$


-- 2) Operaciones del encargado (asignar, prioridad, quitar, anular, producción, stock)
CREATE OR REPLACE FUNCTION public.encargado_operar(p_accion text, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint; v_fab boolean; v_tabla text; v_estado text; v_tecnico uuid; v_fecha date; v_prioridad integer; v_desde time; v_hasta time; v_count integer; v_motor bigint; v_cantidad integer; v_operacion uuid; v_asignacion bigint; v_sumas jsonb:='{}'::jsonb; v_key text; v_item jsonb; v_sol bigint; v_ped bigint;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and rol='ENCARGADO' and activo) then raise exception 'Sin acceso' using errcode='42501'; end if;
 v_id:=(p_datos->>'id')::bigint; v_fab:=coalesce((p_datos->>'fabrica')::boolean,false);
 v_tabla:=case when v_fab then 'solicitudes_fabrica' else 'solicitudes' end;
 if p_accion in ('asignar','prioridad','quitar','anular','produccion') then
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
 elsif p_accion='modelo' then
 v_cantidad:=coalesce(nullif(p_datos->>'inicial','')::integer,0); v_prioridad:=coalesce(nullif(p_datos->>'minimo','')::integer,0);
 if length(trim(coalesce(p_datos->>'nombre','')))=0 then raise exception 'Falta el nombre del modelo'; end if;
 if v_cantidad<0 or v_prioridad<0 then raise exception 'Las cantidades tienen que ser 0 o más'; end if;
 insert into stock_motores(nombre,cantidad,minimo) values(trim(p_datos->>'nombre'),0,v_prioridad) returning id into v_motor;
 if v_cantidad>0 then insert into stock_movimientos(motor_id,tipo,cantidad,detalle,creado_por) values(v_motor,'INICIAL',v_cantidad,'Stock inicial',auth.uid()); end if;
 elsif p_accion='motores_trabajo' then
 v_tecnico:=(p_datos->>'tecnico')::uuid; v_sol:=nullif(p_datos->>'solicitud','')::bigint; v_ped:=nullif(p_datos->>'pedido','')::bigint; v_operacion:=(p_datos->>'operacion')::uuid;
 if v_operacion is null or v_tecnico is null then raise exception 'Faltan datos del envío.'; end if;
 if (v_sol is null)=(v_ped is null) then raise exception 'Indicá un trabajo (visita o pedido de fábrica).'; end if;
 if v_sol is not null and exists(select 1 from solicitudes where id=v_sol and solicitud_fabrica_id is not null) then raise exception 'Ese trabajo tiene pedido de fábrica: cargalo por el pedido.'; end if;
 if not exists(select 1 from asignaciones a where a.usuario_id=v_tecnico and ((v_sol is not null and a.solicitud_id=v_sol) or (v_ped is not null and (a.solicitud_fabrica_id=v_ped or a.solicitud_id in (select id from solicitudes where solicitud_fabrica_id=v_ped))))) then raise exception 'Ese trabajo no está asignado a ese técnico.'; end if;
 for v_item in select * from jsonb_array_elements(coalesce(p_datos->'items','[]'::jsonb)) loop
 v_motor:=(v_item->>'motor_id')::bigint; v_cantidad:=(v_item->>'cantidad')::integer;
 if v_motor is null or v_cantidad is null or v_cantidad<=0 then raise exception 'Cada motor necesita modelo y una cantidad entera mayor a 0.'; end if;
 if not exists(select 1 from stock_motores where id=v_motor) then raise exception 'Motor inexistente'; end if;
 v_key:=v_motor::text; v_sumas:=jsonb_set(v_sumas,array[v_key],to_jsonb(coalesce((v_sumas->>v_key)::integer,0)+v_cantidad));
 end loop;
 if v_sumas='{}'::jsonb then raise exception 'Cargá al menos un modelo con su cantidad.'; end if;
 if v_ped is not null then perform 1 from solicitudes_fabrica where id=v_ped for update; if not found then raise exception 'No se encontró el pedido.'; end if;
 else perform 1 from solicitudes where id=v_sol for update; if not found then raise exception 'No se encontró el trabajo.'; end if; end if;
 insert into stock_operaciones(id,creado_por) values(v_operacion,auth.uid()) on conflict(id) do nothing;
 get diagnostics v_count=row_count; if v_count=0 then return jsonb_build_object('ok',true,'ya_aplicado',true); end if;
 for v_key in select jsonb_object_keys(v_sumas) loop
 insert into stock_movimientos(motor_id,tipo,cantidad,detalle,solicitud_fabrica_id,solicitud_id,tecnico_id,operacion_id,creado_por)
 values(v_key::bigint,'SALIDA',(v_sumas->>v_key)::integer,'Trabajo #'||coalesce(v_ped,v_sol)||' - cargado por Encargado',v_ped,v_sol,v_tecnico,v_operacion,auth.uid());
 end loop;
 return jsonb_build_object('ok',true,'ya_aplicado',false);
 elsif p_accion='quitar' then
 v_tecnico:=(p_datos->>'tecnico')::uuid; v_fecha:=(p_datos->>'fecha')::date;
 if v_estado not in ('ASIGNADO','EN_PROCESO','ASIGNADO_FABRICA') then raise exception 'El trabajo ya no está asignado. Actualizá la lista.'; end if;
 if not v_fab and exists(select 1 from solicitudes where id=v_id and solicitud_fabrica_id is not null) then raise exception 'Quitá la asignación desde el pedido de fábrica'; end if;
 delete from asignaciones where usuario_id=v_tecnico and fecha=v_fecha and ((v_fab and solicitud_fabrica_id=v_id) or (not v_fab and solicitud_id=v_id));
 get diagnostics v_count=row_count; if v_count=0 then raise exception 'La asignación cambió. Actualizá la lista.'; end if;
 if v_fab then
 update solicitudes set estado='PENDIENTE_COORDINACION' where solicitud_fabrica_id=v_id;
 update solicitudes_fabrica set estado='PENDIENTE_COORDINACION' where id=v_id;
 else update solicitudes set estado='PENDIENTE_COORDINACION' where id=v_id; end if;
 elsif p_accion='anular' then
 if v_estado not in ('ASIGNADO','EN_PROCESO','ASIGNADO_FABRICA') then raise exception 'Solo se borran trabajos que están en el recorrido. Actualizá la lista.'; end if;
 if not v_fab and exists(select 1 from solicitudes where id=v_id and solicitud_fabrica_id is not null) then raise exception 'Anulá desde el pedido de fábrica'; end if;
 begin
 if v_fab then
 delete from asignaciones where solicitud_fabrica_id=v_id or solicitud_id in (select id from solicitudes where solicitud_fabrica_id=v_id);
 delete from solicitudes where solicitud_fabrica_id=v_id;
 delete from solicitudes_fabrica where id=v_id;
 else
 delete from asignaciones where solicitud_id=v_id;
 delete from solicitudes where id=v_id;
 end if;
 exception when foreign_key_violation then
 raise exception 'Este trabajo tiene ventas, pagos o fotos asociadas y no se puede borrar desde acá. Pedile a administración.';
 end;
 elsif p_accion='minimo' then
 v_cantidad:=(p_datos->>'cantidad')::integer;
 if v_cantidad is null or v_cantidad<0 then raise exception 'Mínimo inválido';end if;
 update stock_motores set minimo=v_cantidad where id=(p_datos->>'motor')::bigint;
 else raise exception 'Acción no permitida';
 end if;
 return jsonb_build_object('ok',true);
end $function$

