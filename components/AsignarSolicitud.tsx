"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/cliente";
import { useRouter } from "next/navigation";
import { UserCog } from "lucide-react";

type Usuario = {
  id: string;
  nombre: string;
  apellido: string | null;
  rol: string;
};

type Props = {
  solicitudId: number;
  numeroRemito?: number;
  fecha?: string | null;
  usuarios: Usuario[];
  asignacion?: {
    usuario_id: string;
    tipo: string;
  } | null;
};

export default function AsignarSolicitud({
  solicitudId,
  numeroRemito,
  fecha,
  usuarios,
  asignacion,
}: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [usuarioId, setUsuarioId] = useState(
    asignacion?.usuario_id || ""
  );
  const [fechaPactada, setFechaPactada] = useState(
    fecha || new Date().toISOString().split("T")[0]
  );
  const [prioridad, setPrioridad] = useState("3");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const tecnicos = usuarios.filter((usuario) => usuario.rol === "TECNICO");

  async function asignar() {
    if (!usuarioId) {
      setMensaje("Seleccioná un técnico.");
      return;
    }

    setGuardando(true);
    setMensaje("");

    // 1. Guardar la asignación incluyendo la fecha exacta
    const { error: errorAsignacion } = await supabase
      .from("asignaciones")
      .upsert(
        {
          solicitud_id: solicitudId,
          usuario_id: usuarioId,
          tipo: "TECNICO",
          fecha: fechaPactada,
          prioridad: Number(prioridad),
        },
        { onConflict: "solicitud_id" }
      );

    if (errorAsignacion) {
      await supabase.from("asignaciones").insert({
        solicitud_id: solicitudId,
        usuario_id: usuarioId,
        tipo: "TECNICO",
        fecha: fechaPactada,
        prioridad: Number(prioridad),
      });
    }

    // 2. Cambiar estado a ASIGNADO en la tabla solicitudes
    await supabase
      .from("solicitudes")
      .update({ estado: "ASIGNADO", fecha: fechaPactada })
      .eq("id", solicitudId);

    // 3. Cambiar estado a ASIGNADO en solicitudes_fabrica por id o numero_remito
    await supabase
      .from("solicitudes_fabrica")
      .update({ estado: "ASIGNADO", fecha: fechaPactada })
      .eq("id", solicitudId);

    if (numeroRemito) {
      await supabase
        .from("solicitudes_fabrica")
        .update({ estado: "ASIGNADO", fecha: fechaPactada })
        .eq("numero_remito", numeroRemito);
    }

    setMensaje("Trabajo asignado al técnico correctamente.");
    setGuardando(false);
    router.refresh();
  }

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 p-5 lg:w-80">
      <h3 className="mb-4 text-lg font-bold text-gray-900">
        Asignar a técnico
      </h3>

      <label className="mb-2 block text-sm font-medium text-gray-700">
        Fecha del trabajo
      </label>
      <input
        type="date"
        value={fechaPactada}
        onChange={(e) => setFechaPactada(e.target.value)}
        className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900"
      />

      <label className="mb-2 block text-sm font-medium text-gray-700">
        Técnico responsable
      </label>

      {tecnicos.length === 0 ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          No hay usuarios activos con el rol <strong>TECNICO</strong>.
        </div>
      ) : (
        <select
          value={usuarioId}
          onChange={(e) => setUsuarioId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-gray-900"
        >
          <option value="">Seleccionar técnico...</option>
          {tecnicos.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>
              {usuario.nombre} {usuario.apellido || ""}
            </option>
          ))}
        </select>
      )}

      <label className="mb-2 mt-4 block text-sm font-medium text-gray-700">
        Prioridad
      </label>
      <select
        value={prioridad}
        onChange={(e) => setPrioridad(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-gray-900"
      >
        <option value="1">1 - Urgente</option>
        <option value="2">2 - Alta</option>
        <option value="3">3 - Normal</option>
        <option value="4">4 - Baja</option>
        <option value="5">5 - Muy baja</option>
      </select>

      <div className="mt-4 rounded-lg bg-white p-3 text-sm text-gray-600">
        <div className="flex gap-2">
          <UserCog size={18} className="mt-0.5 shrink-0" />
          <p>
            Al asignar, el trabajo pasará al panel del técnico y al recorrido de camiones.
          </p>
        </div>
      </div>

      <button
        onClick={asignar}
        disabled={guardando || !usuarioId}
        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {guardando ? "Asignando..." : "Asignar técnico"}
      </button>

      {mensaje && (
        <p className="mt-3 rounded-lg bg-white p-3 text-sm text-gray-600">
          {mensaje}
        </p>
      )}
    </div>
  );
}