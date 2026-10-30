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

await d.exec(fs.readFileSync('supabase/notificaciones-listos-2026-10-30.sql','utf8'));
const n=async()=>(await d.query("select count(*)::int n from avisos_circuito where tipo='fabrica_lista'")).rows[0].n;
let id=1;for(const estado of ['ENVIADO_A_CORTAR','EN_CORTE','EN_FABRICACION','EN_FABRICA','FALTANTES']){await d.query("insert into solicitudes_fabrica values($1,'00000000-0000-0000-0000-000000000001',$2,null)",[id,estado]);await d.query("update solicitudes_fabrica set estado='LISTO_PARA_COLOCAR' where id=$1",[id]);assert.equal(await n(),id);await d.query("update solicitudes_fabrica set estado=estado where id=$1",[id]);assert.equal(await n(),id);id++;}
await d.exec("begin;insert into solicitudes_fabrica values(9,'00000000-0000-0000-0000-000000000001','EN_FABRICA',null);update solicitudes_fabrica set estado='LISTO_PARA_COLOCAR' where id=9;rollback;");assert.equal(await n(),5);
await d.exec("insert into solicitudes_fabrica values(10,'00000000-0000-0000-0000-000000000002','EN_FABRICA',null),(11,'00000000-0000-0000-0000-000000000001','PENDIENTE_APROBACION',null);update solicitudes_fabrica set estado='LISTO_PARA_COLOCAR' where id in(10,11)");assert.equal(await n(),5);
await d.exec(fs.readFileSync('supabase/notificaciones-listos-2026-10-30.sql','utf8'));assert.equal(await n(),5);
const{client,despacharAvisos,load}=require('./notificacionesDispatcher.cjs');const db={};for(const t of ['profiles','solicitudes','solicitudes_fabrica','asignaciones','avisos_entregas'])db[t]=(await d.query('select * from '+t)).rows;
db.avisos_circuito=(await d.query("select * from avisos_circuito where tipo='fabrica_lista'")).rows;db.push_suscripciones=[{usuario_id:'00000000-0000-0000-0000-000000000001',endpoint:'https://fcm.googleapis.com/test',p256dh:'test',auth:'test'}];let calls=[];await despacharAvisos(client(db),{sendNotification:async(s,p)=>calls.push(JSON.parse(p))});assert.equal(calls.length,5);assert.ok(calls.every(c=>c.titulo==='Croacia: trabajo listo para colocar'));assert.equal(db.avisos_entregas.length,5);
const {avisoPushVigente}=load('lib/avisoPush.ts');const e={tipo:'fabrica_lista',usuario_id:'seller'},p={rol:'OFICINA',activo:true};for(const estado of ['ANULADO','CANCELADO','EN_FABRICA','FINALIZADO'])assert.equal(avisoPushVigente(e,p,{estado,creado_por:'seller'},null),false);
console.log('PASS fifth event actual SQL -> queue -> dispatcher -> payload/receipt; 5 production origins, wrong owner role, noop, transaction rollback, migration rerun/no backfill, stale state');await d.close();})();
