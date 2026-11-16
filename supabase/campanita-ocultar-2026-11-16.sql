-- Quitar avisos de la campanita solo para el usuario que los descarta.
-- No borra eventos push, trabajos, stock ni notificaciones de otras personas.
begin;
create table if not exists public.campana_ocultas (
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  notificacion_id text not null check (length(notificacion_id) between 1 and 200),
  ocultada_at timestamptz not null default now(),
  primary key (usuario_id, notificacion_id)
);
alter table public.campana_ocultas enable row level security;
revoke all on public.campana_ocultas from public, anon, authenticated;
grant select, insert on public.campana_ocultas to authenticated;
create policy campana_ocultas_ver on public.campana_ocultas
  for select to authenticated using (usuario_id = auth.uid());
create policy campana_ocultas_crear on public.campana_ocultas
  for insert to authenticated with check (usuario_id = auth.uid());
commit;
