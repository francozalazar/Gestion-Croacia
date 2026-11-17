-- 17/11/2026 - Motores usados por tecnico: ocultar trabajos ya finalizados.
-- Pedido de Franco: "si el tecnico ya finalizo el remito tiene q desaparecer de las opciones
-- de stock de motores" (tengan o no motores cargados).
-- Criterio de finalizacion real: solicitudes.fecha_finalizacion / solicitudes_fabrica.fecha_finalizado
-- (el estado de oficina, p.ej. PRESUPUESTADO, no marca la finalizacion).
-- Mismo cuerpo que encargado_trabajos_tecnico, solo se agregan los dos filtros de finalizacion.
create or replace function public.encargado_trabajos_tecnico(p_tecnico uuid, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r jsonb; begin
  if not exists(select 1 from public.profiles where id=auth.uid() and rol='ENCARGADO' and activo) then raise exception 'Sin acceso' using errcode='42501'; end if;
  with asig as (select solicitud_id, solicitud_fabrica_id, prioridad from public.asignaciones where usuario_id=p_tecnico and fecha=p_fecha),
  sol_asig as (select s.* from public.solicitudes s where s.id in (select solicitud_id from asig where solicitud_id is not null)),
  ids_fab as (select solicitud_fabrica_id id from asig where solicitud_fabrica_id is not null union select solicitud_fabrica_id from sol_asig where solicitud_fabrica_id is not null),
  normales as (select s.id, false esfabrica, coalesce(s.numero::text,s.id::text) numero, s.cliente_nombre, s.direccion, s.estado, (select a.prioridad from asig a where a.solicitud_id=s.id limit 1) prioridad from sol_asig s where s.solicitud_fabrica_id is null and coalesce(s.estado,'')<>'ANULADO' and s.fecha_finalizacion is null and coalesce(s.estado,'')<>'FINALIZADO'),
  fabricas as (select f.id, true esfabrica, coalesce(f.numero_remito::text,f.id::text) numero, f.cliente_nombre, f.direccion, f.estado, (select a.prioridad from asig a where a.solicitud_fabrica_id=f.id or a.solicitud_id in (select id from sol_asig where solicitud_fabrica_id=f.id) limit 1) prioridad from public.solicitudes_fabrica f where f.id in (select id from ids_fab) and coalesce(f.estado,'')<>'ANULADO' and f.fecha_finalizado is null and coalesce(f.estado,'')<>'FINALIZADO'),
  todos as (select * from normales union all select * from fabricas)
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'esFabrica',t.esfabrica,'numero',t.numero,'cliente',t.cliente_nombre,'direccion',t.direccion,'estado',t.estado,'prioridad',t.prioridad, 'descontados',(select coalesce(jsonb_agg(jsonb_build_object('motor_id',x.motor_id,'cantidad',x.c)),'[]'::jsonb) from (select m.motor_id, sum(m.cantidad)::int c from public.stock_movimientos m where m.tipo='SALIDA' and ((not t.esfabrica and m.solicitud_id=t.id) or (t.esfabrica and m.solicitud_fabrica_id=t.id)) group by m.motor_id) x) ) order by t.prioridad nulls last),'[]'::jsonb) into r from todos t;
  return r;
end;
$$;
