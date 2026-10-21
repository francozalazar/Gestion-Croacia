-- Cierre de acceso sin sesion (21/10/2026). Sin datos ni secretos.
-- Estado ANTES (consulta has_table_privilege):
--  * public.solicitudes_fabrica tenia RLS desactivada.
--  * anon tenia SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER en las 12 tablas de public
--    (asignaciones, clientes, direcciones, fotos, pagos, pedido_items, profiles, solicitudes,
--     solicitudes_fabrica, trabajo_eventos, trabajos, ventas).
--  * authenticated tenia SELECT, INSERT, UPDATE, DELETE, TRUNCATE en esas tablas.
--  * Politica "Permitir todo ... authenticated true" en solicitudes y solicitudes_fabrica (sigue; pendiente de acotar por rol).

-- APLICADO:
alter table public.solicitudes_fabrica enable row level security;
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- REVERTIR (solo si algo legitimo dejara de funcionar; no recomendado):
-- alter table public.solicitudes_fabrica disable row level security;
-- grant all on all tables in schema public to anon;
-- grant truncate on all tables in schema public to authenticated;

-- ============================================================
-- APLICADO 14:00-14:13 (solicitudes_fabrica) - ver reversion al final
-- ============================================================
-- RLS activado en solicitudes_fabrica (estaba apagado, anon tenia todos los permisos).
-- Policies: select/update solo roles validos (ADMIN, OFICINA, COORDINACION, FABRICA, TECNICO);
-- insert solo ADMIN/OFICINA/COORDINACION; delete solo ADMIN. Usuarios sin rol valido: sin acceso.
-- Trigger aa_sf_restringir_update: FABRICA y TECNICO solo pueden cambiar la columna "estado".
-- (codigo de la funcion sf_restringir_update en la base; reversion: drop trigger + drop function + policy vieja)
--   drop trigger aa_sf_restringir_update on public.solicitudes_fabrica;
--   drop function public.sf_restringir_update();
--   (la policy original era "Permitir todo ... authenticated true" FOR ALL: NO recomendada restaurarla)
--
-- Pruebas (transaccion con rollback, un usuario real por rol + uuid sin perfil):
--   ADMIN/OFICINA: ven 12, update estado y direccion OK
--   FABRICA/TECNICO: ven 12, update estado OK, update direccion -> error 42501; insert -> RLS; delete 0
--   usuario sin rol: ve 0, update 0 ; anon: denegado
-- Lectura de privilegios posterior (information_schema, 14:17):
--   anon grants en public = 0; authenticated con TRUNCATE/REFERENCES/TRIGGER = 0;
--   PUBLIC grants = 0; tablas sin RLS = ninguna; funciones public ejecutables por anon = 5 (no revisadas una por una).
-- PENDIENTE: tabla solicitudes (visitas) sigue con policy "authenticated true ALL"; profiles legible por logueados.
-- Codigo aplicado:
-- create or replace function public.sf_restringir_update() returns trigger language plpgsql security definer set search_path = public as $$
-- declare r text := public.get_my_role();
-- begin
--   if r in ('ADMIN','OFICINA','COORDINACION') then return new; end if;
--   if r in ('FABRICA','TECNICO') then
--     if (to_jsonb(new) - 'estado') is distinct from (to_jsonb(old) - 'estado') then
--       raise exception 'Este rol solo puede cambiar el estado del pedido' using errcode = '42501';
--     end if;
--     return new;
--   end if;
--   raise exception 'Sin permiso' using errcode = '42501';
-- end $$;
-- drop trigger if exists aa_sf_restringir_update on public.solicitudes_fabrica;
-- create trigger aa_sf_restringir_update before update on public.solicitudes_fabrica for each row execute function public.sf_restringir_update();
-- drop policy if exists "sf_select_logueados" on public.solicitudes_fabrica;
-- drop policy if exists "sf_update_logueados" on public.solicitudes_fabrica;
-- create policy "sf_select_roles" on public.solicitudes_fabrica for select to authenticated using (public.get_my_role() in ('ADMIN','OFICINA','COORDINACION','FABRICA','TECNICO'));
-- create policy "sf_update_roles" on public.solicitudes_fabrica for update to authenticated using (public.get_my_role() in ('ADMIN','OFICINA','COORDINACION','FABRICA','TECNICO')) with check (public.get_my_role() in ('ADMIN','OFICINA','COORDINACION','FABRICA','TECNICO'));
