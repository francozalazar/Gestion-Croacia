-- Cambio en la base para cerrar el acceso del tecnico a pedidos de fabrica ajenos (23/10/2026).
-- NO se ejecuta solo: correrlo a mano en Supabase > SQL Editor.
-- Motivo: Franco vio que el tecnico, entrando a "Consultar Mi Recorrido", llegaba a la
-- vista de oficina con todos los camiones. La app ya se corrigio para que el tecnico
-- solo vea su propio recorrido, pero la base todavia le permite LEER todas las
-- solicitudes_fabrica (policy sf_select_roles incluye TECNICO): ahi hay clientes,
-- direcciones y montos (total, sena, medio de pago).
--
-- Que hace: el TECNICO pasa a leer solo las solicitudes_fabrica que tiene asignadas
-- (misma regla que ya tiene en solicitudes con sol_select_tecnico_asignado).
-- ADMIN, OFICINA, COORDINACION y FABRICA no cambian.
-- El tecnico sigue pudiendo COMPLETAR sus trabajos: la policy de update no se toca
-- y sus lecturas en Mis trabajos / detalle / Mi recorrido siempre pasan por sus
-- asignaciones, asi que siguen viendose.

drop policy if exists "sf_select_logueados" on public.solicitudes_fabrica;
drop policy if exists "sf_select_roles" on public.solicitudes_fabrica;

create policy "sf_select_roles" on public.solicitudes_fabrica
for select to authenticated
using (public.get_my_role() in ('ADMIN', 'OFICINA', 'COORDINACION', 'FABRICA'));

create policy "sf_select_tecnico_asignado" on public.solicitudes_fabrica
for select to authenticated
using (
  public.get_my_role() = 'TECNICO'
  and exists (
    select 1 from public.asignaciones a
    where a.solicitud_fabrica_id = solicitudes_fabrica.id
      and a.usuario_id = auth.uid()
  )
);

-- REVERTIR (vuelve a dejar lectura amplia para todos los roles validos):
--   drop policy if exists "sf_select_tecnico_asignado" on public.solicitudes_fabrica;
--   drop policy if exists "sf_select_roles" on public.solicitudes_fabrica;
--   create policy "sf_select_roles" on public.solicitudes_fabrica for select to authenticated
--   using (public.get_my_role() in ('ADMIN','OFICINA','COORDINACION','FABRICA','TECNICO'));
--
-- Prueba sugerida (transaccion con rollback, un usuario tecnico real):
--   como TECNICO: select count(*) from solicitudes_fabrica -> solo sus asignadas;
--   como ADMIN: sin cambios.
--
-- Pendiente conocido (decision de negocio, no se toco):
--   * La tabla asignaciones sigue siendo legible por cualquier logueado (quien trabaja
--     que dia, sin datos de clientes). Si se quiere cerrar, hay que revisar antes que
--     ninguna vista de COORDINACION/FABRICA dependa de leer asignaciones de otros.
