-- Cambios en la base para el arreglo del circuito de fábrica.
-- NO se ejecuta solo: hay que correrlo a mano en Supabase > SQL Editor,
-- ANTES de usar esta versión de la app.
-- Revisá cada paso. No conozco el esquema exacto de tu base, así que
-- los pasos 0 son para chequear antes de cambiar nada.

-- 0a. ¿Qué tipo tiene el id de solicitudes_fabrica? (normalmente bigint)
select column_name, data_type
from information_schema.columns
where table_name = 'solicitudes_fabrica' and column_name = 'id';

-- 0b. ¿La columna estado tiene alguna restricción o enum?
-- Si aparece un CHECK con la lista de estados, hay que sumarle
-- 'LISTO_PARA_COLOCAR' y 'ENVIADO_COORDINACION' (y en solicitudes, 'LISTO_PARA_COLOCAR').
select conrelid::regclass as tabla, conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid in ('solicitudes'::regclass, 'solicitudes_fabrica'::regclass)
  and contype = 'c';

select table_name, column_name, data_type, udt_name
from information_schema.columns
where table_name in ('solicitudes', 'solicitudes_fabrica') and column_name = 'estado';

-- 1. Vínculo entre el trabajo (solicitudes) y su remito de fábrica.
--    Si el paso 0a dio otro tipo (ej. uuid o integer), cambiá bigint por ese tipo.
alter table solicitudes
  add column if not exists solicitud_fabrica_id bigint
  references solicitudes_fabrica(id) on delete set null;

create index if not exists solicitudes_solicitud_fabrica_id_idx
  on solicitudes (solicitud_fabrica_id);

-- 2. Renombrar el estado viejo de fábrica al nombre unificado.
update solicitudes_fabrica
set estado = 'LISTO_PARA_COLOCAR'
where estado = 'LISTO_INSTALACION';

-- 3. Trabajos viejos creados antes de este arreglo no tienen el vínculo.
--    Primero MIRÁ qué pares encuentra (mismo cliente y dirección):
select s.id as solicitud_id, s.cliente_nombre, s.direccion, s.estado,
       f.id as remito_id, f.numero_remito, f.estado as estado_remito
from solicitudes s
join solicitudes_fabrica f
  on f.cliente_nombre = s.cliente_nombre
 and f.direccion = s.direccion
where s.estado = 'ASIGNADO_FABRICA'
  and s.solicitud_fabrica_id is null
order by s.id;

--    Si los pares están bien (uno a uno), vinculalos:
-- update solicitudes s
-- set solicitud_fabrica_id = f.id
-- from solicitudes_fabrica f
-- where f.cliente_nombre = s.cliente_nombre
--   and f.direccion = s.direccion
--   and s.estado = 'ASIGNADO_FABRICA'
--   and s.solicitud_fabrica_id is null;

-- 4. Los trabajos cuyo remito ya estaba listo pasan a "Listos para colocar":
-- update solicitudes s
-- set estado = 'LISTO_PARA_COLOCAR'
-- from solicitudes_fabrica f
-- where s.solicitud_fabrica_id = f.id
--   and f.estado = 'LISTO_PARA_COLOCAR'
--   and s.estado = 'ASIGNADO_FABRICA';

-- 5. Si tenés solicitudes con estado 'EN_PROCESO' (la app ya no lo usa), fijate cuántas:
select estado, count(*) from solicitudes group by estado order by estado;

-- 6. RLS: si tenés políticas que limitan qué columnas o estados puede tocar cada rol,
--    asegurate de que:
--    - FABRICA pueda hacer UPDATE en solicitudes (solo estado) donde solicitud_fabrica_id no sea null,
--    - OFICINA pueda hacer UPDATE en solicitudes y solicitudes_fabrica (estado).
--    Si no, los botones van a mostrar error o no van a cambiar nada.
