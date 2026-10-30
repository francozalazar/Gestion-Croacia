import { avisoPushVigente, textoAvisoPush } from "./avisoPush";
import { endpointPermitido } from "./push";
export async function despacharAvisos(admin: any, webpush: any) {
  const {data: eventos, error} = await admin.rpc("avisos_reclamar");
  // La migración puede aplicarse después del servidor. No rompe push técnico.
  if (error) return false;
  for (const e of eventos || []) {
    async function vigente() {
      const [p, s, a] = await Promise.all([
        admin.from("profiles").select("rol,activo").eq("id",e.usuario_id).maybeSingle(),
        admin.from(e.solicitud_fabrica_id ? "solicitudes_fabrica" : "solicitudes").select("*").eq("id",e.solicitud_fabrica_id || e.solicitud_id).maybeSingle(),
        e.asignacion_id ? admin.from("asignaciones").select("*").eq("id",e.asignacion_id).maybeSingle() : Promise.resolve({data:null,error:null}),
      ]);
      if (p.error || s.error || a.error) return null;
      return avisoPushVigente(e,p.data,s.data,a.data);
    }
    const cerrar = () => admin.from("avisos_circuito").update({procesado_at:new Date().toISOString()}).eq("id",e.id);
    const estado = await vigente();
    if (estado === null) continue;
    if (!estado) { await cerrar(); continue; }
    const {data:subs,error:errSubs} = await admin.from("push_suscripciones").select("endpoint,p256dh,auth").eq("usuario_id",e.usuario_id);
    if (errSubs) continue;
    let retry=false;
    for (const sub of subs || []) {
      if (!endpointPermitido(sub.endpoint)) continue;
      const {data:entrega,error:errEnt} = await admin.from("avisos_entregas").select("enviado_at").eq("evento_id",e.id).eq("endpoint",sub.endpoint).maybeSingle();
      if (errEnt) {retry=true;continue;}
      if (entrega?.enviado_at) continue;
      const actual=await vigente();
      if (actual===null) {retry=true;continue;}
      if (!actual) continue;
      const {data:prop,error:errProp}=await admin.from("push_suscripciones").select("usuario_id").eq("endpoint",sub.endpoint).maybeSingle();
      if (errProp) {retry=true;continue;}
      if (prop?.usuario_id!==e.usuario_id) continue;
      const texto=textoAvisoPush(e.tipo);
      if (!texto) continue;
      try {
        await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({tipo:"circuito",evento:String(e.id),...texto}),{TTL:60,urgency:"normal",timeout:5000});
        const {error:errSave}=await admin.from("avisos_entregas").upsert({evento_id:e.id,endpoint:sub.endpoint});
        if (errSave) retry=true;
      } catch(err) {
        if ([404,410].includes((err as any)?.statusCode)) {
          const {error:errDelete}=await admin.from("push_suscripciones").delete().eq("endpoint",sub.endpoint).eq("usuario_id",e.usuario_id);
          if(errDelete) retry=true;
        } else retry=true;
      }
    }
    if (!retry) await cerrar();
  }
  return true;
}
