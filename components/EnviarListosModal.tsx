"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cargarContextoListosAction,
  enviarAListosAction,
  type ContextoListos,
} from "@/app/fabrica/enviarListosActions";

type Linea = { motor_id: string; cantidad: string };

export default function EnviarListosModal({
  pedidoId,
  onCerrar,
}: {
  pedidoId: number;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [ctx, setCtx] = useState<ContextoListos | null>(null);
  const [usaron, setUsaron] = useState<"" | "no" | "ya" | "si">("");
  const [lineas, setLineas] = useState<Linea[]>([{ motor_id: "", cantidad: "1" }]);
  const [error, setError] = useState("");
  const [enviando, start] = useTransition();

  useEffect(() => {
    cargarContextoListosAction(pedidoId).then(setCtx);
  }, [pedidoId]);

  function setLinea(i: number, parcial: Partial<Linea>) {
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...parcial } : l)));
  }

  function confirmar() {
    setError("");
    let items: { motor_id: number; cantidad: number }[] = [];
    if (usaron === "si") {
      items = lineas.map((l) => ({ motor_id: Number(l.motor_id), cantidad: Number(l.cantidad) }));
      if (items.some((i) => !i.motor_id || !Number.isInteger(i.cantidad) || i.cantidad <= 0)) {
        setError("Elegí el modelo y una cantidad entera mayor a 0 en cada línea.");
        return;
      }
    }
    start(async () => {
      const r = await enviarAListosAction(pedidoId, items);
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      onCerrar();
      router.refresh();
    });
  }

  const yaConf = ctx?.yaConfirmado;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">Enviar a Listos para colocar</h3>

        {!ctx && <p className="mt-4 text-sm text-slate-500">Cargando...</p>}
        {ctx && !ctx.ok && <p className="mt-4 text-sm text-red-600">{ctx.mensaje}</p>}

        {ctx?.ok && (
          <>
            {ctx.salidasPrevias.length > 0 && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold">Ya se descontó del stock para este trabajo:</p>
                <ul className="mt-1 list-disc pl-5">
                  {ctx.salidasPrevias.map((s, i) => (
                    <li key={i}>
                      {s.cantidad} × {s.motor}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {yaConf ? (
              <p className="mt-3 text-sm text-slate-600">
                Los motores de este trabajo ya se confirmaron antes. No se vuelve a descontar.
              </p>
            ) : (
              <>
                {ctx.salidasPrevias.length > 0 ? (
                  <>
                    <p className="mt-4 text-sm font-semibold text-slate-800">
                      ¿Qué hacemos con los motores de este trabajo?
                    </p>
                    <div className="mt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setUsaron("ya")}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold ${usaron === "ya" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
                      >
                        Lo ya descontado es todo, no sumo más
                      </button>
                      <button
                        type="button"
                        onClick={() => setUsaron("si")}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold ${usaron === "si" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
                      >
                        Usaron otros motores además: cargar adicionales
                      </button>
                    </div>
                    {usaron === "si" && (
                      <p className="mt-2 text-xs text-slate-500">
                        Lo que cargues abajo se descuenta como adicional, además de lo ya descontado.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mt-4 text-sm font-semibold text-slate-800">¿Usaron algún motor en este trabajo?</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setUsaron("no")}
                        className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${usaron === "no" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
                      >
                        No usamos motor
                      </button>
                      <button
                        type="button"
                        onClick={() => setUsaron("si")}
                        className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${usaron === "si" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
                      >
                        Sí, usamos
                      </button>
                    </div>
                  </>
                )}

                {usaron === "si" && (
                  <div className="mt-3 space-y-2">
                    {ctx.motores.length === 0 && (
                      <p className="text-sm text-amber-700">No hay modelos cargados en Stock de motores.</p>
                    )}
                    {lineas.map((l, i) => (
                      <div key={i} className="flex gap-2">
                        <select
                          value={l.motor_id}
                          onChange={(e) => setLinea(i, { motor_id: e.target.value })}
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 p-2 text-sm"
                        >
                          <option value="">Modelo</option>
                          {ctx.motores.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nombre} (hay {m.cantidad})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={l.cantidad}
                          onChange={(e) => setLinea(i, { cantidad: e.target.value })}
                          className="w-20 rounded-xl border border-slate-200 p-2 text-sm"
                        />
                        {lineas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))}
                            className="px-2 text-slate-400 hover:text-slate-700"
                            aria-label="Quitar"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setLineas((ls) => [...ls, { motor_id: "", cantidad: "1" }])}
                      className="text-sm font-semibold text-blue-700"
                    >
                      + Agregar otro motor
                    </button>
                  </div>
                )}
              </>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCerrar}
                disabled={enviando}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={enviando || (!yaConf && usaron === "")}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {enviando ? "Enviando..." : "Confirmar y enviar"}
              </button>
            </div>
          </>
        )}
        {ctx && !ctx.ok && (
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onCerrar} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
