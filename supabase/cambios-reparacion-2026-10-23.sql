-- 2026-10-23 - Reparaciones sin fabrica: tipo de venta en ventas
-- Motivo: Franco pidio que las reparaciones cuenten en estadisticas desde dos
-- origenes: (a) visita de solicitud normal tipo "Reparación" (cuenta cuando el
-- vendedor la carga), y (b) reparacion resuelta en la misma visita del
-- presupuesto, registrada como venta manual en Mis clientes. Para (b) hace
-- falta marcar la venta como REPARACION y opcionalmente vincularla a la visita
-- (ventas.solicitud_id ya existe). Historicos quedan NULL = venta comun, no se
-- reclasifica nada.
begin;
alter table public.ventas add column if not exists tipo text;
commit;

-- Verificacion (esperado: 1 fila, tipo text):
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'ventas' and column_name = 'tipo';

-- Reversion (borra las marcas de reparacion cargadas desde esta fecha):
-- alter table public.ventas drop column if exists tipo;
