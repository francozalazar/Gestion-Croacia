import Link from "next/link";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

const TIPOS: { key: string; label: string }[] = [
  { key: "CORTINA", label: "Cortinas" },
  { key: "PORTON_LAMA", label: "Portones lama" },
  { key: "REPARACION", label: "Reparaciones" },
];

// Mes en hora Argentina, formato YYYY-MM
function mesAR(iso: string) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).format(d);
  return p.slice(0, 7);
}

function mesAnterior(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nombreMes(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const n = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, mo - 1, 1)));
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${y}`;
}

type Resumen = {
  unidades: Record<string, number>;
  clientes: Set<string>;
  pedidos: number;
};
const vacio = (): Resumen => ({
  unidades: { CORTINA: 0, PORTON_LAMA: 0, REPARACION: 0 },
  clientes: new Set(),
  pedidos: 0,
});

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; vendedor?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();
  const rol = perfil?.rol || "OFICINA";
  if (rol.toUpperCase() !== "ADMIN") redirect("/dashboard");

  const { data: pedidos, error: e1 } = await supabase
    .from("solicitudes_fabrica")
    .select("id, created_at, creado_por, cliente_id, cliente_nombre, estado");
  const { data: items, error: e2 } = await supabase
    .from("pedido_items")
    .select("solicitud_fabrica_id, tipo, cantidad");
  const { data: perfiles } = await supabase
    .from("profiles")
    .select("id, nombre, apellido");

  const nombrePerfil: Record<string, string> = {};
  (perfiles || []).forEach((p: any) => {
    nombrePerfil[p.id] =
      `${p.nombre || ""} ${p.apellido || ""}`.trim() || "Sin nombre";
  });

  const itemsPorPedido: Record<number, any[]> = {};
  (items || []).forEach((i: any) => {
    (itemsPorPedido[i.solicitud_fabrica_id] ||= []).push(i);
  });

  const hoy = mesAR(new Date().toISOString());
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || "") ? (sp.mes as string) : hoy;
  const mesPrev = mesAnterior(mes);

  const global: Record<string, Resumen> = {};
  const porVend: Record<string, Record<string, Resumen>> = {};
  const clientesVend: Record<string, Record<string, Record<string, number>>> = {};
  const nombreCliente: Record<string, string> = {};
  let sinClasificar = 0;

  (pedidos || []).forEach((p: any) => {
    if (p.estado === "ANULADO") return;
    const its = itemsPorPedido[p.id];
    const m = mesAR(p.created_at);
    if (!its || its.length === 0) {
      if (m === mes) sinClasificar += 1;
      return;
    }
    const vend = p.creado_por || "sin-dueno";
    const cli = p.cliente_id ? `id:${p.cliente_id}` : `n:${String(p.cliente_nombre || "").trim().toLowerCase()}`;
    nombreCliente[cli] = p.cliente_nombre || "Cliente";
    const g = (global[m] ||= vacio());
    const pv = ((porVend[vend] ||= {})[m] ||= vacio());
    g.pedidos += 1;
    pv.pedidos += 1;
    g.clientes.add(cli);
    pv.clientes.add(cli);
    its.forEach((i: any) => {
      g.unidades[i.tipo] = (g.unidades[i.tipo] || 0) + Number(i.cantidad || 0);
      pv.unidades[i.tipo] = (pv.unidades[i.tipo] || 0) + Number(i.cantidad || 0);
      if (m === mes) {
        const cv = ((clientesVend[vend] ||= {})[cli] ||= {});
        cv[i.tipo] = (cv[i.tipo] || 0) + Number(i.cantidad || 0);
      }
    });
  });

  const actual = global[mes] || vacio();
  const previo = global[mesPrev] || vacio();
  const totalU = (r: Resumen) =>
    Object.values(r.unidades).reduce((a, b) => a + b, 0);

  // últimos 12 meses terminando en el mes elegido
  const meses: string[] = [];
  let cursor = mes;
  for (let i = 0; i < 12; i++) {
    meses.unshift(cursor);
    cursor = mesAnterior(cursor);
  }
  const maxU = Math.max(1, ...meses.map((m) => totalU(global[m] || vacio())));

  const vendedores = Object.keys(porVend).sort(
    (a, b) =>
      totalU(porVend[b][mes] || vacio()) - totalU(porVend[a][mes] || vacio())
  );
  const nomVend = (id: string) =>
    id === "sin-dueno" ? "Sin vendedor (datos viejos)" : nombrePerfil[id] || "Usuario";
  const vendSel =
    sp.vendedor && porVend[sp.vendedor] ? sp.vendedor : null;

  const dif = (a: number, b: number) => {
    const d = a - b;
    return d === 0 ? "igual que el mes anterior" : `${d > 0 ? "+" : ""}${d} vs. mes anterior`;
  };
  const q = (m: string, v?: string | null) =>
    `/estadisticas?mes=${m}${v ? `&vendedor=${v}` : ""}`;

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={perfil?.nombre || "Usuario"}
        apellido={perfil?.apellido || ""}
        rol={rol}
      />
      <main className="ml-0 md:ml-64 min-h-screen bg-slate-50 p-6 md:p-8 pt-20 md:pt-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Estadísticas de ventas
          </h1>
          <p className="mt-2 text-slate-600">
            Cuenta cada pedido cuando se carga para cortar, en el mes de esa
            carga. La venta es de quien cargó el remito.
          </p>

          {(e1 || e2) && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              No se pudieron leer los datos: {(e1 || e2)?.message}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              href={q(mesPrev, vendSel)}
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-100"
            >
              ← {nombreMes(mesPrev)}
            </Link>
            <span className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              {nombreMes(mes)}
            </span>
            {mes < hoy && (
              <Link
                href={q(
                  (() => {
                    const [y, mo] = mes.split("-").map(Number);
                    const d = new Date(Date.UTC(y, mo, 1));
                    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
                  })(),
                  vendSel
                )}
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-100"
              >
                Mes siguiente →
              </Link>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIPOS.map((t) => (
              <div key={t.key} className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">{t.label}</p>
                <p className="text-3xl font-bold text-slate-900">
                  {actual.unidades[t.key]}
                </p>
                <p className="text-xs text-slate-500">
                  {dif(actual.unidades[t.key], previo.unidades[t.key])}
                </p>
              </div>
            ))}
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Clientes distintos</p>
              <p className="text-3xl font-bold text-slate-900">
                {actual.clientes.size}
              </p>
              <p className="text-xs text-slate-500">
                {dif(actual.clientes.size, previo.clientes.size)}
              </p>
            </div>
          </div>

          {sinClasificar > 0 && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {sinClasificar} {sinClasificar === 1 ? "pedido de este mes no tiene" : "pedidos de este mes no tienen"} tipo
              cargado (pedidos anteriores al cambio). No se cuentan.
            </p>
          )}

          <section className="mt-8 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Últimos 12 meses
            </h2>
            <div className="mt-4 space-y-2">
              {meses.map((m) => {
                const r = global[m] || vacio();
                const t = totalU(r);
                return (
                  <Link
                    key={m}
                    href={q(m, vendSel)}
                    className="flex items-center gap-3 text-sm hover:bg-slate-50"
                  >
                    <span className={`w-32 shrink-0 ${m === mes ? "font-bold" : "text-slate-600"}`}>
                      {nombreMes(m)}
                    </span>
                    <span className="h-4 flex-1 rounded bg-slate-100">
                      <span
                        className="block h-4 rounded bg-blue-600"
                        style={{ width: `${(t / maxU) * 100}%` }}
                      />
                    </span>
                    <span className="w-28 shrink-0 text-right text-slate-700">
                      {t} un. / {r.clientes.size} cli.
                    </span>
                  </Link>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              un. = unidades vendidas (cortinas, portones y reparaciones). cli. = clientes distintos.
            </p>
          </section>

          <section className="mt-8 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Por vendedor, {nombreMes(mes)}
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-3">Vendedor</th>
                    <th className="px-2">Cortinas</th>
                    <th className="px-2">Lama</th>
                    <th className="px-2">Repar.</th>
                    <th className="px-2">Clientes</th>
                    <th className="pl-2">Mes anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {vendedores.map((v) => {
                    const r = porVend[v][mes] || vacio();
                    const p = porVend[v][mesPrev] || vacio();
                    return (
                      <tr key={v} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <Link
                            href={q(mes, v)}
                            className="font-medium text-blue-700 hover:underline"
                          >
                            {nomVend(v)}
                          </Link>
                        </td>
                        <td className="px-2">{r.unidades.CORTINA}</td>
                        <td className="px-2">{r.unidades.PORTON_LAMA}</td>
                        <td className="px-2">{r.unidades.REPARACION}</td>
                        <td className="px-2">{r.clientes.size}</td>
                        <td className="pl-2 text-slate-500">
                          {totalU(p)} un. / {p.clientes.size} cli.
                        </td>
                      </tr>
                    );
                  })}
                  {vendedores.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-slate-500">
                        Todavía no hay pedidos con tipo cargado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {vendSel && (
            <section className="mt-8 rounded-xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                {nomVend(vendSel)}
              </h2>
              {(() => {
                const r = porVend[vendSel][mes] || vacio();
                return (
                  <p className="mt-1 text-slate-700">
                    {nombreMes(mes)}: {totalU(r)}{" "}
                    {totalU(r) === 1 ? "unidad" : "unidades"} a{" "}
                    {r.clientes.size}{" "}
                    {r.clientes.size === 1 ? "cliente" : "clientes"}
                  </p>
                );
              })()}
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2">Mes</th>
                    <th>Unidades</th>
                    <th>Clientes</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.slice(-6).reverse().map((m) => {
                    const r = porVend[vendSel][m] || vacio();
                    return (
                      <tr key={m} className="border-b last:border-0">
                        <td className="py-2">{nombreMes(m)}</td>
                        <td>{totalU(r)}</td>
                        <td>{r.clientes.size}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <h3 className="mt-5 font-semibold text-slate-900">
                Clientes de {nombreMes(mes)}
              </h3>
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {Object.entries(clientesVend[vendSel] || {}).map(([c, tipos]) => (
                  <li key={c} className="flex justify-between gap-3 py-2">
                    <span>{nombreCliente[c]}</span>
                    <span className="text-slate-600">
                      {TIPOS.filter((t) => tipos[t.key])
                        .map((t) => `${tipos[t.key]} ${t.label.toLowerCase()}`)
                        .join(", ")}
                    </span>
                  </li>
                ))}
                {Object.keys(clientesVend[vendSel] || {}).length === 0 && (
                  <li className="py-2 text-slate-500">Sin ventas este mes.</li>
                )}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
