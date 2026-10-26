-- Motores usados al enviar a "Listos para colocar" (26/10/2026). Sin datos ni secretos.
-- Pedido de Franco (WhatsApp 26/10): al pasar un trabajo de fabrica a Listos para colocar,
-- preguntar si usaron motor, cual y cuantos, y descontar del stock en el mismo paso.
-- Requiere cambios-stock-motores-2026-10-23.sql ya aplicado.
--
-- Que crea:
--  * stock_consumos_pedido: una fila por pedido de fabrica una vez confirmada la pregunta
--    ("uso_motor" true/false). Es lo que evita descontar dos veces el mismo pedido, aunque
--    se repita el envio, se toque dos veces el boton o el estado cambie por otro lado.
--  * enviar_a_listos_con_motores(pedido, items): en UNA transaccion bloquea el pedido,
--    registra las SALIDAS (con el trigger actual: no deja stock negativo), registra la
--    confirmacion y pasa solicitudes_fabrica y solicitudes a LISTO_PARA_COLOCAR.
--    Si algo falla (ej. stock insuficiente) no cambia nada.
-- No toca salidas ya cargadas a mano ni pedidos ya enviados antes de este cambio.

create table if not exists public.stock_consumos_pedido (
  solicitud_fabrica_id bigint primary key references public.solicitudes_fabrica(id) on delete cascade,
  uso_motor boolean not null,
  confirmado_por uuid default auth.uid(),
  confirmado_at timestamptz not null default now()
);

alter table public.stock_consumos_pedido enable row level security;
revoke all on public.stock_consumos_pedido from anon, authenticated;
grant select on public.stock_consumos_pedido to authenticated;
drop policy if exists "stock_consumos_select" on public.stock_consumos_pedido;
create policy "stock_consumos_select" on public.stock_consumos_pedido for select to authenticated
  using (public.get_my_role() in ('ADMIN','FABRICA'));
-- Sin grants ni policy de escritura: solo escribe la funcion de abajo.

create or replace function public.enviar_a_listos_con_motores(p_pedido bigint, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_estado text;
  v_item jsonb;
  v_motor bigint;
  v_cant integer;
  v_uso boolean;
  v_ya boolean;
  v_sumas jsonb := '{}'::jsonb;
  v_key text;
begin
  if coalesce(public.get_my_role(), '') not in ('ADMIN','FABRICA') then
    raise exception 'Solo Administración y Fábrica pueden enviar a Listos para colocar.' using errcode = '42501';
  end if;

  select estado into v_estado from public.solicitudes_fabrica where id = p_pedido for update;
  if not found then
    raise exception 'No se encontró el pedido.' using errcode = 'P0001';
  end if;
  select exists(select 1 from public.stock_consumos_pedido where solicitud_fabrica_id = p_pedido) into v_ya;

  -- Solo se envia desde produccion. Un reintento tardio de un pedido ya confirmado que
  -- cambio de estado (Listos, coordinado, instalado) no toca nada: no descuenta ni cambia estado.
  if v_estado is null or v_estado not in ('ENVIADO_A_CORTAR','EN_CORTE','EN_FABRICACION','EN_FABRICA','FALTANTES') then
    if v_ya then
      return jsonb_build_object('ok', true, 'ya_confirmado', true, 'sin_cambios', true);
    end if;
    raise exception 'El pedido no está en producción (estado actual: %).', coalesce(v_estado, 'sin estado') using errcode = 'P0001';
  end if;

  -- Junta lineas repetidas del mismo modelo.
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_motor := (v_item->>'motor_id')::bigint;
    v_cant := (v_item->>'cantidad')::integer;
    if v_motor is null or v_cant is null or v_cant <= 0 then
      raise exception 'Cada motor necesita modelo y una cantidad entera mayor a 0.' using errcode = 'P0001';
    end if;
    v_key := v_motor::text;
    v_sumas := jsonb_set(v_sumas, array[v_key], to_jsonb(coalesce((v_sumas->>v_key)::integer, 0) + v_cant));
  end loop;

  v_uso := v_sumas <> '{}'::jsonb
    or exists(select 1 from public.stock_movimientos where solicitud_fabrica_id = p_pedido and tipo = 'SALIDA');

  if not v_ya then
    for v_key in select jsonb_object_keys(v_sumas) loop
      insert into public.stock_movimientos (motor_id, tipo, cantidad, detalle, solicitud_fabrica_id)
      values (v_key::bigint, 'SALIDA', (v_sumas->>v_key)::integer,
              'Trabajo #' || p_pedido || ' - al enviar a Listos para colocar', p_pedido);
    end loop;
    insert into public.stock_consumos_pedido (solicitud_fabrica_id, uso_motor) values (p_pedido, v_uso);
  end if;

  update public.solicitudes_fabrica set estado = 'LISTO_PARA_COLOCAR' where id = p_pedido;
  update public.solicitudes set estado = 'LISTO_PARA_COLOCAR' where solicitud_fabrica_id = p_pedido;

  return jsonb_build_object('ok', true, 'ya_confirmado', v_ya);
end $$;

revoke all on function public.enviar_a_listos_con_motores(bigint, jsonb) from public, anon;
grant execute on function public.enviar_a_listos_con_motores(bigint, jsonb) to authenticated;

-- PRUEBAS A CORRER AL APLICAR (transaccion con rollback):
--  * Sin motor: items [] -> pedido LISTO, consumo uso_motor=false, stock igual.
--  * Con motor: descuenta y deja SALIDA ligada al pedido; llamar de nuevo -> ya_confirmado, no descuenta.
--  * Stock insuficiente -> error, pedido sigue en su estado, sin consumo registrado.
--  * OFICINA/TECNICO/anon -> denegado.

-- REVERTIR (no toca stock_movimientos ya cargados):
-- drop function if exists public.enviar_a_listos_con_motores(bigint, jsonb);
-- drop table if exists public.stock_consumos_pedido;
