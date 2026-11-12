-- Campanita: guarda hasta cuándo leyó cada usuario sus notificaciones, para que
-- el punto rojo sea el mismo en celular y computadora.
-- Solo crea una tabla chica. No toca trabajos, pagos, stock ni otras tablas.
begin;
create table if not exists public.campana_lecturas (
  usuario_id uuid primary key references public.profiles(id) on delete cascade,
  visto_hasta timestamptz not null default now()
);
alter table public.campana_lecturas enable row level security;
revoke all on public.campana_lecturas from public, anon;
grant select, insert, update on public.campana_lecturas to authenticated;
drop policy if exists campana_lecturas_ver on public.campana_lecturas;
create policy campana_lecturas_ver on public.campana_lecturas
  for select to authenticated using (usuario_id = auth.uid());
drop policy if exists campana_lecturas_crear on public.campana_lecturas;
create policy campana_lecturas_crear on public.campana_lecturas
  for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists campana_lecturas_cambiar on public.campana_lecturas;
create policy campana_lecturas_cambiar on public.campana_lecturas
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
commit;
