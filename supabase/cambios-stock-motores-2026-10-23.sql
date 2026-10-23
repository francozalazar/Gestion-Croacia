-- Stock de motores v1 (23/10/2026). Sin datos ni secretos.
-- Pedido de Franco (WhatsApp 23/10): arrancar SOLO con motores, cada modelo contado por
-- separado en unidades; carga inicial, sumar cuando llegan, descontar cuando se usa uno
-- en un trabajo; Admin ve cuantos quedan y cuales estan por agotarse. Lamas/cortinas afuera.
-- Los numeros que menciono (10 de 600, 5 de 800) eran ejemplos: este SQL NO carga stock.
--
-- Que crea:
--  * stock_motores: una fila por modelo (nombre unico), cantidad actual y minimo para el
--    aviso "por agotarse" (cantidad <= minimo).
--  * stock_movimientos: registro inmutable de INICIAL / ENTRADA / SALIDA con quien lo cargo,
--    detalle y vinculo opcional al pedido de fabrica en que se uso.
-- Reglas:
--  * Solo roles ADMIN y FABRICA (RLS). Sin acceso anonimo.
--  * La cantidad NO se edita a mano: solo cambia por movimientos (trigger), asi el registro
--    siempre coincide con el stock y una salida no puede dejar stock negativo.
--  * Sin updates ni deletes en movimientos: un error se corrige con un movimiento inverso.
--  * Sin delete de modelos por ahora (no se pierde historial).

create table if not exists public.stock_motores (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  cantidad integer not null default 0 check (cantidad >= 0),
  minimo integer not null default 0 check (minimo >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.stock_movimientos (
  id bigint generated always as identity primary key,
  motor_id bigint not null references public.stock_motores(id),
  tipo text not null check (tipo in ('INICIAL','ENTRADA','SALIDA')),
  cantidad integer not null check (cantidad > 0),
  detalle text,
  solicitud_fabrica_id bigint references public.solicitudes_fabrica(id) on delete set null,
  creado_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- La cantidad del motor solo la toca esta funcion, una vez por movimiento.
create or replace function public.stock_aplicar_movimiento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('stock.en_movimiento', '1', true);
  if new.tipo in ('INICIAL','ENTRADA') then
    update public.stock_motores set cantidad = cantidad + new.cantidad where id = new.motor_id;
  else
    update public.stock_motores set cantidad = cantidad - new.cantidad
      where id = new.motor_id and cantidad >= new.cantidad;
    if not found then
      raise exception 'No hay suficiente stock de ese motor para registrar la salida.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists aa_stock_aplicar_movimiento on public.stock_movimientos;
create trigger aa_stock_aplicar_movimiento before insert on public.stock_movimientos
  for each row execute function public.stock_aplicar_movimiento();

-- Nadie edita la cantidad directamente: solo cambia por movimientos.
create or replace function public.stock_bloquear_cantidad_directa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cantidad is distinct from old.cantidad
     and current_setting('stock.en_movimiento', true) is distinct from '1' then
    raise exception 'El stock solo cambia cargando un movimiento (entrada o salida).' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists aa_stock_bloquear_cantidad on public.stock_motores;
create trigger aa_stock_bloquear_cantidad before update on public.stock_motores
  for each row execute function public.stock_bloquear_cantidad_directa();

alter table public.stock_motores enable row level security;
alter table public.stock_movimientos enable row level security;
revoke all on public.stock_motores from anon;
revoke all on public.stock_movimientos from anon;

drop policy if exists "stock_motores_select" on public.stock_motores;
create policy "stock_motores_select" on public.stock_motores for select to authenticated
  using (public.get_my_role() in ('ADMIN','FABRICA'));
drop policy if exists "stock_motores_insert" on public.stock_motores;
create policy "stock_motores_insert" on public.stock_motores for insert to authenticated
  with check (public.get_my_role() in ('ADMIN','FABRICA'));
drop policy if exists "stock_motores_update" on public.stock_motores;
create policy "stock_motores_update" on public.stock_motores for update to authenticated
  using (public.get_my_role() in ('ADMIN','FABRICA'))
  with check (public.get_my_role() in ('ADMIN','FABRICA'));

drop policy if exists "stock_mov_select" on public.stock_movimientos;
create policy "stock_mov_select" on public.stock_movimientos for select to authenticated
  using (public.get_my_role() in ('ADMIN','FABRICA'));
drop policy if exists "stock_mov_insert" on public.stock_movimientos;
create policy "stock_mov_insert" on public.stock_movimientos for insert to authenticated
  with check (public.get_my_role() in ('ADMIN','FABRICA'));
-- Sin policy de update/delete en movimientos: el registro es inmutable.
-- Sin policy de delete en stock_motores: no se pierde el historial.

-- PRUEBAS A CORRER AL APLICAR (transaccion con rollback, un usuario por rol):
--  * ADMIN/FABRICA: crean modelo, cargan INICIAL/ENTRADA/SALIDA, ven todo.
--  * SALIDA mayor al stock -> error 'No hay suficiente stock', cantidad sin cambios.
--  * UPDATE directo de cantidad -> error 42501; update de minimo OK.
--  * OFICINA/TECNICO/COORDINACION: no ven ni pueden cargar (0 filas / RLS).
--  * anon: denegado.

-- REVERTIR (borra el stock y su historial; usar solo si se decide abandonar la seccion):
-- drop trigger if exists aa_stock_aplicar_movimiento on public.stock_movimientos;
-- drop trigger if exists aa_stock_bloquear_cantidad on public.stock_motores;
-- drop function if exists public.stock_aplicar_movimiento();
-- drop function if exists public.stock_bloquear_cantidad_directa();
-- drop table if exists public.stock_movimientos;
-- drop table if exists public.stock_motores;
