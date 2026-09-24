-- Cambios en la base para asignar técnico con fecha y prioridad.
-- NO se ejecuta solo: correrlo a mano en Supabase > SQL Editor,
-- ANTES de usar esta versión de la app.
-- Si te pregunta "run without RLS", elegí "without" (igual que la vez pasada).

-- 1. El error "asignaciones_prioridad_valida":
--    la columna prioridad tiene valor por defecto 99, pero la regla
--    solo acepta del 1 al 5 (o vacío). Al asignar sin prioridad,
--    la base ponía 99 y la regla lo rechazaba. Sacamos el 99:
alter table public.asignaciones
  alter column prioridad drop default;

-- 2. La función que asigna ahora acepta fecha y prioridad.
--    (Borramos la versión vieja de 3 parámetros para que no queden dos.)
drop function if exists public.asignar_solicitud(bigint, uuid, text);

create or replace function public.asignar_solicitud(
  p_solicitud_id bigint,
  p_usuario_id uuid,
  p_tipo text,
  p_fecha date default null,
  p_prioridad integer default null
)
returns void
language plpgsql
security definer
as $function$
begin
  delete from public.asignaciones
  where solicitud_id = p_solicitud_id;

  insert into public.asignaciones
    (solicitud_id, usuario_id, tipo, fecha, prioridad, asignado_por)
  values
    (p_solicitud_id, p_usuario_id, p_tipo, p_fecha, p_prioridad, auth.uid());

  update public.solicitudes
  set estado = case
        when p_tipo = 'FABRICA' then 'ASIGNADO_FABRICA'
        when p_tipo = 'TECNICO' then 'ASIGNADO'
        else estado
      end,
      fecha = coalesce(p_fecha, fecha)
  where id = p_solicitud_id;
end;
$function$;

-- 3. Si la app tira "function not found" recién corrido esto,
--    esperá un minuto y probá de nuevo (Supabase tarda un toque
--    en registrar la función nueva).
