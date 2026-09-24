-- ============================================================
-- Cambios de base de datos para el flujo de fabrica completo
-- y la nueva regla al finalizar trabajos.
-- Ejecutar en Supabase > SQL Editor, TODO el archivo de una vez.
-- Si alguna linea da error, sacar captura y avisar.
-- ============================================================

-- 1) solicitudes.estado: agregar PENDIENTE_PRECIO a la lista permitida.
--    (se borra la regla vieja y se crea con la lista completa)

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'solicitudes'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%estado%'
  loop
    execute format('alter table solicitudes drop constraint %I', r.conname);
  end loop;
end $$;

alter table solicitudes
  add constraint solicitudes_estado_check
  check (estado in (
    'PENDIENTE',
    'PENDIENTE_COORDINACION',
    'COORDINACION',
    'ASIGNADO',
    'EN_PROCESO',
    'FINALIZADO',
    'PRESUPUESTADO',
    'CANCELADO',
    'ASIGNADO_FABRICA',
    'LISTO_PARA_COLOCAR',
    'ENVIADO_COORDINACION',
    'PENDIENTE_PRECIO'
  )) not valid;

alter table solicitudes validate constraint solicitudes_estado_check;


-- 2) solicitudes_fabrica.estado: lista completa del circuito de fabrica.
--    (incluye estados viejos por las dudas, y los nuevos de coordinacion
--     y de finalizar)

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'solicitudes_fabrica'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%estado%'
  loop
    execute format('alter table solicitudes_fabrica drop constraint %I', r.conname);
  end loop;
end $$;

alter table solicitudes_fabrica
  add constraint solicitudes_fabrica_estado_check
  check (estado in (
    'PENDIENTE_APROBACION',
    'ENVIADO_A_CORTAR',
    'EN_CORTE',
    'EN_FABRICACION',
    'EN_FABRICA',
    'FALTANTES',
    'LISTO_PARA_COLOCAR',
    'PENDIENTE_COORDINACION',
    'COORDINACION',
    'ASIGNADO',
    'ENVIADO_COORDINACION',
    'FINALIZADO',
    'ANULADO',
    'PENDIENTE_PRECIO',
    'PRESUPUESTADO',
    -- legados, por si quedo algun dato viejo:
    'LISTO_INSTALACION',
    'PENDIENTE',
    'EN_PROCESO',
    'CANCELADO'
  )) not valid;

alter table solicitudes_fabrica validate constraint solicitudes_fabrica_estado_check;
