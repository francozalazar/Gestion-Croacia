"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/cliente";
import { cargarMotoresTrabajoAction } from "./actions";

type Tecnico = { id: string; nombre: string | null; apellido: string | null };
type Motor = { id: number; nombre: string; cantidad: number };
type Trabajo = {
  clave: string;
  id: number;
  esFabrica: boolean;
  numero: string | number;
  cliente: string;
  direccion: string;
  estado: string;
  prioridad: number | null;
  descontados: { motor: string; cantidad: number }[];
};
type Linea = { motor_id: string; cantidad: string };

const campo =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-900";

function hoyArgentina() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

export default function CargaPorTecnico({ tecnicos, motores }: { tecnicos: Tecnico[]; motores: Motor[] }) {
  const supabase = createClient();
  const [tecnicoId, setTecnicoId] = useState(tecnicos[0]?.id || "");
  const [fecha, setFecha] = useState(hoyArgentina());
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([{ motor_id: "", cantidad: "1" }]);
  const [operacion, setOperacion] = useState("");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const cargar = useCallback(async () => {
    if (!tecnicoId || !fecha) return;
    setCargando(true);
    setError("");
    const { data: asigs, error: e1 } = await supabase
      .from("asignaciones")
      .select("solicitud_id, solicitud_fabrica_id, prioridad")
      .eq("usuario_id", tecnicoId)
      .eq("fecha", fecha);
    if (e1) {
      setError("No se pudo cargar los trabajos.");
      setTrabajos([]);
      setCargando(false);
      return;
    }
    const lista = asigs || [];
    // Un trabajo con pedido de fabrica puede estar asignado por el pedido o por la solicitud
    // vinculada: se junta todo en una sola fila por pedido (sin duplicar).
    const idsSolAsig = lista.map((a) => a.solicitud_id).filter(Boolean) as number[];
    const { data: solAsig } = idsSolAsig.length
      ? await supabase.from("solicitudes").select("*").in("id", idsSolAsig)
      : { data: [] as any[] };
    const solicitudesAsig = solAsig || [];
    const idsSol = solicitudesAsig.filter((s: any) => !s.solicitud_fabrica_id).map((s: any) => s.id) as number[];
    const idsFab = [
      ...new Set([
        ...(lista.map((a) => a.solicitud_fabrica_id).filter(Boolean) as number[]),
        ...(solicitudesAsig.filter((s: any) => s.solicitud_fabrica_id).map((s: any) => s.solicitud_fabrica_id) as number[]),
      ]),
    ];
    const sol = { data: solicitudesAsig.filter((s: any) => !s.solicitud_fabrica_id) };
    const [fab, movSol, movFab] = await Promise.all([
      idsFab.length ? supabase.from("solicitudes_fabrica").select("*").in("id", idsFab) : Promise.resolve({ data: [] as any[] }),
      idsSol.length
        ? supabase.from("stock_movimientos").select("motor_id, cantidad, solicitud_id").eq("tipo", "SALIDA").in("solicitud_id", idsSol)
        : Promise.resolve({ data: [] as any[] }),
      idsFab.length
        ? supabase.from("stock_movimientos").select("motor_id, cantidad, solicitud_fabrica_id").eq("tipo", "SALIDA").in("solicitud_fabrica_id", idsFab)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const nombreMotor = (id: number) => motores.find((m) => m.id === id)?.nombre || "Motor";
    const resumen = (filas: any[]) => {
      const mapa = new Map<number, number>();
      filas.forEach((f) => mapa.set(f.motor_id, (mapa.get(f.motor_id) || 0) + f.cantidad));
      return [...mapa.entries()].map(([id, cantidad]) => ({ motor: nombreMotor(id), cantidad }));
    };
    const prio = (a: any) => a?.prioridad ?? null;
    const normales: Trabajo[] = (sol.data || []).map((s: any) => ({
      clave: `s-${s.id}`,
      id: s.id,
      esFabrica: false,
      numero: s.numero || s.id,
      cliente: s.cliente_nombre || "Cliente sin nombre",
      direccion: s.direccion || "",
      estado: s.estado || "",
      prioridad: prio(lista.find((a) => a.solicitud_id === s.id)),
      descontados: resumen((movSol.data || []).filter((m: any) => m.solicitud_id === s.id)),
    }));
    const deFabrica: Trabajo[] = (fab.data || []).map((s: any) => ({
      clave: `f-${s.id}`,
      id: s.id,
      esFabrica: true,
      numero: s.numero_remito || s.numero || s.id,
      cliente: s.cliente_nombre || "Cliente sin nombre",
      direccion: s.direccion || "",
      estado: s.estado || "",
      prioridad: prio(
        lista.find((a) => String(a.solicitud_fabrica_id) === String(s.id)) ||
          lista.find((a) => solicitudesAsig.some((x: any) => x.id === a.solicitud_id && String(x.solicitud_fabrica_id) === String(s.id)))
      ),
      descontados: resumen((movFab.data || []).filter((m: any) => m.solicitud_fabrica_id === s.id)),
    }));
    const todos = [...normales, ...deFabrica]
      .filter((t) => t.estado !== "ANULADO")
      .sort((a, b) => (a.prioridad ?? 9999) - (b.prioridad ?? 9999));
    setTrabajos(todos);
    setCargando(false);
  }, [supabase, tecnicoId, fecha, motores]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrir(t: Trabajo) {
    setAbierto(abierto === t.clave ? null : t.clave);
    setLineas([{ motor_id: "", cantidad: "1" }]);
    setOperacion(crypto.randomUUID());
    setMensaje(null);
  }

  function guardar(t: Trabajo) {
    const items = lineas
      .filter((l) => l.motor_id)
      .map((l) => ({ motor_id: Number(l.motor_id), cantidad: Number(l.cantidad) }));
    if (!items.length) {
      setMensaje({ ok: false, texto: "Elegí al menos un modelo." });
      return;
    }
    iniciar(async () => {
      const res = await cargarMotoresTrabajoAction({
        operacion,
        tecnicoId,
        solicitudId: t.esFabrica ? null : t.id,
        pedidoId: t.esFabrica ? t.id : null,
        items,
      });
      setMensaje({ ok: res.ok, texto: res.mensaje });
      if (res.ok) {
        setLineas([{ motor_id: "", cantidad: "1" }]);
        setOperacion(crypto.randomUUID());
        await cargar();
      }
    });
  }

  return (
    <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Motores usados por técnico</h2>
      <p className="mt-1 mb-4 text-sm text-slate-600">
        Elegí el técnico y el día, abrí un trabajo y cargá cada modelo con su cantidad.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Técnico</label>
          <select className={campo} value={tecnicoId} onChange={(e) => { setTecnicoId(e.target.value); setAbierto(null); }}>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>{`${t.nombre || ""} ${t.apellido || ""}`.trim() || "Sin nombre"}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Día</label>
          <input type="date" className={campo} value={fecha} onChange={(e) => { setFecha(e.target.value); setAbierto(null); }} />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {cargando && <p className="text-sm text-slate-500">Cargando trabajos...</p>}
        {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-800">{error}</p>}
        {!cargando && !error && trabajos.length === 0 && (
          <p className="text-sm text-slate-600">Ese técnico no tiene trabajos asignados ese día.</p>
        )}
        {trabajos.map((t) => (
          <div key={t.clave} className="rounded-xl border border-slate-200">
            <button type="button" onClick={() => abrir(t)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Trabajo #{t.numero} · {t.cliente}
                </p>
                <p className="text-xs text-slate-500">
                  {t.direccion || "Sin dirección"} · {t.estado.replaceAll("_", " ").toLowerCase()}
                  {t.descontados.length > 0 && ` · Ya descontado: ${t.descontados.map((d) => `${d.cantidad} ${d.motor}`).join(", ")}`}
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{abierto === t.clave ? "Cerrar" : "Cargar motores"}</span>
            </button>
            {abierto === t.clave && (
              <div className="border-t border-slate-200 p-3">
                {t.descontados.length > 0 && (
                  <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    Ya descontado en este trabajo: {t.descontados.map((d) => `${d.cantidad} × ${d.motor}`).join(", ")}. Lo que cargues ahora se suma aparte.
                  </p>
                )}
                <div className="space-y-2">
                  {lineas.map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_90px] gap-2">
                      <select className={campo} value={l.motor_id} onChange={(e) => setLineas(lineas.map((x, k) => (k === i ? { ...x, motor_id: e.target.value } : x)))}>
                        <option value="">Modelo</option>
                        {motores.map((m) => (
                          <option key={m.id} value={m.id}>{`${m.nombre} (hay ${m.cantidad})`}</option>
                        ))}
                      </select>
                      <input type="number" min={1} step={1} className={campo} value={l.cantidad} aria-label="Cantidad"
                        onChange={(e) => setLineas(lineas.map((x, k) => (k === i ? { ...x, cantidad: e.target.value } : x)))} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setLineas([...lineas, { motor_id: "", cantidad: "1" }])}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Agregar otro modelo
                  </button>
                  <button type="button" disabled={pendiente} onClick={() => guardar(t)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                    {pendiente ? "Guardando..." : "Descontar del stock"}
                  </button>
                </div>
                {mensaje && (
                  <p className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${mensaje.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                    {mensaje.texto}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
