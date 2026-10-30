-- Sólo lectura. Verifica esquema/funciones vigentes antes de la migración.
select jsonb_build_object(
 'columnas',(select jsonb_agg(jsonb_build_object('tabla',table_name,'nombre',column_name,'tipo',data_type)) from information_schema.columns where table_schema='public' and table_name in ('asignaciones','solicitudes','solicitudes_fabrica','push_eventos','push_suscripciones')),
 'funciones',(select jsonb_agg(jsonb_build_object('nombre',p.proname,'definicion',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('aprobar_pedido_fabrica','push_solicitar_despacho','push_reclamar')),
 'publicacion',(select jsonb_agg(tablename) from pg_publication_tables where pubname='supabase_realtime')
) as verificacion;
