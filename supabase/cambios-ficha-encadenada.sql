-- ============================================================
-- FICHA ENCADENADA - columna vertebral del circuito
-- Crea la linea de tiempo automatica de cada trabajo (quien
-- hizo que y cuando) y columnas nuevas de presupuesto y medidas.
-- Correr en Supabase > SQL Editor, TODO el archivo de una vez.
-- Es seguro correrlo mas de una vez (no duplica ni rompe nada).
-- ============================================================

-- 1) Columnas nuevas en solicitudes (visitas / reparaciones)
alter table public.solicitudes
  add column if not exists presupuesto_fecha timestamptz;

alter table public.solicitudes
  add column if not exists presupuesto_vigencia_dias integer not null default 15;

alter table public.solicitudes
  add column if not exists medidas text;

-- 2) Linea de tiempo del trabajo
create table if not exists public.trabajo_eventos (
  id bigint generated always as identity primary key,
  solicitud_id bigint references public.solicitudes(id) on delete cascade,
  solicitud_fabrica_id bigint references public.solicitudes_fabrica(id) on delete cascade,
  venta_id bigint references public.ventas(id) on delete cascade,
  etapa text not null,
  detalle text,
  responsable uuid,
  created_at timestamptz not null default now()
);

alter table public.trabajo_eventos enable row level security;

drop policy if exists "trabajo_eventos_select" on public.trabajo_eventos;
create policy "trabajo_eventos_select" on public.trabajo_eventos
  for select to authenticated using (true);

drop policy if exists "trabajo_eventos_insert" on public.trabajo_eventos;
create policy "trabajo_eventos_insert" on public.trabajo_eventos
  for insert to authenticated with check (true);

-- 3) Funcion que registra cada paso del circuito automaticamente
create or replace function public.registrar_evento_trabajo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etapa text;
  v_detalle text;
  v_venta record;
begin
  -- VISITAS / REPARACIONES (tabla solicitudes)
  if tg_table_name = 'solicitudes' then
    if tg_op = 'INSERT' then
      if new.solicitud_fabrica_id is not null then
        v_etapa := 'Trabajo vinculado al remito';
      else
        v_etapa := 'Visita cargada';
      end if;
      v_detalle := coalesce(new.tipo_visita, 'Visita');
    elsif new.estado is distinct from old.estado then
      v_etapa := case new.estado
        when 'PENDIENTE_PRECIO' then 'Trabajo hecho - pendiente de precio'
        when 'PRESUPUESTADO' then 'Precio asignado'
        when 'ENVIADO_COORDINACION' then 'Enviado a coordinacion'
        when 'PENDIENTE_COORDINACION' then 'Pendiente de coordinacion'
        when 'COORDINACION' then 'En coordinacion'
        when 'ASIGNADO' then 'Asignado a tecnico'
        when 'ASIGNADO_FABRICA' then 'Asignado a tecnico (instalacion)'
        when 'EN_PROCESO' then 'En proceso'
        when 'LISTO_PARA_COLOCAR' then 'Listo para colocar'
        when 'FINALIZADO' then 'Trabajo finalizado'
        when 'CANCELADO' then 'Cancelado'
        else replace(new.estado, '_', ' ')
      end;
      v_detalle := null;
      if new.estado = 'PRESUPUESTADO' then
        v_detalle := 'Monto: $' || coalesce(new.subtotal::text, new.precio::text, '0');
      end if;
    else
      return new;
    end if;

    insert into public.trabajo_eventos
      (solicitud_id, solicitud_fabrica_id, etapa, detalle, responsable)
    values
      (new.id, new.solicitud_fabrica_id, v_etapa, v_detalle, auth.uid());
    return new;
  end if;

  -- REMITOS DE FABRICA (tabla solicitudes_fabrica)
  if tg_table_name = 'solicitudes_fabrica' then
    if tg_op = 'INSERT' then
      v_etapa := 'Cargado para aprobacion';
      v_detalle := 'Remito #' || coalesce(new.numero_remito::text, new.id::text);
    elsif new.estado is distinct from old.estado then
      v_etapa := case new.estado
        when 'ENVIADO_A_CORTAR' then 'Aprobado - enviado a cortar'
        when 'EN_CORTE' then 'En corte'
        when 'EN_FABRICACION' then 'En fabricacion'
        when 'EN_FABRICA' then 'En fabrica'
        when 'FALTANTES' then 'Faltantes'
        when 'LISTO_PARA_COLOCAR' then 'Listo para colocar'
        when 'ENVIADO_COORDINACION' then 'Enviado a coordinacion'
        when 'PENDIENTE_COORDINACION' then 'Pendiente de coordinacion'
        when 'COORDINACION' then 'En coordinacion'
        when 'ASIGNADO' then 'Asignado a tecnico (instalacion)'
        when 'FINALIZADO' then 'Trabajo finalizado'
        when 'ANULADO' then 'Anulado'
        else replace(new.estado, '_', ' ')
      end;
      v_detalle := null;
    else
      return new;
    end if;

    insert into public.trabajo_eventos
      (solicitud_fabrica_id, etapa, detalle, responsable)
    values
      (new.id, v_etapa, v_detalle, auth.uid());
    return new;
  end if;

  -- VENTAS (aceptacion del cliente)
  if tg_table_name = 'ventas' then
    insert into public.trabajo_eventos
      (solicitud_id, solicitud_fabrica_id, venta_id, etapa, detalle, responsable)
    values
      (new.solicitud_id, new.solicitud_fabrica_id, new.id,
       'Venta registrada', 'Total: $' || coalesce(new.total::text, '0'), auth.uid());
    return new;
  end if;

  -- PAGOS (senas, cuotas, saldos)
  if tg_table_name = 'pagos' then
    select * into v_venta from public.ventas where id = new.venta_id;
    insert into public.trabajo_eventos
      (solicitud_id, solicitud_fabrica_id, venta_id, etapa, detalle, responsable)
    values
      (v_venta.solicitud_id, v_venta.solicitud_fabrica_id, new.venta_id,
       'Pago registrado',
       '$' || new.monto::text || coalesce(' - ' || new.medio, ''),
       coalesce(new.creado_por, auth.uid()));
    return new;
  end if;

  return new;
end $$;

-- 4) Triggers (se crean solo si no existen)
drop trigger if exists trg_eventos_solicitudes on public.solicitudes;
create trigger trg_eventos_solicitudes
  after insert or update of estado on public.solicitudes
  for each row execute function public.registrar_evento_trabajo();

drop trigger if exists trg_eventos_fabrica on public.solicitudes_fabrica;
create trigger trg_eventos_fabrica
  after insert or update of estado on public.solicitudes_fabrica
  for each row execute function public.registrar_evento_trabajo();

drop trigger if exists trg_eventos_ventas on public.ventas;
create trigger trg_eventos_ventas
  after insert on public.ventas
  for each row execute function public.registrar_evento_trabajo();

drop trigger if exists trg_eventos_pagos on public.pagos;
create trigger trg_eventos_pagos
  after insert on public.pagos
  for each row execute function public.registrar_evento_trabajo();

-- 5) Carga inicial: los trabajos viejos arrancan la linea de tiempo
--    con su fecha de carga (solo si no tienen ningun evento todavia)
insert into public.trabajo_eventos
  (solicitud_id, solicitud_fabrica_id, etapa, detalle, responsable, created_at)
select s.id, s.solicitud_fabrica_id,
       case when s.solicitud_fabrica_id is not null
            then 'Trabajo vinculado al remito'
            else 'Visita cargada' end,
       coalesce(s.tipo_visita, 'Visita'),
       s.creado_por, s.created_at
from public.solicitudes s
where not exists (
  select 1 from public.trabajo_eventos e where e.solicitud_id = s.id
);

insert into public.trabajo_eventos
  (solicitud_fabrica_id, etapa, detalle, responsable, created_at)
select sf.id, 'Cargado para aprobacion',
       'Remito #' || coalesce(sf.numero_remito::text, sf.id::text),
       sf.creado_por, sf.created_at
from public.solicitudes_fabrica sf
where not exists (
  select 1 from public.trabajo_eventos e where e.solicitud_fabrica_id = sf.id
);

insert into public.trabajo_eventos
  (solicitud_id, solicitud_fabrica_id, venta_id, etapa, detalle, responsable, created_at)
select v.solicitud_id, v.solicitud_fabrica_id, v.id,
       'Venta registrada', 'Total: $' || coalesce(v.total::text, '0'),
       v.creado_por, v.created_at
from public.ventas v
where not exists (
  select 1 from public.trabajo_eventos e where e.venta_id = v.id and e.etapa = 'Venta registrada'
);

insert into public.trabajo_eventos
  (solicitud_id, solicitud_fabrica_id, venta_id, etapa, detalle, responsable, created_at)
select v.solicitud_id, v.solicitud_fabrica_id, p.venta_id,
       'Pago registrado',
       '$' || p.monto::text || coalesce(' - ' || p.medio, ''),
       p.creado_por, p.created_at
from public.pagos p
join public.ventas v on v.id = p.venta_id
where not exists (
  select 1 from public.trabajo_eventos e
  where e.venta_id = p.venta_id and e.etapa = 'Pago registrado'
    and e.detalle = '$' || p.monto::text || coalesce(' - ' || p.medio, '')
);
