import Link from "next/link";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

// Cierre del día (solo Admin, solo lectura). Hora de Buenos Aires (UTC-3, sin horario de verano).
// No modifica nada ni envía nada: sirve para detectar olvidos mirando una sola pantalla.
const plata = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const hoyBA = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const hora = (v: string | null) =>
  v ? new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v)) : "";
const PAGINA = 1000; // PostgREST corta en 1000 filas por consulta
const PAGINAS_MAX = 50;

export default async function CierreDelDiaPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: perfil } = await supabase.from("profiles").select("nombre, apellido, rol").eq("id", user.id).single();
  const rol = perfil?.rol || "OFICINA";
  if (rol.toUpperCase() !== "ADMIN") redirect("/dashboard");

  const { fecha: pedida } = await searchParams;
  const valida = !!pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) && !Number.isNaN(new Date(pedida + "T12:00:00Z").getTime());
  const fecha = valida ? (pedida as string) : hoyBA();
  const desde = `${fecha}T00:00:00-03:00`;
  const hasta = new Date(new Date(desde).getTime() + 24 * 3600 * 1000).toISOString();
  const dia = (delta: number) => new Date(new Date(`${fecha}T12:00:00Z`).getTime() + delta * 24 * 3600 * 1000).toISOString().slice(0, 10);

  // Pagina de forma determinista (orden por id) porque PostgREST corta en 1000 filas por consulta.
  // Si se llega al tope de paginas, `parcial` queda en true y la pantalla lo avisa: nunca se muestra un total como completo si no lo es.
  let parcial = false;
  const traerTodo = async (armar: (desde: number, hasta: number) => PromiseLike<{ data: any[] | null; error: any }>) => {
    const filas: any[] = [];
    for (let pag = 0; pag < PAGINAS_MAX; pag++) {
      const r = await armar(pag * PAGINA, pag * PAGINA + PAGINA - 1);
      if (r.error) return { data: null as any[] | null, error: r.error };
      filas.push(...(r.data || []));
      if ((r.data || []).length < PAGINA) return { data: filas, error: null };
    }
    parcial = true;
    return { data: filas, error: null };
  };

  const [visitas, pedidos, pagos, salidas, motores, ventas, perfiles] = await Promise.all([
    traerTodo((d, h) => supabase.from("solicitudes").select("id, numero, cliente_nombre, tipo_visita, estado, tecnico_remito, fecha_finalizacion, solicitud_fabrica_id")
      .gte("fecha_finalizacion", desde).lt("fecha_finalizacion", hasta).order("fecha_finalizacion").order("id").range(d, h)),
    traerTodo((d, h) => supabase.from("solicitudes_fabrica").select("id, numero_remito, cliente_nombre, estado, fecha_finalizado")
      .gte("fecha_finalizado", desde).lt("fecha_finalizado", hasta).order("fecha_finalizado").order("id").range(d, h)),
    traerTodo((d, h) => supabase.from("pagos").select("id, venta_id, monto, medio, facturado, creado_por, ventas(cliente_id, solicitud_fabrica_id, clientes(nombre))").eq("fecha", fecha).order("id").range(d, h)),
    traerTodo((d, h) => supabase.from("stock_movimientos").select("id, cantidad, detalle, solicitud_fabrica_id, solicitud_id, tecnico_id, creado_por, created_at, stock_motores(nombre)")
      .eq("tipo", "SALIDA").gte("created_at", desde).lt("created_at", hasta).order("created_at").order("id").range(d, h)),
    supabase.from("stock_motores").select("id, nombre, cantidad, minimo").order("nombre"),
    traerTodo((d, h) => supabase.from("ventas").select("id, cliente_id, total, solicitud_fabrica_id, pagos(monto), clientes(nombre)").order("id").range(d, h)),
    supabase.from("profiles").select("id, nombre, apellido"),
  ]);
  // Un error se muestra; nunca se presenta como "cero".
  const errores = [
    ["trabajos finalizados", visitas.error], ["pedidos cerrados", pedidos.error], ["cobros", pagos.error],
    ["motores", salidas.error || motores.error], ["saldos", ventas.error], ["usuarios", perfiles.error],
  ].filter(([, e]) => e).map(([n, e]) => `${n}: ${(e as { message: string }).message}`);

  const nombre: Record<string, string> = {};
  (perfiles.data || []).forEach((p: any) => { nombre[p.id] = `${p.nombre || ""} ${p.apellido || ""}`.trim() || "Sin nombre"; });

  const saldoVenta = (v: any) => Number(v.total || 0) - (v.pagos || []).reduce((a: number, p: any) => a + Number(p.monto || 0), 0);
  const porPedido: Record<string, number> = {};
  (ventas.data || []).forEach((v: any) => { if (v.solicitud_fabrica_id != null) porPedido[v.solicitud_fabrica_id] = (porPedido[v.solicitud_fabrica_id] || 0) + saldoVenta(v); });
  const deudores: Record<string, { nombre: string; saldo: number }> = {};
  (ventas.data || []).forEach((v: any) => {
    const s = saldoVenta(v);
    const d = (deudores[v.cliente_id] = deudores[v.cliente_id] || { nombre: v.clientes?.nombre || "Cliente", saldo: 0 });
    d.saldo += s;
  });
  const debe = Object.entries(deudores).filter(([, d]) => d.saldo > 0.5).sort((a, b) => b[1].saldo - a[1].saldo);
  const totalSaldo = debe.reduce((a, [, d]) => a + d.saldo, 0);

  const cobrado = (pagos.data || []).reduce((a: number, p: any) => a + Number(p.monto || 0), 0);
  const porMedio: Record<string, number> = {};
  (pagos.data || []).forEach((p: any) => { const m = p.medio || "Sin medio"; porMedio[m] = (porMedio[m] || 0) + Number(p.monto || 0); });
  const motoresUsados = (salidas.data || []).reduce((a: number, m: any) => a + Number(m.cantidad || 0), 0);
  // Para revisar: instalado ese día y todavía con saldo en la venta del pedido.
  const instaladosConSaldo = (visitas.data || []).filter((s: any) => s.solicitud_fabrica_id != null && (porPedido[s.solicitud_fabrica_id] || 0) > 0.5);

  const caja = "rounded-xl bg-white p-5 shadow-sm";
  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar nombre={perfil?.nombre || "Usuario"} apellido={perfil?.apellido || ""} rol={rol} />
      <main className="ml-0 md:ml-64 min-h-screen bg-slate-50 p-6 md:p-8 pt-20 md:pt-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Cierre del día</h1>
            <p className="mt-2 text-slate-600">Resumen para detectar olvidos. Solo lectura; hora de Buenos Aires.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <Link href={`/cierre-del-dia?fecha=${dia(-1)}`} className="text-blue-700 hover:underline">← Día anterior</Link>
              <form action="/cierre-del-dia" method="get" className="flex items-center gap-2">
                <input type="date" name="fecha" defaultValue={fecha} className="rounded border border-slate-300 px-2 py-1" />
                <button type="submit" className="rounded bg-slate-800 px-3 py-1 text-white">Ver</button>
              </form>
              {fecha < hoyBA() && <Link href={`/cierre-del-dia?fecha=${dia(1)}`} className="text-blue-700 hover:underline">Día siguiente →</Link>}
              {pedida && !valida && <span className="text-amber-700">Fecha inválida: se muestra hoy.</span>}
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-800">{fecha.split("-").reverse().join("/")}</p>
          </div>

          {errores.length > 0 && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">No se pudo leer: {errores.join(" · ")}. Los números de esas secciones no son confiables.</p>
          )}
          {parcial && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Hay más datos de los que se pudieron leer ({PAGINAS_MAX * PAGINA} filas por consulta): los totales y saldos pueden estar incompletos.</p>
          )}

          <div className="grid gap-4 sm:grid-cols-4">
            <div className={caja}><p className="text-sm text-slate-500">Trabajos finalizados</p><p className="text-2xl font-bold">{(visitas.data || []).length}</p></div>
            <div className={caja}><p className="text-sm text-slate-500">Cobrado</p><p className="text-2xl font-bold">{plata(cobrado)}</p></div>
            <div className={caja}><p className="text-sm text-slate-500">Saldo pendiente total</p><p className="text-2xl font-bold text-red-700">{plata(totalSaldo)}</p></div>
            <div className={caja}><p className="text-sm text-slate-500">Motores descontados</p><p className="text-2xl font-bold">{motoresUsados}</p></div>
          </div>

          <section className={caja}>
            <h2 className="font-semibold text-slate-900">Trabajos finalizados por el técnico</h2>
            {(visitas.data || []).length === 0 ? <p className="mt-2 text-sm text-slate-500">Ninguno este día.</p> : (
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {(visitas.data || []).map((s: any) => (
                  <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      <Link className="text-blue-700 hover:underline" href={s.solicitud_fabrica_id ? `/ficha/remito/${s.solicitud_fabrica_id}` : `/finalizados/${s.id}`}>#{s.numero || s.id} {s.cliente_nombre}</Link>
                      <span className="ml-2 text-slate-500">{s.tipo_visita}{s.tecnico_remito ? ` · ${s.tecnico_remito}` : ""}</span>
                    </span>
                    <span className="text-slate-500">{hora(s.fecha_finalizacion)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={caja}>
            <h2 className="font-semibold text-slate-900">Pedidos de fábrica con cobro cerrado</h2>
            <p className="text-xs text-slate-500">El cierre de cobro es independiente de la instalación.</p>
            {(pedidos.data || []).length === 0 ? <p className="mt-2 text-sm text-slate-500">Ninguno este día.</p> : (
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {(pedidos.data || []).map((p: any) => (
                  <li key={p.id} className="flex justify-between gap-2 py-2">
                    <Link className="text-blue-700 hover:underline" href={`/ficha/remito/${p.id}`}>#{p.numero_remito || p.id} {p.cliente_nombre}</Link>
                    <span className="text-slate-500">{p.estado} · {hora(p.fecha_finalizado)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={caja}>
            <h2 className="font-semibold text-slate-900">Cobros registrados</h2>
            {(pagos.data || []).length === 0 ? <p className="mt-2 text-sm text-slate-500">Ninguno este día.</p> : (
              <>
                <p className="mt-1 text-sm text-slate-600">{Object.entries(porMedio).map(([m, v]) => `${m}: ${plata(v)}`).join(" · ")}</p>
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {(pagos.data || []).map((p: any) => (
                    <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>{p.ventas?.clientes?.nombre || "Cliente"} <span className="text-slate-500">· {p.medio || "Sin medio"} · cargó {nombre[p.creado_por] || "—"}{p.facturado ? " · facturado" : ""}</span></span>
                      <span className="font-semibold">{plata(Number(p.monto || 0))}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className={caja}>
            <h2 className="font-semibold text-slate-900">Motores descontados del stock (salidas registradas)</h2>
            {(salidas.data || []).length === 0 ? <p className="mt-2 text-sm text-slate-500">Ningún motor descontado este día.</p> : (
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {(salidas.data || []).map((m: any) => (
                  <li key={m.id} className="flex justify-between gap-2 py-2">
                    <span>{m.stock_motores?.nombre || "Motor"} × {m.cantidad}{m.solicitud_fabrica_id ? <Link className="ml-2 text-blue-700 hover:underline" href={`/ficha/remito/${m.solicitud_fabrica_id}`}>pedido #{m.solicitud_fabrica_id}</Link> : m.solicitud_id ? <span className="ml-2 text-slate-600">visita #{m.solicitud_id}</span> : null}{m.tecnico_id ? <span className="ml-2 text-slate-600">· técnico: {nombre[m.tecnico_id] || "sin perfil"}</span> : null}{m.detalle ? <span className="ml-2 text-slate-500">· {m.detalle}</span> : null}<span className="ml-2 text-slate-500">· registró {m.creado_por ? (nombre[m.creado_por] || "usuario sin perfil") : "sin dato"}</span></span>
                    <span className="text-slate-500">{hora(m.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">Quedan hoy: {(motores.data || []).map((m: any) => `${m.nombre} ${m.cantidad}${m.cantidad <= m.minimo ? " (por agotarse)" : ""}`).join(" · ") || "sin modelos cargados"}</p>
          </section>

          <section className={caja}>
            <h2 className="font-semibold text-slate-900">Para revisar</h2>
            <p className="mt-2 text-sm text-slate-600">Instalados este día con saldo todavía pendiente en su pedido: {instaladosConSaldo.length === 0 ? "ninguno." : ""}</p>
            {instaladosConSaldo.length > 0 && (
              <ul className="mt-1 divide-y divide-slate-100 text-sm">
                {instaladosConSaldo.map((s: any) => (
                  <li key={s.id} className="flex justify-between gap-2 py-2">
                    <Link className="text-blue-700 hover:underline" href={`/ficha/remito/${s.solicitud_fabrica_id}`}>#{s.numero || s.id} {s.cliente_nombre}</Link>
                    <span className="font-semibold text-red-700">{plata(porPedido[s.solicitud_fabrica_id])}</span>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mt-4 text-sm font-semibold text-slate-800">Quién debe más ({debe.length} clientes)</h3>
            <ul className="mt-1 divide-y divide-slate-100 text-sm">
              {debe.slice(0, 10).map(([cid, d]) => (
                <li key={cid} className="flex justify-between gap-2 py-2">
                  <Link className="text-blue-700 hover:underline" href={`/clientes/${cid}`}>{d.nombre}</Link>
                  <span className="font-semibold">{plata(d.saldo)}</span>
                </li>
              ))}
            </ul>
            <Link href="/saldos-pendientes" className="mt-2 inline-block text-sm text-blue-700 hover:underline">Ver todos los saldos pendientes →</Link>
          </section>
        </div>
      </main>
    </div>
  );
}
