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
