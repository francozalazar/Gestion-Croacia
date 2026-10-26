-- Corrección del circuito: transacciones atómicas e idempotentes.
-- No repara ni reclasifica pedidos históricos en masa. No registra pagos.
-- Publicar el código después de ejecutar esta transacción completa.
begin;
create or replace function public.aprobar_pedido_fabrica(p_pedido bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare f public.solicitudes_fabrica%rowtype; v_sol bigint; v_cantidad integer; v_estado text;
begin
 if not exists(select 1 from profiles where id=auth.uid() and rol='ADMIN' and activo) then
  raise exception 'Solo Administración puede aprobar pedidos' using errcode='42501';
 end if;
 select * into f from solicitudes_fabrica where id=p_pedido for update;
 if not found then raise exception 'Pedido inexistente';end if;
 if f.estado in ('ANULADO','CANCELADO','FINALIZADO') then
  raise exception 'No se puede aprobar o reconstruir automáticamente un pedido anulado o con estado finalizado histórico';
 end if;
 select count(*),min(id) into v_cantidad,v_sol from solicitudes where solicitud_fabrica_id=f.id;
 if v_cantidad>1 then raise exception 'Hay más de una visita vinculada. Revisar el pedido sin crear duplicados';end if;
 if f.estado='PENDIENTE_APROBACION' then
  update solicitudes_fabrica set estado='ENVIADO_A_CORTAR',fecha_enviada_cortar=coalesce(fecha_enviada_cortar,now()) where id=f.id;
  v_estado:='ASIGNADO_FABRICA';
 else
  -- No retroceder producción, coordinación ni instalación al reintentar.
  v_estado:=case when f.estado in ('ENVIADO_A_CORTAR','EN_CORTE','EN_FABRICACION','EN_FABRICA','FALTANTES') then 'ASIGNADO_FABRICA' else f.estado end;
 end if;
 if v_sol is null then
  -- El vínculo faltante sólo se puede reconstruir antes de la finalización técnica.
  if f.estado in ('PRESUPUESTADO','PENDIENTE_PRECIO') then raise exception 'Pedido con finalización técnica sin vínculo. Requiere revisión manual';end if;
  if f.cliente_id is null then raise exception 'Falta el cliente del pedido. Revisar antes de aprobar';end if;
  insert into solicitudes(cliente_id,cliente_nombre,cliente_telefono,direccion,localidad,provincia,fecha,horario_desde,horario_hasta,tipo_visita,observaciones,estado,creado_por,solicitud_fabrica_id)
  values(f.cliente_id,f.cliente_nombre,f.cliente_telefono,f.direccion,f.localidad,f.provincia,f.fecha,f.horario_desde,f.horario_hasta,coalesce(f.tipo_visita,'Instalación'),f.observaciones,v_estado,f.creado_por,f.id)
  returning id into v_sol;
 end if;
 return jsonb_build_object('ok',true,'solicitud_id',v_sol);
end $$;
revoke all on function public.aprobar_pedido_fabrica(bigint) from public,anon;
grant execute on function public.aprobar_pedido_fabrica(bigint) to authenticated;

create or replace function public.cerrar_cobro_pedido(p_pedido bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare f public.solicitudes_fabrica%rowtype; v_total numeric; v_pagado numeric; v_ventas integer;
begin
 if not exists(select 1 from profiles where id=auth.uid() and rol='ADMIN' and activo) then
  raise exception 'Solo Administración puede cerrar el cobro' using errcode='42501';end if;
 select * into f from solicitudes_fabrica where id=p_pedido for update;
 if not found then raise exception 'Pedido inexistente';end if;
 if f.fecha_finalizado is not null then return jsonb_build_object('ok',true,'sin_cambios',true);end if;
 if f.estado in ('PENDIENTE_APROBACION','ANULADO','CANCELADO') then raise exception 'Aprobá primero el pedido activo';end if;
 -- Misma cuenta que Clientes: ventas y pagos registrados. La seña informativa no se suma de nuevo.
 perform id from ventas where solicitud_fabrica_id=p_pedido for update;
 select count(*),sum(total) into v_ventas,v_total from ventas where solicitud_fabrica_id=p_pedido;
 if v_ventas<>1 or coalesce(v_total,0)<=0 then raise exception 'Revisá la venta del pedido: debe haber un único total mayor que cero';end if;
 select coalesce(sum(p.monto),0) into v_pagado from pagos p join ventas v on v.id=p.venta_id where v.solicitud_fabrica_id=p_pedido;
 if v_pagado<v_total-0.5 then raise exception 'Queda saldo pendiente. Registrá el pago en Clientes antes de cerrar el cobro';end if;
 -- Cierre administrativo independiente: nunca cambia el estado operativo ni fecha_finalizacion.
 update solicitudes_fabrica set fecha_finalizado=now() where id=p_pedido;
 return jsonb_build_object('ok',true,'sin_cambios',false);
end $$;
revoke all on function public.cerrar_cobro_pedido(bigint) from public,anon;
grant execute on function public.cerrar_cobro_pedido(bigint) to authenticated;
commit;
