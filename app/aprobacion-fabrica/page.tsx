"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/cliente";

type SolicitudFabrica = {
  id: number;
  numero_remito: number;
  cliente_nombre: string;
  cliente_telefono: string | null;
  direccion: string;
  localidad: string | null;
  fecha: string | null;
  horario_desde: string | null;
  horario_hasta: string | null;
  tipo_visita: string | null;
  observaciones: string | null;
  total_pesos: number | null;
  saldo_restante: number | null;
  sena_porcentaje: number | null;
  sena_pesos: number | null;
  medio_pago: string | null;
  estado: string;
  created_at: string;
};

export default function AprobacionFabricaPage() {
  const supabase = createClient();

  const [solicitudes, setSolicitudes] = useState<SolicitudFabrica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  async function cargarSolicitudes() {
    setCargando(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("No hay una sesión iniciada.");
      setCargando(false);
      return;
    }

    // IMPORTANTE:
    // La tabla correcta en este proyecto es "profiles", no "perfiles".
    const { data: perfil, error: errorPerfil } = await supabase
      .from("profiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (errorPerfil) {
      console.error("ERROR PERFIL:", errorPerfil);
      setError(errorPerfil.message);
      setCargando(false);
      return;
    }

    if (perfil?.rol !== "ADMIN") {
      setError("No tenés permiso para acceder a esta sección.");
      setCargando(false);
      return;
    }

    const { data, error: errorSolicitudes } = await supabase
      .from("solicitudes_fabrica")
      .select("*")
      .order("created_at", { ascending: false });

    if (errorSolicitudes) {
      console.error("ERROR SOLICITUDES FABRICA:", errorSolicitudes);
      setError(errorSolicitudes.message);
      setCargando(false);
      return;
    }

    setSolicitudes(data || []);
    setCargando(false);
  }

  function formatoPesos(valor: number | null) {
    if (valor === null || valor === undefined) {
      return "-";
    }

    return `$ ${Number(valor).toLocaleString("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">

        <Link
          href="/dashboard"
          className="mb-6 inline-block text-sm text-slate-600 hover:text-slate-900"
        >
          ← Volver al inicio
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Aprobación de fábrica
          </h1>

          <p className="mt-2 text-slate-600">
            Solicitudes cargadas por Oficina pendientes de aprobación.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {cargando ? (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-slate-600">
              Cargando solicitudes...
            </p>
          </div>
        ) : solicitudes.length === 0 ? (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-slate-500">
              No hay solicitudes de fábrica cargadas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {solicitudes.map((solicitud) => (
              <Link
                key={solicitud.id}
                href={`/aprobacion-fabrica/${solicitud.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:shadow-md"
              >
                <div className="grid gap-4 md:grid-cols-5 md:items-center">

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Remito
                    </div>

                    <div className="text-lg font-bold text-slate-900">
                      Nº {solicitud.numero_remito}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Cliente
                    </div>

                    <div className="font-semibold text-slate-900">
                      {solicitud.cliente_nombre}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Total
                    </div>

                    <div className="font-semibold text-slate-900">
                      {formatoPesos(solicitud.total_pesos)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Saldo restante
                    </div>

                    <div className="font-semibold text-slate-900">
                      {formatoPesos(solicitud.saldo_restante)}
                    </div>
                  </div>

                  <div>
                    <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                      {solicitud.estado}
                    </span>
                  </div>

                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}