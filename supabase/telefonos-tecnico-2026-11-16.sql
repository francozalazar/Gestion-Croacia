begin;
create function public.tecnico_asignado_privado(s bigint,f bigint) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and rol='TECNICO' and activo) and exists(select 1 from asignaciones a where a.usuario_id=auth.uid() and (a.solicitud_id=s or a.solicitud_fabrica_id=f or a.solicitud_id in(select id from solicitudes where solicitud_fabrica_id=f)))$$;
revoke all on function public.tecnico_asignado_privado(bigint,bigint) from public,anon;
grant execute on function public.tecnico_asignado_privado(bigint,bigint) to authenticated;
do $$declare t text;c text;w text;begin foreach t in array array['solicitudes','solicitudes_fabrica','clientes'] loop
select string_agg(quote_ident(column_name),',') into c from information_schema.columns where table_schema='public' and table_name=t and column_name not in ('telefono','cliente_telefono','email');
w:=case t when 'solicitudes' then 'tecnico_asignado_privado(id,solicitud_fabrica_id)' when 'solicitudes_fabrica' then 'tecnico_asignado_privado(null,id)' else 'id in(select cliente_id from solicitudes_tecnico union select cliente_id from solicitudes_fabrica_tecnico)' end;
execute format('create view public.%I with(security_barrier=true) as select %s from public.%I where %s',t||'_tecnico',c,t,w);
execute format('revoke all on public.%I from public,anon,authenticated',t||'_tecnico');
execute format('grant select on public.%I to authenticated',t||'_tecnico');
end loop;end$$;
commit;

-- Apply this second transaction after the app uses the safe views.
begin;
do $$declare t text;begin foreach t in array array['solicitudes','solicitudes_fabrica','clientes'] loop
execute format('create policy tecnico_sin_telefono on public.%I as restrictive for select to authenticated using(coalesce((select get_my_role()),'''')<>''TECNICO'')',t);
end loop;end$$;
commit;
