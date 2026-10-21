import Link from "next/link";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

const plata = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-AR");

export default async function SaldosPendientesPage() {
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

  const { data: ventas, error } = await supabase
    .from("ventas")
    .select(
      "id, cliente_id, total, creado_por, solicitud_fabrica_id, pagos(monto), clientes(nombre)"
    );
  const { data: pedidos } = await supabase
    .from("solicitudes_fabrica")
    .select("id, estado");
  const conVenta = new Set(
    (ventas || [])
      .map((v: any) => v.solicitud_fabrica_id)
      .filter((x: any) => x != null)
  );
  const pedidosSinVenta = (pedidos || []).filter(
    (p: any) => p.estado !== "ANULADO" && !conVenta.has(p.id)
  ).length;
  const { data: perfiles } = await supabase
    .from("profiles")
    .select("id, nombre, apellido");

  const nombrePerfil: Record<string, string> = {};
  (perfiles || []).forEach((p: any) => {
    nombrePerfil[p.id] =
      `${p.nombre || ""} ${p.apellido || ""}`.trim() || "Sin nombre";
  });

  // vendedor (quien cargó el remito) -> cliente -> saldo
  type Fila = { nombre: string; saldo: number; ventas: number };
  const porVendedor: Record<string, Record<string, Fila>> = {};
  let ventasEnCero = 0;

  (ventas || []).forEach((v: any) => {
    const total = Number(v.total || 0);
    if (total <= 0) ventasEnCero += 1;
    const pagado = (v.pagos || []).reduce(
      (a: number, p: any) => a + Number(p.monto || 0),
      0
    );
    const falta = total - pagado;
    const vend = v.creado_por || "sin-dueno";
    const cli = String(v.cliente_id);
    porVendedor[vend] = porVendedor[vend] || {};
    const f = (porVendedor[vend][cli] = porVendedor[vend][cli] || {
      nombre: v.clientes?.nombre || "Cliente",
      saldo: 0,
      ventas: 0,
    });
    f.saldo += falta;
    f.ventas += 1;
  });

  const vendedores = Object.entries(porVendedor)
    .map(([id, clientes]) => {
      const deudores = Object.entries(clientes)
        .filter(([, f]) => f.saldo > 0.5)
        .sort((a, b) => b[1].saldo - a[1].saldo);
      return {
        id,
        nombre:
          id === "sin-dueno"
            ? "Sin vendedor (datos viejos)"
            : nombrePerfil[id] || "Usuario",
        deudores,
        total: deudores.reduce((a, [, f]) => a + f.saldo, 0),
      };
    })
    .filter((v) => v.deudores.length > 0)
    .sort((a, b) => b.total - a.total);

  const totalGeneral = vendedores.reduce((a, v) => a + v.total, 0);
  const clientesGeneral = vendedores.reduce((a, v) => a + v.deudores.length, 0);

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
            Saldos pendientes
          </h1>
          <p className="mt-2 text-slate-600">
            Lo que deben los clientes, agrupado por quien cargó el remito.
            Se calcula con las ventas menos los pagos registrados.
          </p>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              No se pudieron leer las ventas: {error.message}
            </p>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total pendiente</p>
              <p className="text-2xl font-bold text-slate-900">
                {plata(totalGeneral)}
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Clientes que deben</p>
              <p className="text-2xl font-bold text-slate-900">
                {clientesGeneral}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {vendedores.length === 0 && (
              <p className="rounded-xl bg-white p-5 text-slate-600 shadow-sm">
                No hay saldos pendientes registrados.
              </p>
            )}
            {vendedores.map((v) => (
              <details
                key={v.id}
                className="rounded-xl bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-semibold text-slate-900">{v.nombre}</p>
                    <p className="text-sm text-slate-500">
                      {v.deudores.length}{" "}
                      {v.deudores.length === 1 ? "cliente debe" : "clientes deben"}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-red-700">
                    {plata(v.total)}
                  </p>
                </summary>
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {v.deudores.map(([cid, f]) => (
                    <li
                      key={cid}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <Link
                        href={`/clientes/${cid}`}
                        className="text-sm font-medium text-blue-700 hover:underline"
                      >
                        {f.nombre}
                        <span className="ml-2 text-xs text-slate-400">
                          {f.ventas} {f.ventas === 1 ? "venta" : "ventas"}
                        </span>
                      </Link>
                      <span className="text-sm font-semibold text-slate-900">
                        {plata(f.saldo)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>

          {pedidosSinVenta > 0 && (
            <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {pedidosSinVenta}{" "}
              {pedidosSinVenta === 1
                ? "pedido de fábrica no tiene"
                : "pedidos de fábrica no tienen"}{" "}
              venta registrada: su deuda no aparece acá porque no hay total
              ni pagos cargados en Clientes. Esta lista no es el total
              completo hasta revisarlos.
            </p>
          )}

          {ventasEnCero > 0 && (
            <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Hay {ventasEnCero} {ventasEnCero === 1 ? "venta" : "ventas"} con
              total en $0: no se pueden calcular (total desconocido), no son deuda cero.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
