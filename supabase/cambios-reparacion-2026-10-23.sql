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

-- Idempotencia de altas manuales (venta + pago inicial), 23/10:
-- clave generada en el cliente por alta; un retry repite la clave y el
-- servidor reutiliza la fila existente en vez de duplicar venta o pago.
alter table ventas add column if not exists idempotencia_key text;
alter table pagos add column if not exists idempotencia_key text;
create unique index if not exists ventas_idempotencia_key_unica
  on ventas (idempotencia_key) where idempotencia_key is not null;
create unique index if not exists pagos_idempotencia_key_unica
  on pagos (idempotencia_key) where idempotencia_key is not null;

-- verificacion:
-- select column_name from information_schema.columns where table_name in ('ventas','pagos') and column_name='idempotencia_key';
-- revert:
-- drop index if exists ventas_idempotencia_key_unica; drop index if exists pagos_idempotencia_key_unica;
-- alter table ventas drop column if exists idempotencia_key; alter table pagos drop column if exists idempotencia_key;
