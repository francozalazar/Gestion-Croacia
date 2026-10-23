-- 2026-10-23 - Tecnico y Fabrica: solo lo de sus trabajos asignados.
-- Pedido de Franco (WhatsApp 23/10): "solo tienen q ver sus trabajos asignados
-- fabrica y tecnicos, nada de historial ni nada".
--
-- Que cambia (y por que no corta el trabajo diario):
--  * direcciones: hoy CUALQUIER usuario logueado puede ver e insertar direcciones
--    de todos los clientes. Pasa a ADMIN/OFICINA/COORDINACION. Las pantallas de
--    tecnico y fabrica no consultan esta tabla: la direccion del trabajo les
--    llega en la propia solicitud.
--  * trabajo_eventos (historial de la ficha): hoy cualquier logueado lee TODO el
--    historial y podria insertar eventos falsos. Lectura pasa a
--    ADMIN/OFICINA/COORDINACION y se cierra el alta directa: los eventos los
--    escriben los triggers de la base (solicitudes, solicitudes_fabrica, ventas,
--    pagos), que siguen funcionando igual.
--  * facturas (PDF): hoy cualquier logueado puede listar, descargar y subir
--    facturas. Pasa a ADMIN/OFICINA/COORDINACION. La pantalla de facturas la usan
--    las vendedoras y admin.
--  * stock_motores / stock_movimientos: la base les dio a TODOS los logueados
--    permisos de tabla que la RLS no cubre (TRUNCATE la saltea: podria vaciarse
--    el historial de movimientos sin que la RLS lo frene). Se revocan
--    TRUNCATE/REFERENCES/TRIGGER/DELETE. Ver/cargar/editar stock sigue igual,
--    porque pasa por las policies ADMIN/FABRICA ya probadas.
--
-- NO se toca: clientes (ya limitada a clientes de trabajos asignados), la cola
-- de produccion de fabrica, ni ningun dato.
-- Idempotente: se puede correr mas de una vez sin error.
begin;

-- 1) direcciones
drop policy if exists direcciones_select_logueados on public.direcciones;
drop policy if exists direcciones_select_roles on public.direcciones;
create policy direcciones_select_roles on public.direcciones for select to authenticated
  using (public.get_my_role() in ('ADMIN','OFICINA','COORDINACION'));
drop policy if exists direcciones_insert_logueados on public.direcciones;
drop policy if exists direcciones_insert_roles on public.direcciones;
create policy direcciones_insert_roles on public.direcciones for insert to authenticated
  with check (public.get_my_role() in ('ADMIN','OFICINA','COORDINACION'));

-- 2) trabajo_eventos (historial)
drop policy if exists trabajo_eventos_select on public.trabajo_eventos;
drop policy if exists trabajo_eventos_select_roles on public.trabajo_eventos;
create policy trabajo_eventos_select_roles on public.trabajo_eventos for select to authenticated
  using (public.get_my_role() in ('ADMIN','OFICINA','COORDINACION'));
drop policy if exists trabajo_eventos_insert on public.trabajo_eventos;
-- Sin nueva policy de insert: los eventos los escriben los triggers (definer).

-- 3) facturas (storage)
drop policy if exists facturas_select_logueados on storage.objects;
drop policy if exists facturas_select_roles on storage.objects;
create policy facturas_select_roles on storage.objects for select to authenticated
  using (bucket_id = 'facturas' and public.get_my_role() in ('ADMIN','OFICINA','COORDINACION'));
drop policy if exists facturas_insert_logueados on storage.objects;
drop policy if exists facturas_insert_roles on storage.objects;
create policy facturas_insert_roles on storage.objects for insert to authenticated
  with check (bucket_id = 'facturas' and public.get_my_role() in ('ADMIN','OFICINA','COORDINACION'));

-- 4) grants de tabla peligrosos en stock (la RLS no cubre TRUNCATE)
revoke truncate, references, trigger, delete on public.stock_motores from authenticated;
revoke truncate, references, trigger, delete on public.stock_movimientos from authenticated;

commit;

-- REVERTIR (vuelve todo al estado anterior; tambien idempotente):
-- drop policy if exists direcciones_select_roles on public.direcciones;
-- drop policy if exists direcciones_select_logueados on public.direcciones;
-- create policy direcciones_select_logueados on public.direcciones for select to authenticated using (true);
-- drop policy if exists direcciones_insert_roles on public.direcciones;
-- drop policy if exists direcciones_insert_logueados on public.direcciones;
-- create policy direcciones_insert_logueados on public.direcciones for insert to authenticated with check (true);
-- drop policy if exists trabajo_eventos_select_roles on public.trabajo_eventos;
-- drop policy if exists trabajo_eventos_select on public.trabajo_eventos;
-- create policy trabajo_eventos_select on public.trabajo_eventos for select to authenticated using (true);
-- drop policy if exists trabajo_eventos_insert on public.trabajo_eventos;
-- create policy trabajo_eventos_insert on public.trabajo_eventos for insert to authenticated with check (true);
-- drop policy if exists facturas_select_roles on storage.objects;
-- drop policy if exists facturas_select_logueados on storage.objects;
-- create policy facturas_select_logueados on storage.objects for select to authenticated using (bucket_id='facturas');
-- drop policy if exists facturas_insert_roles on storage.objects;
-- drop policy if exists facturas_insert_logueados on storage.objects;
-- create policy facturas_insert_logueados on storage.objects for insert to authenticated with check (bucket_id='facturas');
-- grant truncate, references, trigger, delete on public.stock_motores to authenticated;
-- grant truncate, references, trigger, delete on public.stock_movimientos to authenticated;
