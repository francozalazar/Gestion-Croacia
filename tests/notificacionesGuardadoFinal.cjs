const {PGlite}=require('@electric-sql/pglite'); const fs=require('fs'); const assert=require('node:assert/strict');
(async()=>{
const d=new PGlite();
await d.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table profiles(id uuid primary key,rol text,activo boolean);
create table solicitudes(id bigint primary key,creado_por uuid,estado text,fecha date,tipo_visita text);
create table solicitudes_fabrica(id bigint primary key,creado_por uuid,estado text,fecha date);
create table asignaciones(id bigint primary key,usuario_id uuid,tipo text,fecha date,solicitud_id bigint,solicitud_fabrica_id bigint);
grant select on profiles to authenticated;
create table push_suscripciones(endpoint text primary key);
create table push_eventos(id bigint,procesado_at timestamptz,created_at timestamptz,bloqueado_hasta timestamptz,intentos int);
insert into profiles values('00000000-0000-0000-0000-000000000001','OFICINA',true),('00000000-0000-0000-0000-000000000002','ADMIN',true),('00000000-0000-0000-0000-000000000003','ADMIN',false);`);
await d.exec(fs.readFileSync('supabase/notificaciones-circuito-2026-10-30.sql','utf8'));

await d.exec(fs.readFileSync('supabase/notificaciones-guardar-final-2026-10-30.sql','utf8'));
const n=async()=>(await d.query("select count(*)::int n from avisos_circuito where tipo='asignacion_vendedor'")).rows[0].n;
await d.exec(`insert into solicitudes values(1,'00000000-0000-0000-0000-000000000001','PENDIENTE_COORDINACION','2026-11-02','Instalacion');insert into asignaciones values(1,'00000000-0000-0000-0000-000000000004','TECNICO','2026-11-02',1,null);`);assert.equal(await n(),0);
await d.exec("update solicitudes set estado='ASIGNADO' where id=1");assert.equal(await n(),1);
await d.exec("update asignaciones set usuario_id='00000000-0000-0000-0000-000000000005' where id=1");assert.equal(await n(),1,'no premature reassignment');
await d.exec("update asignaciones set usuario_id='00000000-0000-0000-0000-000000000004' where id=1");assert.equal(await n(),1,'compensated failed step adds no notice');
await d.exec("update asignaciones set usuario_id='00000000-0000-0000-0000-000000000005' where id=1;update solicitudes set estado='ASIGNADO',fecha='2026-11-02' where id=1");assert.equal(await n(),2,'same-date technician change detected on final save');
await d.exec("update solicitudes set estado=estado,fecha=fecha where id=1");assert.equal(await n(),2,'retry no duplicate');
await d.exec("update asignaciones set fecha='2026-11-03' where id=1");assert.equal(await n(),2);await d.exec("update solicitudes set fecha='2026-11-03' where id=1");assert.equal(await n(),3);
await d.exec("insert into solicitudes_fabrica values(2,'00000000-0000-0000-0000-000000000001','PENDIENTE_COORDINACION','2026-11-02');insert into asignaciones values(2,'00000000-0000-0000-0000-000000000004','TECNICO','2026-11-02',null,2)");assert.equal(await n(),3);await d.exec("update solicitudes_fabrica set estado='ASIGNADO' where id=2");assert.equal(await n(),4);
await d.exec(fs.readFileSync('supabase/notificaciones-guardar-final-2026-10-30.sql','utf8'));assert.equal(await n(),4);
console.log('PASS final-save fix: initial/factory/same-date technician change/reprogram/failure compensation/no-op retry/no backfill and idempotent patch');await d.close();})();
