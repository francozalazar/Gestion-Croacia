-- Migración operativa del Encargado (aplicada en producción el 03/11/2026 desde el editor SQL).
-- Agrega a encargado_datos: created_at, coordinacion_desde, usuario_creador (sin columnas comerciales).
-- Agrega a encargado_operar: acciones 'modelo' y 'motores_trabajo'. Crea encargado_trabajos_tecnico.
-- Reproducible: parchea las definiciones vivas; correrla de nuevo falla con 'patch ... no aplicó' si ya está aplicada.

do $do$
declare d text; o text;
begin
 -- 1) encargado_datos: sólo datos operativos nuevos (fecha de carga, ingreso a coordinación comprobado, quién cargó). Sin columnas comerciales.
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='encargado_datos';
 o:=d;
 d:=replace(d,$q$'solicitud_fabrica_id',s.solicitud_fabrica_id)$q$,$q$'solicitud_fabrica_id',s.solicitud_fabrica_id,'created_at',s.created_at,'coordinacion_desde',coalesce(s.coordinacion_desde,(select e.created_at from trabajo_eventos e where e.solicitud_id=s.id and e.etapa in ('Pendiente de coordinacion','En coordinacion','PENDIENTE') and not exists(select 1 from trabajo_eventos e2 where e2.solicitud_id=s.id and (e2.created_at,e2.id)>(e.created_at,e.id)) limit 1)),'usuario_creador',coalesce((select trim(pr.nombre||' '||coalesce(pr.apellido,'')) from profiles pr where pr.id=s.creado_por),'Sin usuario'))$q$);
 if d=o then raise exception 'patch visitas no aplicó'; end if;
 o:=d;
 d:=replace(d,$q$'tipo_visita',s.tipo_visita,'observaciones',s.observaciones))$q$,$q$'tipo_visita',s.tipo_visita,'observaciones',s.observaciones,'created_at',s.created_at,'coordinacion_desde',coalesce(s.coordinacion_desde,(select e.created_at from trabajo_eventos e where e.solicitud_fabrica_id=s.id and e.solicitud_id is null and e.etapa in ('Pendiente de coordinacion','En coordinacion','PENDIENTE') and not exists(select 1 from trabajo_eventos e2 where e2.solicitud_fabrica_id=s.id and e2.solicitud_id is null and (e2.created_at,e2.id)>(e.created_at,e.id)) limit 1)),'usuario_creador',coalesce((select trim(pr.nombre||' '||coalesce(pr.apellido,'')) from profiles pr where pr.id=s.creado_por),'Sin usuario')))$q$);
 if d=o then raise exception 'patch pedidos no aplicó'; end if;
 execute d;
 -- 2) encargado_operar: alta de modelo de motor (mismos campos que el formulario de admin)
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='encargado_operar';
 o:=d;
 d:=replace(d,$q$ elsif p_accion='minimo' then$q$,$q$ elsif p_accion='modelo' then
  v_cantidad:=coalesce(nullif(p_datos->>'inicial','')::integer,0); v_prioridad:=coalesce(nullif(p_datos->>'minimo','')::integer,0);
  if length(trim(coalesce(p_datos->>'nombre','')))=0 then raise exception 'Falta el nombre del modelo'; end if;
  if v_cantidad<0 or v_prioridad<0 then raise exception 'Las cantidades tienen que ser 0 o más'; end if;
  insert into stock_motores(nombre,cantidad,minimo) values(trim(p_datos->>'nombre'),0,v_prioridad) returning id into v_motor;
  if v_cantidad>0 then insert into stock_movimientos(motor_id,tipo,cantidad,detalle,creado_por) values(v_motor,'INICIAL',v_cantidad,'Stock inicial',auth.uid()); end if;
 elsif p_accion='minimo' then$q$);
 if d=o then raise exception 'patch modelo no aplicó'; end if;
 execute d;
end $do$;

create or replace function public.encargado_trabajos_tecnico(p_tecnico uuid, p_fecha date) returns jsonb
language plpgsql stable security definer set search_path=public as $f$
declare r jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and rol='ENCARGADO' and activo) then raise exception 'Sin acceso' using errcode='42501'; end if;
 with asig as (select solicitud_id, solicitud_fabrica_id, prioridad from public.asignaciones where usuario_id=p_tecnico and fecha=p_fecha),
 sol_asig as (select s.* from public.solicitudes s where s.id in (select solicitud_id from asig where solicitud_id is not null)),
 ids_fab as (select solicitud_fabrica_id id from asig where solicitud_fabrica_id is not null union select solicitud_fabrica_id from sol_asig where solicitud_fabrica_id is not null),
 normales as (select s.id, false esfabrica, coalesce(s.numero::text,s.id::text) numero, s.cliente_nombre, s.direccion, s.estado,
   (select a.prioridad from asig a where a.solicitud_id=s.id limit 1) prioridad
   from sol_asig s where s.solicitud_fabrica_id is null and coalesce(s.estado,'')<>'ANULADO'),
 fabricas as (select f.id, true esfabrica, coalesce(f.numero_remito::text,f.id::text) numero, f.cliente_nombre, f.direccion, f.estado,
   (select a.prioridad from asig a where a.solicitud_fabrica_id=f.id or a.solicitud_id in (select id from sol_asig where solicitud_fabrica_id=f.id) limit 1) prioridad
   from public.solicitudes_fabrica f where f.id in (select id from ids_fab) and coalesce(f.estado,'')<>'ANULADO'),
 todos as (select * from normales union all select * from fabricas)
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'esFabrica',t.esfabrica,'numero',t.numero,'cliente',t.cliente_nombre,'direccion',t.direccion,'estado',t.estado,'prioridad',t.prioridad,
   'descontados',(select coalesce(jsonb_agg(jsonb_build_object('motor_id',x.motor_id,'cantidad',x.c)),'[]'::jsonb) from (select m.motor_id, sum(m.cantidad)::int c from public.stock_movimientos m where m.tipo='SALIDA' and ((not t.esfabrica and m.solicitud_id=t.id) or (t.esfabrica and m.solicitud_fabrica_id=t.id)) group by m.motor_id) x)
 ) order by t.prioridad nulls last),'[]'::jsonb) into r from todos t;
 return r;
end $f$;
revoke all on function public.encargado_trabajos_tecnico(uuid,date) from public,anon;
grant execute on function public.encargado_trabajos_tecnico(uuid,date) to authenticated;

do $do$
declare d text; o text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='encargado_operar';
 o:=d;
 d:=replace(d,'v_asignacion bigint;','v_asignacion bigint; v_sumas jsonb:=''{}''::jsonb; v_key text; v_item jsonb; v_sol bigint; v_ped bigint;');
 if d=o then raise exception 'patch declare no aplicó'; end if;
 o:=d;
 d:=replace(d,$q$ elsif p_accion='minimo' then$q$,$q$ elsif p_accion='motores_trabajo' then
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
 elsif p_accion='minimo' then$q$);
 if d=o then raise exception 'patch motores_trabajo no aplicó'; end if;
 execute d;
end $do$;
