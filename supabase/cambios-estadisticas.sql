-- Estadisticas de ventas: que se vende en cada pedido para cortar.
-- Cada renglon: tipo + cantidad. Solo suma datos nuevos; no toca pedidos ni ventas existentes.
create table if not exists public.pedido_items (
  id bigint generated always as identity primary key,
  solicitud_fabrica_id bigint not null references public.solicitudes_fabrica(id) on delete cascade,
  tipo text not null check (tipo in ('CORTINA', 'PORTON_LAMA', 'REPARACION')),
  cantidad integer not null check (cantidad >= 1),
  creado_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists pedido_items_solicitud_idx
  on public.pedido_items (solicitud_fabrica_id);

alter table public.pedido_items enable row level security;

drop policy if exists "pedido_items_select" on public.pedido_items;
create policy "pedido_items_select" on public.pedido_items
  for select to authenticated using (
    public.get_my_role() = 'ADMIN' or creado_por = auth.uid()
  );

drop policy if exists "pedido_items_insert" on public.pedido_items;
create policy "pedido_items_insert" on public.pedido_items
  for insert to authenticated with check (
    public.get_my_role() in ('ADMIN', 'OFICINA', 'COORDINACION')
    and creado_por = auth.uid()
  );

drop policy if exists "pedido_items_update" on public.pedido_items;
create policy "pedido_items_update" on public.pedido_items
  for update to authenticated
  using (public.get_my_role() = 'ADMIN') with check (public.get_my_role() = 'ADMIN');

drop policy if exists "pedido_items_delete" on public.pedido_items;
create policy "pedido_items_delete" on public.pedido_items
  for delete to authenticated using (public.get_my_role() = 'ADMIN');
