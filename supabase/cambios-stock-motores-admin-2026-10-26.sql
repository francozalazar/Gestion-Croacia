-- Stock de motores cargado por Admin desde los trabajos de cada tecnico (26/10/2026).
-- Sin datos ni secretos. Requiere cambios-stock-motores-2026-10-23.sql ya aplicado.
-- Pedido de Franco (WhatsApp 26/10): Admin elige tecnico (chofer = tecnico) y dia, ve TODOS sus
-- trabajos asignados, abre uno y carga modelo + cantidad (puede ser 1 paralelo y 1 tubular).
-- "Ultimos movimientos" muestra tecnico, trabajo, cantidad y modelo.
--
-- Que hace:
--  * stock_movimientos: agrega solicitud_id (visitas/reparaciones), tecnico_id y operacion_id.
--    No modifica filas existentes (quedan sin tecnico; la pantalla lo toma de la asignacion).
--  * stock_operaciones: una fila por ENVIO del formulario (id generado en la pantalla). Evita
--    descontar dos veces si se toca dos veces el boton o se reintenta el mismo envio, pero
--    NO impide cargar motores adicionales despues en el mismo trabajo (otro envio, otro id).
--  * stock_cargar_motores_trabajo(...): solo ADMIN. Valida que el trabajo este asignado a ese
--    tecnico, junta lineas repetidas del mismo modelo y registra las SALIDAS en una transaccion
--    (el trigger actual impide stock negativo; si falla una linea no cambia nada).
-- No toca stock_consumos_pedido ni las salidas ya registradas ni el envio a Listos de Fabrica.

alter table public.stock_movimientos
  add column if not exists solicitud_id bigint references public.solicitudes(id) on delete set null,
  add column if not exists tecnico_id uuid references public.profiles(id) on delete set null,
  add column if not exists operacion_id uuid;

create table if not exists public.stock_operaciones (
  id uuid primary key,
  creado_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.stock_operaciones enable row level security;
revoke all on public.stock_operaciones from anon, authenticated;
-- Sin grants ni policies: solo escribe la funcion de abajo.

create or replace function public.stock_cargar_motores_trabajo(
  p_operacion uuid, p_tecnico uuid, p_solicitud bigint, p_pedido bigint, p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb; v_motor bigint; v_cant integer; v_sumas jsonb := '{}'::jsonb; v_key text;
  v_filas integer; v_etiqueta text;
begin
  if coalesce(public.get_my_role(), '') <> 'ADMIN' then
    raise exception 'Solo Administración carga motores por trabajo.' using errcode = '42501';
  end if;
  if p_operacion is null or p_tecnico is null then
    raise exception 'Faltan datos del envío.' using errcode = 'P0001';
  end if;
  if (p_solicitud is null) = (p_pedido is null) then
    raise exception 'Indicá un trabajo (visita o pedido de fábrica).' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.asignaciones a
    where a.usuario_id = p_tecnico
      and ((p_solicitud is not null and a.solicitud_id = p_solicitud)
        or (p_pedido is not null and a.solicitud_fabrica_id = p_pedido))
  ) then
    raise exception 'Ese trabajo no está asignado a ese técnico.' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_motor := (v_item->>'motor_id')::bigint;
    v_cant := (v_item->>'cantidad')::integer;
    if v_motor is null or v_cant is null or v_cant <= 0 then
      raise exception 'Cada motor necesita modelo y una cantidad entera mayor a 0.' using errcode = 'P0001';
    end if;
    v_key := v_motor::text;
    v_sumas := jsonb_set(v_sumas, array[v_key], to_jsonb(coalesce((v_sumas->>v_key)::integer, 0) + v_cant));
  end loop;
  if v_sumas = '{}'::jsonb then
    raise exception 'Cargá al menos un modelo con su cantidad.' using errcode = 'P0001';
  end if;

  -- Bloquea el trabajo para que dos envios simultaneos no se pisen.
  if p_pedido is not null then
    perform 1 from public.solicitudes_fabrica where id = p_pedido for update;
    if not found then raise exception 'No se encontró el pedido.' using errcode = 'P0001'; end if;
  else
    perform 1 from public.solicitudes where id = p_solicitud for update;
    if not found then raise exception 'No se encontró el trabajo.' using errcode = 'P0001'; end if;
  end if;

  insert into public.stock_operaciones (id) values (p_operacion) on conflict (id) do nothing;
  get diagnostics v_filas = row_count;  -- 1 si es nuevo
  if v_filas = 0 then
    return jsonb_build_object('ok', true, 'ya_aplicado', true);
  end if;

  v_etiqueta := 'Trabajo #' || coalesce(p_pedido, p_solicitud) || ' - cargado por Admin';
  for v_key in select jsonb_object_keys(v_sumas) loop
    insert into public.stock_movimientos
      (motor_id, tipo, cantidad, detalle, solicitud_fabrica_id, solicitud_id, tecnico_id, operacion_id)
    values (v_key::bigint, 'SALIDA', (v_sumas->>v_key)::integer, v_etiqueta,
            p_pedido, p_solicitud, p_tecnico, p_operacion);
  end loop;
  return jsonb_build_object('ok', true, 'ya_aplicado', false);
end $$;

revoke all on function public.stock_cargar_motores_trabajo(uuid, uuid, bigint, bigint, jsonb) from public, anon;
grant execute on function public.stock_cargar_motores_trabajo(uuid, uuid, bigint, bigint, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------
-- Fabrica ya no ve ni toca el stock (pedido de Franco 26/10: "en fabrica no tiene q aparecer mas").
-- Efecto real en la base, no solo en el menu: lectura/escritura de stock solo ADMIN, y se quita la
-- pregunta de motores al enviar a Listos (el paso a Listos vuelve a ser solo cambio de estado).
-- Los registros existentes (stock_motores, stock_movimientos, stock_consumos_pedido) se conservan.
drop policy if exists "stock_motores_select" on public.stock_motores;
create policy "stock_motores_select" on public.stock_motores for select to authenticated
  using (public.get_my_role() = 'ADMIN');
drop policy if exists "stock_motores_insert" on public.stock_motores;
create policy "stock_motores_insert" on public.stock_motores for insert to authenticated
  with check (public.get_my_role() = 'ADMIN');
drop policy if exists "stock_motores_update" on public.stock_motores;
create policy "stock_motores_update" on public.stock_motores for update to authenticated
  using (public.get_my_role() = 'ADMIN') with check (public.get_my_role() = 'ADMIN');
drop policy if exists "stock_mov_select" on public.stock_movimientos;
create policy "stock_mov_select" on public.stock_movimientos for select to authenticated
  using (public.get_my_role() = 'ADMIN');
drop policy if exists "stock_mov_insert" on public.stock_movimientos;
create policy "stock_mov_insert" on public.stock_movimientos for insert to authenticated
  with check (public.get_my_role() = 'ADMIN');
do $$ begin
  if to_regclass('public.stock_consumos_pedido') is not null then
    drop policy if exists "stock_consumos_select" on public.stock_consumos_pedido;
    create policy "stock_consumos_select" on public.stock_consumos_pedido for select to authenticated
      using (public.get_my_role() = 'ADMIN');
  end if;
end $$;
drop function if exists public.enviar_a_listos_con_motores(bigint, jsonb);

-- REVERTIR (no borra movimientos ya cargados):
-- (Para devolver stock a Fabrica: recrear las policies con role in ('ADMIN','FABRICA') del archivo 2026-10-23.)
-- drop function if exists public.stock_cargar_motores_trabajo(uuid, uuid, bigint, bigint, jsonb);
-- drop table if exists public.stock_operaciones;
-- alter table public.stock_movimientos drop column if exists operacion_id, drop column if exists tecnico_id, drop column if exists solicitud_id;
