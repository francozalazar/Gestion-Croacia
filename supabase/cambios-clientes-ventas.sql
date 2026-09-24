-- ============================================================
-- CLIENTES + DIRECCIONES + VENTAS + PAGOS + FACTURAS
-- Correr en Supabase > SQL Editor ("without" si pregunta)
-- ============================================================

-- 1) Clientes: quién lo cargó (los viejos quedan sin dueño = los ven todos)
alter table public.clientes
  add column if not exists creado_por uuid;

-- 2) Direcciones de cada cliente (obras / locales)
create table if not exists public.direcciones (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes(id) on delete cascade,
  direccion text not null,
  localidad text,
  created_at timestamptz not null default now()
);

alter table public.direcciones enable row level security;

create policy "direcciones_select_logueados" on public.direcciones
  for select to authenticated using (true);

create policy "direcciones_insert_logueados" on public.direcciones
  for insert to authenticated with check (true);

-- 3) Migración: cada cliente que tenía dirección pasa a tener una ficha de dirección
insert into public.direcciones (cliente_id, direccion, localidad)
select c.id, c.direccion, c.localidad
from public.clientes c
where c.direccion is not null
  and btrim(c.direccion) <> ''
  and not exists (
    select 1 from public.direcciones d where d.cliente_id = c.id
  );

-- 4) Remitos de fábrica: vínculo al cliente
alter table public.solicitudes_fabrica
  add column if not exists cliente_id bigint references public.clientes(id);

-- 4b) Vincular los remitos viejos por nombre (cuando coincide exacto)
update public.solicitudes_fabrica sf
set cliente_id = c.id
from public.clientes c
where sf.cliente_id is null
  and lower(btrim(c.nombre)) = lower(btrim(sf.cliente_nombre));

-- 5) Ventas (cada trabajo vendido: cortina nueva o reparación aceptada)
create table if not exists public.ventas (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes(id),
  direccion_id bigint references public.direcciones(id),
  descripcion text,
  total numeric(12,2) not null default 0,
  solicitud_id bigint references public.solicitudes(id),
  solicitud_fabrica_id bigint references public.solicitudes_fabrica(id),
  creado_por uuid,
  created_at timestamptz not null default now()
);

alter table public.ventas enable row level security;

-- Ver ventas: el admin todas; cada quien las suyas; y las de clientes viejos (sin dueño) las ven todos
create policy "ventas_select" on public.ventas
  for select to authenticated using (
    creado_por = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and upper(p.rol) = 'ADMIN'
    )
    or exists (
      select 1 from public.clientes c
      where c.id = ventas.cliente_id and c.creado_por is null
    )
  );

create policy "ventas_insert" on public.ventas
  for insert to authenticated with check (true);

create policy "ventas_update" on public.ventas
  for update to authenticated using (
    creado_por = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and upper(p.rol) = 'ADMIN'
    )
  );

-- 6) Pagos de cada venta (con factura opcional en PDF)
create table if not exists public.pagos (
  id bigint generated always as identity primary key,
  venta_id bigint not null references public.ventas(id) on delete cascade,
  monto numeric(12,2) not null,
  fecha date not null default current_date,
  medio text,
  facturado boolean not null default false,
  factura_url text,
  creado_por uuid,
  created_at timestamptz not null default now()
);

alter table public.pagos enable row level security;

create policy "pagos_select" on public.pagos
  for select to authenticated using (
    creado_por = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and upper(p.rol) = 'ADMIN'
    )
    or exists (
      select 1 from public.ventas v
      join public.clientes c on c.id = v.cliente_id
      where v.id = pagos.venta_id and c.creado_por is null
    )
    or exists (
      select 1 from public.ventas v2
      where v2.id = pagos.venta_id and v2.creado_por = auth.uid()
    )
  );

create policy "pagos_insert" on public.pagos
  for insert to authenticated with check (true);

-- 7) Espacio para los PDF de facturas (privado, solo usuarios logueados)
insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

create policy "facturas_insert_logueados" on storage.objects
  for insert to authenticated with check (bucket_id = 'facturas');

create policy "facturas_select_logueados" on storage.objects
  for select to authenticated using (bucket_id = 'facturas');
