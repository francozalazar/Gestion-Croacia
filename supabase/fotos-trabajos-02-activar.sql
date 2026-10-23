-- Solo DESPUES de desplegar UI nueva y pruebas de preparacion aprobadas.
begin;
create or replace function public.exigir_foto_al_finalizar() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if ((new.fecha_finalizacion is not null
 and old.fecha_finalizacion is distinct from new.fecha_finalizacion)
 or (new.estado in ('FINALIZADO','PENDIENTE_PRECIO','PRESUPUESTADO')
 and old.estado not in ('FINALIZADO','PENDIENTE_PRECIO','PRESUPUESTADO')))
 and not exists(select 1 from public.fotos_trabajos f join storage.objects o
 on o.bucket_id='fotos-trabajos' and o.name=f.storage_path where f.solicitud_id=new.id)
 then raise exception 'Subi una foto antes de finalizar el trabajo'; end if;
 return new;
end $$;
drop trigger if exists exigir_foto_al_finalizar on public.solicitudes;
create trigger exigir_foto_al_finalizar before update on public.solicitudes
for each row execute function public.exigir_foto_al_finalizar();
commit;
