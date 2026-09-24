-- Cambio en la base para que "Remover técnico y fecha" funcione.
-- NO se ejecuta solo: correrlo a mano en Supabase > SQL Editor.
-- Si te pregunta "run without RLS", elegí "without" (igual que la vez pasada).

-- El problema: la base deja VER, CREAR y EDITAR asignaciones, pero no
-- BORRARLAS. Entonces al sacar un técnico de un trabajo, la app actualizaba
-- el estado pero la asignación quedaba y el trabajo seguía apareciendo
-- en el recorrido del técnico (y fallaba sin avisar).
-- Esto habilita el borrado para usuarios logueados, igual que ya pueden
-- crear y editar asignaciones:
create policy "asignaciones_delete_logueados"
on public.asignaciones for delete
to authenticated
using (true);
