-- Novedades en vivo del dashboard (Supabase Realtime).
-- Pegar en Supabase SQL Editor y ejecutar UNA sola vez.
-- Sin este paso, las novedades cargan al entrar al dashboard pero no aparecen en el momento.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'solicitudes'
  ) then
    alter publication supabase_realtime add table public.solicitudes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'solicitudes_fabrica'
  ) then
    alter publication supabase_realtime add table public.solicitudes_fabrica;
  end if;
end $$;
