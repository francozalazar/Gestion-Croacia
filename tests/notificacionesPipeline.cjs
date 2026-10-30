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

const {client,despacharAvisos}=require('./notificacionesDispatcher.cjs');
await d.exec(`insert into profiles values('00000000-0000-0000-0000-000000000004','TECNICO',true);
insert into solicitudes values(1,'00000000-0000-0000-0000-000000000001','PENDIENTE_PRECIO','2026-11-02','Presupuesto');
update solicitudes set estado='PRESUPUESTADO' where id=1;
insert into solicitudes values(3,'00000000-0000-0000-0000-000000000001','PENDIENTE_COORDINACION','2026-11-02','Instalacion');
insert into asignaciones values(3,'00000000-0000-0000-0000-000000000004','TECNICO','2026-11-02',3,null);
update solicitudes set estado='ASIGNADO' where id=3;
insert into solicitudes_fabrica values(2,'00000000-0000-0000-0000-000000000001','PENDIENTE_APROBACION',null);
insert into solicitudes_fabrica values(4,'00000000-0000-0000-0000-000000000001','PENDIENTE_APROBACION',null);
update solicitudes_fabrica set estado='ENVIADO_A_CORTAR' where id=4;`);
const db={};for(const t of ['profiles','solicitudes','solicitudes_fabrica','asignaciones','avisos_circuito','avisos_entregas']) db[t]=(await d.query('select * from '+t)).rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v instanceof Date?(k==='fecha'?v.toISOString().slice(0,10):v.toISOString()):v])));
db.push_suscripciones=db.profiles.filter(p=>p.activo&&p.rol!=='TECNICO').map(p=>({usuario_id:p.id,endpoint:'https://fcm.googleapis.com/'+p.id,p256dh:'test',auth:'test'}));
const calls=[];await despacharAvisos(client(db),{sendNotification:async(s,p)=>calls.push({recipient:s.endpoint,payload:JSON.parse(p)})});
assert.equal(calls.length,4);assert.equal(db.avisos_entregas.length,4);assert.ok(db.avisos_circuito.every(e=>e.procesado_at));
const byType={};for(const e of db.avisos_circuito){if(e.solicitud_fabrica_id===4&&e.tipo==='aprobacion_pendiente')continue;assert.ok(db.avisos_entregas.some(r=>r.evento_id===e.id));byType[e.tipo]=e.usuario_id;}
assert.equal(Object.keys(byType).length,4);assert.equal(byType.aprobacion_pendiente,'00000000-0000-0000-0000-000000000002');for(const t of ['precio','fabrica_aprobada','asignacion_vendedor'])assert.equal(byType[t],'00000000-0000-0000-0000-000000000001');
console.log('PASS full isolated pipeline: actual SQL trigger -> queue rows -> actual dispatcher -> four payloads + receipts; already-approved pending event suppressed');
console.log(JSON.stringify(calls.map(c=>({recipient:c.recipient.slice(-1),payload:c.payload})),null,2));await d.close();
})().catch(e=>{console.error(e);process.exit(1)});
