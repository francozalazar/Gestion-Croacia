-- 2026-10-23 - Provincia persistente en solicitudes (normal y fabrica)
-- Motivo: el selector de provincia/localidad antes solo filtraba en pantalla;
-- la provincia elegida se perdia. Se agrega columna nullable, sin tocar
-- historicos (quedan NULL, no se inventa provincia para registros viejos).

begin;
alter table public.solicitudes add column if not exists provincia text;
alter table public.solicitudes_fabrica add column if not exists provincia text;
commit;

-- Verificacion (esperado: 2 filas, ambas text):
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('solicitudes', 'solicitudes_fabrica')
  and column_name = 'provincia';

-- Reversion (solo si hace falta deshacer; borra los valores de provincia
-- cargados desde esta fecha, no toca ningun otro dato):
-- alter table public.solicitudes drop column if exists provincia;
-- alter table public.solicitudes_fabrica drop column if exists provincia;
