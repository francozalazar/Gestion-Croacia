-- ============================================================
-- Seguridad por rol (RLS) para solicitudes y tablas vinculadas.
-- Reemplaza la politica "Permitir todo" de solicitudes.
--
-- Reglas nuevas:
--   * Admin, Oficina y Coordinacion: ven y tocan todo.
--   * Tecnico y Fabrica: solo sus trabajos asignados.
--   * Visitas finalizadas: solo admin/oficina/coordinacion
--     (tecnico y fabrica NO ven trabajos de otros).
--   * Borrar solicitudes: solo Admin y Coordinacion.
--
-- Ejecutar en Supabase > SQL Editor, TODO el archivo de una vez.
-- Si alguna linea da error, sacar captura y avisar.
-- ============================================================

-- 0) Funcion auxiliar: rol del usuario logueado.
create or replace function public.mi_rol()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select rol from profiles where id = auth.uid()
$$;

-- 1) solicitudes: borrar las politicas actuales (incluida "Permitir todo")
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'solicitudes'
  loop
    execute format('drop policy %I on public.solicitudes', p.policyname);
  end loop;
end $$;

alter table public.solicitudes enable row level security;

-- Lectura: admin/oficina/coordinacion todo (incluye la
-- seccion Visitas finalizadas); tecnico/fabrica solo asignados.
create policy "solicitudes_select" on public.solicitudes
for select to authenticated
using (
  public.mi_rol() in ('ADMIN', 'OFICINA', 'COORDINACION')
  or exists (
    select 1 from public.asignaciones a
    where a.usuario_id = auth.uid()
      and (a.solicitud_id = solicitudes.id
        or a.solicitud_fabrica_id = solicitudes.solicitud_fabrica_id)
  )
);

-- Alta: solo admin/oficina/coordinacion.
create policy "solicitudes_insert" on public.solicitudes
for insert to authenticated
with check (public.mi_rol() in ('ADMIN', 'OFICINA', 'COORDINACION'));

-- Cambios: admin/oficina/coordinacion todo;
-- tecnico/fabrica solo sus trabajos asignados.
create policy "solicitudes_update" on public.solicitudes
for update to authenticated
using (
  public.mi_rol() in ('ADMIN', 'OFICINA', 'COORDINACION')
  or exists (
    select 1 from public.asignaciones a
    where a.usuario_id = auth.uid()
      and (a.solicitud_id = solicitudes.id
        or a.solicitud_fabrica_id = solicitudes.solicitud_fabrica_id)
  )
)
with check (
  public.mi_rol() in ('ADMIN', 'OFICINA', 'COORDINACION')
  or exists (
    select 1 from public.asignaciones a
    where a.usuario_id = auth.uid()
      and (a.solicitud_id = solicitudes.id
        or a.solicitud_fabrica_id = solicitudes.solicitud_fabrica_id)
  )
);

-- Borrado: solo admin y coordinacion.
create policy "solicitudes_delete" on public.solicitudes
for delete to authenticated
using (public.mi_rol() in ('ADMIN', 'COORDINACION'));

-- 2) asignaciones
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'asignaciones'
  loop
    execute format('drop policy %I on public.asignaciones', p.policyname);
  end loop;
end $$;

alter table public.asignaciones enable row level security;

-- Lectura: cada uno ve sus asignaciones;
-- admin/oficina/coordinacion las ven todas.
create policy "asignaciones_select" on public.asignaciones
for select to authenticated
using (
  usuario_id = auth.uid()
  or public.mi_rol() in ('ADMIN', 'OFICINA', 'COORDINACION')
);

-- Alta, cambios y borrado: admin/oficina/coordinacion.
create policy "asignaciones_insert" on public.asignaciones
for insert to authenticated
with check (public.mi_rol() in ('ADMIN', 'OFICINA', 'COORDINACION'));

create policy "asignaciones_update" on public.asignaciones
for update to authenticated
using (public.mi_rol() in ('ADMIN', 'OFICINA', 'COORDINACION'))
with check (public.mi_rol() in ('ADMIN', 'OFICINA', 'COORDINACION'));

create policy "asignaciones_delete" on public.asignaciones
for delete to authenticated
using (public.mi_rol() in ('ADMIN', 'OFICINA', 'COORDINACION'));

-- 3) solicitudes_fabrica (remitos de fabrica)
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'solicitudes_fabrica'
  loop
    execute format('drop policy %I on public.solicitudes_fabrica', p.policyname);
  end loop;
end $$;

alter table public.solicitudes_fabrica enable row level security;

-- Lectura: admin/oficina/coordinacion y fabrica ven todo;
-- tecnico solo los remitos que tiene asignados.
create policy "solicitudes_fabrica_select" on public.solicitudes_fabrica
for select to authenticated
using (
  public.mi_rol() in ('ADMIN', 'OFICINA', 'COORDINACION', 'FABRICA')
  or exists (
    select 1 from public.asignaciones a
    where a.usuario_id = auth.uid()
      and a.solicitud_fabrica_id = solicitudes_fabrica.id
  )
);

-- Alta: admin/oficina/coordinacion.
create policy "solicitudes_fabrica_insert" on public.solicitudes_fabrica
for insert to authenticated
with check (public.mi_rol() in ('ADMIN', 'OFICINA', 'COORDINACION'));

-- Cambios: admin/oficina/coordinacion y fabrica;
-- tecnico solo remitos asignados (cuando finaliza trabajo de fabrica).
create policy "solicitudes_fabrica_update" on public.solicitudes_fabrica
for update to authenticated
using (
  public.mi_rol() in ('ADMIN', 'OFICINA', 'COORDINACION', 'FABRICA')
  or exists (
    select 1 from public.asignaciones a
    where a.usuario_id = auth.uid()
      and a.solicitud_fabrica_id = solicitudes_fabrica.id
  )
)
with check (
  public.mi_rol() in ('ADMIN', 'OFICINA', 'COORDINACION', 'FABRICA')
  or exists (
    select 1 from public.asignaciones a
    where a.usuario_id = auth.uid()
      and a.solicitud_fabrica_id = solicitudes_fabrica.id
  )
);

-- Borrado: solo admin y coordinacion.
create policy "solicitudes_fabrica_delete" on public.solicitudes_fabrica
for delete to authenticated
using (public.mi_rol() in ('ADMIN', 'COORDINACION'));
