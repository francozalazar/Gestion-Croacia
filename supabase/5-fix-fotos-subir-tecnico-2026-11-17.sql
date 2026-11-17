-- Fix 17/11/2026: los tecnicos no podian subir la foto al finalizar una visita
-- (error "new row violates row-level security policy" en storage.objects).
-- Causa: la policy fotos_trabajos_subir hace un EXISTS sobre public.solicitudes,
-- y la policy restrictiva tecnico_sin_telefono (16/11) bloquea SELECT de esa
-- tabla al rol TECNICO (que lee por la vista solicitudes_tecnico). Al no poder
-- leer la solicitud, el EXISTS daba falso y el storage rechazaba la subida.
-- Fix: la verificacion se mueve a una funcion SECURITY DEFINER con el mismo
-- criterio de siempre (mismo patron que tecnico_asignado_privado).
begin;

create or replace function public.puede_subir_foto_trabajo(p_solicitud text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1
    from public.solicitudes s
    join public.asignaciones a
      on (a.solicitud_id = s.id or a.solicitud_fabrica_id = s.solicitud_fabrica_id)
    where s.id::text = p_solicitud
      and a.usuario_id = auth.uid()
      and s.estado not in ('FINALIZADO', 'PENDIENTE_PRECIO', 'PRESUPUESTADO')
  );
$$;

revoke all on function public.puede_subir_foto_trabajo(text) from public, anon;
grant execute on function public.puede_subir_foto_trabajo(text) to authenticated;

drop policy if exists fotos_trabajos_subir on storage.objects;
create policy fotos_trabajos_subir on storage.objects
  for insert to authenticated with check (
    bucket_id = 'fotos-trabajos'
    and public.get_my_role() in ('TECNICO', 'FABRICA')
    and (storage.foldername(name))[1] = 'solicitudes'
    and public.puede_subir_foto_trabajo((storage.foldername(name))[2])
  );

commit;
