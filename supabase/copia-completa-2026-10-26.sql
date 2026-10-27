-- Copia completa privada (26/10/2026). Sin datos ni secretos.
-- Pedido de Franco (WhatsApp 26/10): copia de seguridad completa y recuperable.
--
-- Que crea (una sola vez, antes de habilitar el programa de la PC):
--  * schema copia_privada (no expuesto por la API) con la tabla instantaneas: guarda
--    TEMPORALMENTE una foto JSON de toda la base. Sin acceso para anon/authenticated.
--  * copia_crear(): arma la foto en UNA sola sentencia SQL (una sola foto de la base,
--    consistente entre tablas, relaciones, esquema, lista de archivos y usuarios).
--  * copia_leer(id, desde, largo): entrega la foto por tramos.
--  * copia_resumen(id) y copia_objetos(id, desde, limite): conteos por tabla y lista de archivos.
--  * copia_cerrar(id, sha256): borra la foto del servidor solo si el SHA256 que calculo
--    la PC coincide. Una corrida nueva reemplaza cualquier foto vieja (nunca hay mas de una) y las no confirmadas se borran a los 2 dias.
-- Solo las puede ejecutar service_role (clave de servidor de la app). No cambia datos,
-- roles, policies ni funciones existentes.
-- Se EXCLUYE push_* (claves/endpoints de celulares: se vuelven a activar en cada celular)
-- y los hashes de contrasena de login (no se exportan). Las tablas nuevas que se creen
-- en public se incluyen solas.
-- No incluye el contenido de los archivos (fotos/facturas): solo su lista y metadatos en la
-- misma foto; el contenido lo baja el programa y lo verifica.

begin;

create schema if not exists copia_privada;
revoke all on schema copia_privada from public, anon, authenticated;

create table if not exists copia_privada.instantaneas (
  id bigint generated always as identity primary key,
  creada timestamptz not null default now(),
  bytes bigint not null,
  sha256 text not null,
  datos text not null,
  resumen jsonb,
  objetos jsonb
);
alter table copia_privada.instantaneas add column if not exists resumen jsonb;
alter table copia_privada.instantaneas add column if not exists objetos jsonb;
alter table copia_privada.instantaneas enable row level security;
revoke all on copia_privada.instantaneas from public, anon, authenticated;

create or replace function public.copia_crear()
returns table(r_id bigint, r_bytes bigint, r_sha256 text)
language plpgsql security definer set search_path = '' as $$
declare
  q text; doc text; nuevo bigint; n_tablas integer; d jsonb;
begin
  -- Una sola foto en el servidor: una corrida nueva reemplaza cualquier foto vieja sin confirmar (no se acumulan).
  delete from copia_privada.instantaneas;
  perform set_config('statement_timeout', '120000', true);

  select string_agg(format('%L, (select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x)', c.relname, c.relname),
                    ', ' order by c.relname)
    into q
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','p') and c.relname not like 'push\_%';

  select count(*) into n_tablas from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','p') and not c.relispartition and c.relname not like 'push\_%';
  if exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and (c.relkind = 'p' or c.relispartition)) then
    raise exception 'Hay tablas particionadas en public: la copia no las soporta todavia';
  end if;
  -- Fail-closed: si aparece algo que el restore no sabe reconstruir, la copia NO se hace (mejor un error visible que una copia que parece completa).
  if exists (select 1 from pg_catalog.pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('c','m','f') and not exists (select 1 from pg_catalog.pg_depend dx where dx.objid = c.oid and dx.deptype = 'e'))
     or exists (select 1 from pg_catalog.pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind in ('a','w') and not exists (select 1 from pg_catalog.pg_depend dx where dx.objid = p.oid and dx.deptype = 'e'))
     or exists (select 1 from pg_catalog.pg_operator o where o.oprnamespace = 'public'::regnamespace and not exists (select 1 from pg_catalog.pg_depend dx where dx.objid = o.oid and dx.deptype = 'e'))
     or exists (select 1 from pg_catalog.pg_rules r where r.schemaname = 'public')
     or exists (select 1 from pg_catalog.pg_inherits i join pg_catalog.pg_class c on c.oid = i.inhrelid where c.relnamespace = 'public'::regnamespace)
     or exists (select 1 from pg_catalog.pg_namespace n where n.nspname !~ '^(pg_|information_schema)' and n.nspname not in ('public','auth','storage','extensions','graphql','graphql_public','realtime','vault','cron','net','pgsodium','pgsodium_masks','supabase_functions','supabase_migrations','_realtime','_analytics','pgbouncer','copia_privada'))
     or exists (select 1 from pg_catalog.pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind in ('f','p') and exists (select 1 from unnest(p.proargtypes) t where t in (select reltype from pg_catalog.pg_class where relnamespace = 'public'::regnamespace)))
     or exists (select 1 from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid = a.attrelid join pg_catalog.pg_type t on t.oid = a.atttypid where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped and t.typtype not in ('b','e','d') and t.typcategory <> 'A') then
    raise exception 'Hay objetos que el restore no soporta (tipos compuestos, vistas materializadas, tablas foraneas/heredadas, agregados, operadores, reglas, esquemas propios o funciones con argumentos de fila): la copia no se hace hasta ampliar el restore';
  end if;
  if n_tablas > 45 then raise exception 'Hay % tablas; ampliar copia_crear (limite 45)', n_tablas; end if;

  -- UNA sola sentencia: todas las subconsultas ven la misma foto de la base.
  q := 'select (jsonb_build_object(' ||
    '''formato'', 1, ''creada'', now(), ' ||
    '''tablas_excluidas'', (select coalesce(jsonb_agg(c.relname order by c.relname), ''[]''::jsonb) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname=''public'' and c.relkind in (''r'',''p'') and c.relname like ''push\_%''), ' ||
    '''datos'', jsonb_build_object(' || coalesce(q, '') || '), ' ||
    '''esquema'', jsonb_build_object(' ||
      '''columnas'', (select coalesce(jsonb_agg(jsonb_build_object(''tabla'', c.relname, ''orden'', a.attnum, ''nombre'', a.attname, ''tipo'', pg_catalog.format_type(a.atttypid, a.atttypmod), ''no_nulo'', a.attnotnull, ''default'', pg_catalog.pg_get_expr(d.adbin, d.adrelid), ''identidad'', a.attidentity::text, ''generada'', a.attgenerated::text) order by c.relname, a.attnum), ''[]''::jsonb) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped left join pg_catalog.pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname=''public'' and c.relkind in (''r'',''p'')), ' ||
      '''restricciones'', (select coalesce(jsonb_agg(jsonb_build_object(''tabla'', c.relname, ''nombre'', k.conname, ''tipo'', k.contype::text, ''definicion'', pg_catalog.pg_get_constraintdef(k.oid)) order by c.relname, (k.contype = ''f''), k.conname), ''[]''::jsonb) from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname=''public''), ' ||
      '''indices'', (select coalesce(jsonb_agg(jsonb_build_object(''tabla'', i.tablename, ''nombre'', i.indexname, ''definicion'', i.indexdef) order by i.tablename, i.indexname), ''[]''::jsonb) from pg_catalog.pg_indexes i where i.schemaname=''public''), ' ||
      '''rls'', (select coalesce(jsonb_agg(jsonb_build_object(''esquema'', n.nspname, ''tabla'', c.relname, ''activo'', c.relrowsecurity, ''forzado'', c.relforcerowsecurity) order by n.nspname, c.relname), ''[]''::jsonb) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where c.relkind in (''r'',''p'') and (n.nspname=''public'' or (n.nspname=''storage'' and c.relname=''objects''))), ' ||
      '''policies'', (select coalesce(jsonb_agg(to_jsonb(p) order by p.schemaname, p.tablename, p.policyname), ''[]''::jsonb) from pg_catalog.pg_policies p where p.schemaname=''public'' or (p.schemaname=''storage'' and p.tablename=''objects'')), ' ||
      '''triggers'', (select coalesce(jsonb_agg(jsonb_build_object(''tabla'', c.relname, ''nombre'', t.tgname, ''habilitado'', t.tgenabled::text, ''definicion'', pg_catalog.pg_get_triggerdef(t.oid)) order by c.relname, t.tgname), ''[]''::jsonb) from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname=''public''), ' ||
      '''funciones'', (select coalesce(jsonb_agg(jsonb_build_object(''nombre'', p.proname, ''argumentos'', pg_catalog.pg_get_function_identity_arguments(p.oid), ''definicion'', pg_catalog.pg_get_functiondef(p.oid), ''acl'', p.proacl::text) order by p.proname, p.oid), ''[]''::jsonb) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname=''public'' and p.prokind in (''f'',''p'') and not exists (select 1 from pg_catalog.pg_depend dp where dp.objid=p.oid and dp.deptype=''e'')), ' ||
      '''vistas'', (select coalesce(jsonb_agg(jsonb_build_object(''nombre'', c.relname, ''definicion'', pg_catalog.pg_get_viewdef(c.oid)) order by c.relname), ''[]''::jsonb) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname=''public'' and c.relkind in (''v'',''m'')), ' ||
      '''permisos_tablas'', (select coalesce(jsonb_agg(jsonb_build_object(''tabla'', c.relname, ''acl'', c.relacl::text) order by c.relname), ''[]''::jsonb) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname=''public'' and c.relkind in (''r'',''p'',''v'',''m'')), ' ||
      '''publicaciones'', (select coalesce(jsonb_agg(to_jsonb(pt) order by pt.pubname, pt.schemaname, pt.tablename), ''[]''::jsonb) from pg_catalog.pg_publication_tables pt), ' ||
      '''extensiones'', (select coalesce(jsonb_agg(jsonb_build_object(''nombre'', e.extname, ''version'', e.extversion, ''esquema'', n.nspname) order by e.extname), ''[]''::jsonb) from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace), ' ||
      '''tipos'', (select coalesce(jsonb_agg(jsonb_build_object(''nombre'', t.typname, ''tipo'', t.typtype::text, ''etiquetas'', (select jsonb_agg(en.enumlabel order by en.enumsortorder) from pg_catalog.pg_enum en where en.enumtypid=t.oid), ''base'', case when t.typtype=''d'' then pg_catalog.format_type(t.typbasetype, t.typtypmod) end, ''no_nulo'', t.typnotnull, ''default'', t.typdefault, ''restricciones'', (select jsonb_agg(pg_catalog.pg_get_constraintdef(k.oid)) from pg_catalog.pg_constraint k where k.contypid=t.oid)) order by t.typname), ''[]''::jsonb) from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid=t.typnamespace where n.nspname=''public'' and t.typtype in (''e'',''d'')), ' ||
      '''secuencias'', (select coalesce(jsonb_agg(jsonb_build_object(''nombre'', sq.sequencename, ''tipo'', sq.data_type::text, ''inicio'', sq.start_value::text, ''minimo'', sq.min_value::text, ''maximo'', sq.max_value::text, ''incremento'', sq.increment_by::text, ''cicla'', sq.cycle, ''cache'', sq.cache_size::text, ''ultimo_valor'', sq.last_value::text, ''identidad'', exists(select 1 from pg_catalog.pg_depend dd where dd.objid=cs.oid and dd.deptype=''i''), ''propietaria'', (select oc.relname || ''.'' || oa.attname from pg_catalog.pg_depend dd join pg_catalog.pg_class oc on oc.oid=dd.refobjid join pg_catalog.pg_attribute oa on oa.attrelid=oc.oid and oa.attnum=dd.refobjsubid where dd.objid=cs.oid and dd.deptype in (''a'',''i'') limit 1), ''acl'', cs.relacl::text) order by sq.sequencename), ''[]''::jsonb) from pg_catalog.pg_sequences sq join pg_catalog.pg_class cs on cs.relname=sq.sequencename and cs.relnamespace=''public''::regnamespace where sq.schemaname=''public''), ' ||
      '''permisos_columnas'', (select coalesce(jsonb_agg(jsonb_build_object(''tabla'', c.relname, ''columna'', a.attname, ''acl'', a.attacl::text) order by c.relname, a.attnum), ''[]''::jsonb) from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname=''public'' and a.attacl is not null and not a.attisdropped), ' ||
      '''privilegios_default'', (select coalesce(jsonb_agg(jsonb_build_object(''rol'', d.defaclrole::regrole::text, ''esquema'', coalesce(dn.nspname, ''''), ''objeto'', d.defaclobjtype::text, ''acl'', d.defaclacl::text) order by d.oid), ''[]''::jsonb) from pg_catalog.pg_default_acl d left join pg_catalog.pg_namespace dn on dn.oid=d.defaclnamespace), ' ||
      '''triggers_auth'', (select coalesce(jsonb_agg(jsonb_build_object(''nombre'', t.tgname, ''habilitado'', t.tgenabled::text, ''definicion'', pg_catalog.pg_get_triggerdef(t.oid)) order by t.tgname), ''[]''::jsonb) from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname=''auth'' and c.relname=''users''), ' ||
      '''revision_definiciones'', (select jsonb_build_object(''alertas'', coalesce((select jsonb_agg(distinct x.n) from (select ''funcion '' || p.proname n, pg_catalog.pg_get_functiondef(p.oid) d from pg_catalog.pg_proc p where p.pronamespace=''public''::regnamespace and p.prokind in (''f'',''p'') union all select ''policy '' || pl.policyname, coalesce(pl.qual,'''') || coalesce(pl.with_check,'''') from pg_catalog.pg_policies pl where pl.schemaname in (''public'',''storage'') union all select ''vista '' || v.viewname, v.definition from pg_catalog.pg_views v where v.schemaname=''public'') x where x.d ~* ''(eyJ[A-Za-z0-9_-]{20,}|sk_(live|test)_[A-Za-z0-9]{8,}|\m(service_role_key|api[_-]?key|secret|password|token)\M(\s+(text|varchar|character varying))?\s*(:=|=|:|=>)\s*''''[^'''']{8,}''''|bearer\s+[A-Za-z0-9._-]{16,}|https?://[^ ''''"]*[?&](token|key|apikey)=[A-Za-z0-9._-]{8,})''), ''[]''::jsonb), ''hosts'', coalesce((select jsonb_agg(distinct h[1]) from (select regexp_matches(pg_catalog.pg_get_functiondef(p.oid), ''https?://([^/\s''''"]+)'', ''g'') h from pg_catalog.pg_proc p where p.pronamespace=''public''::regnamespace and p.prokind in (''f'',''p'')) hh), ''[]''::jsonb)))' ||
    '), ' ||
    '''storage'', jsonb_build_object(' ||
      '''buckets'', (select coalesce(jsonb_agg(to_jsonb(b) order by b.id), ''[]''::jsonb) from storage.buckets b), ' ||
      '''objetos'', (select coalesce(jsonb_agg(jsonb_build_object(''bucket'', o.bucket_id, ''ruta'', o.name, ''id'', o.id, ''tamano'', o.metadata->>''size'', ''etag'', o.metadata->>''eTag'', ''tipo'', o.metadata->>''mimetype'', ''creado'', o.created_at, ''actualizado'', o.updated_at) order by o.bucket_id, o.name), ''[]''::jsonb) from storage.objects o)' ||
    '), ' ||
    '''auth_usuarios'', (select coalesce(jsonb_agg(jsonb_build_object(''id'', u.id, ''email'', u.email, ''telefono'', u.phone, ''creado'', u.created_at, ''email_confirmado'', u.email_confirmed_at, ''ultimo_ingreso'', u.last_sign_in_at, ''baneado_hasta'', u.banned_until, ''app_metadata'', u.raw_app_meta_data, ''user_metadata'', u.raw_user_meta_data) order by u.created_at, u.id), ''[]''::jsonb) from auth.users u)' ||
    '))::text';
  execute q into doc;
  if octet_length(doc) > 200 * 1024 * 1024 then raise exception 'La foto supera 200 MB; hace falta otra estrategia de copia'; end if;

  d := doc::jsonb;
  insert into copia_privada.instantaneas(bytes, sha256, datos, resumen, objetos)
  values (octet_length(doc), encode(pg_catalog.sha256(convert_to(doc, 'UTF8')), 'hex'), doc,
    jsonb_build_object(
      'tablas', (select coalesce(jsonb_object_agg(k, jsonb_array_length(v)), '{}'::jsonb) from jsonb_each(d->'datos') e(k, v)),
      'excluidas', d->'tablas_excluidas',
      'objetos', jsonb_array_length(d->'storage'->'objetos'),
      'usuarios', jsonb_array_length(d->'auth_usuarios'),
      'revision_definiciones', d->'esquema'->'revision_definiciones',
      'creada', d->'creada'),
    d->'storage'->'objetos')
  returning copia_privada.instantaneas.id into nuevo;
  return query select i.id, i.bytes, i.sha256 from copia_privada.instantaneas i where i.id = nuevo;
end $$;

create or replace function public.copia_leer(p_id bigint, p_desde integer, p_largo integer)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if p_id is null or p_desde is null or p_largo is null or p_desde < 1 or p_largo < 1 or p_largo > 1000000 then
    raise exception 'Parametros invalidos';
  end if;
  return (select substring(i.datos from p_desde for p_largo) from copia_privada.instantaneas i where i.id = p_id);
end $$;

create or replace function public.copia_cerrar(p_id bigint, p_sha256 text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare ok boolean;
begin
  select i.sha256 = p_sha256 into ok from copia_privada.instantaneas i where i.id = p_id;
  if ok is null then return false; end if;
  if not ok then raise exception 'El SHA256 recibido no coincide; la foto se conserva'; end if;
  delete from copia_privada.instantaneas where id = p_id;
  return true;
end $$;

create or replace function public.copia_resumen(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  select i.resumen into r from copia_privada.instantaneas i where i.id = p_id;
  if r is null then raise exception 'Foto inexistente'; end if;
  return r;
end $$;

create or replace function public.copia_objetos(p_id bigint, p_desde integer, p_limite integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o jsonb;
begin
  if p_desde is null or p_limite is null or p_desde < 0 or p_limite < 1 or p_limite > 500 then
    raise exception 'Parametros invalidos';
  end if;
  select i.objetos into o from copia_privada.instantaneas i where i.id = p_id;
  if o is null then raise exception 'Foto inexistente'; end if;
  return coalesce((select jsonb_agg(x.v order by x.n) from jsonb_array_elements(o) with ordinality x(v, n)
                   where x.n > p_desde and x.n <= p_desde + p_limite), '[]'::jsonb);
end $$;

revoke all on function public.copia_crear() from public, anon, authenticated;
revoke all on function public.copia_leer(bigint, integer, integer) from public, anon, authenticated;
revoke all on function public.copia_cerrar(bigint, text) from public, anon, authenticated;
grant execute on function public.copia_crear() to service_role;
grant execute on function public.copia_leer(bigint, integer, integer) to service_role;
grant execute on function public.copia_cerrar(bigint, text) to service_role;
revoke all on function public.copia_resumen(bigint) from public, anon, authenticated;
revoke all on function public.copia_objetos(bigint, integer, integer) from public, anon, authenticated;
grant execute on function public.copia_resumen(bigint) to service_role;
grant execute on function public.copia_objetos(bigint, integer, integer) to service_role;

commit;
