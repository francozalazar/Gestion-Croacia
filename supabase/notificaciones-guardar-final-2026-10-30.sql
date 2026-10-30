-- Corrección de avisos al vendedor: esperar al guardado final del trabajo.
-- No cambia pedidos, asignaciones, usuarios, RLS ni el push existente al técnico.
-- Requiere notificaciones-circuito-2026-10-30.sql ya aplicada.
begin;
do $$ begin
 if to_regprocedure('public.aviso_cambio_trabajo()') is null
 or to_regprocedure('public.aviso_encolar_asignacion(bigint)') is null then
  raise exception 'Falta la migración de avisos del circuito';
 end if;
 if not exists(select 1 from pg_trigger where tgname='aviso_cambio_trabajo' and tgrelid='public.solicitudes'::regclass and not tgisinternal)
 or not exists(select 1 from pg_trigger where tgname='aviso_cambio_trabajo' and tgrelid='public.solicitudes_fabrica'::regclass and not tgisinternal) then
  raise exception 'Faltan triggers del guardado final';
 end if;
end $$;
-- Coordinación guarda primero la asignación y luego el estado/fecha del trabajo.
-- El trigger de trabajo ejecuta el encolado incluso si estado y fecha no cambiaron,
-- por lo que también detecta un cambio de técnico manteniendo la misma fecha.
drop trigger if exists aviso_cambio_asignacion on public.asignaciones;
commit;
