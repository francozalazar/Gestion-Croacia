"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/cliente";
import { useRouter } from "next/navigation";

interface Props {
  solicitudId: number;
  estado: string;
  trabajoRealizado: string | null;
  observacionesTecnico: string | null;
  firmaCliente: string | null;
  aclaracionCliente: string | null;
}

export default function CompletarTrabajo({
  solicitudId,
  estado,
  trabajoRealizado,
  observacionesTecnico,
  firmaCliente,
  aclaracionCliente,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dibujando = useRef(false);

  const [trabajo, setTrabajo] = useState(
    trabajoRealizado || ""
  );

  const [observaciones, setObservaciones] = useState(
    observacionesTecnico || ""
  );

  const [firma, setFirma] = useState(
    firmaCliente || ""
  );

  const [aclaracion, setAclaracion] = useState(
    aclaracionCliente || ""
  );

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const finalizado = estado === "FINALIZADO";

  function obtenerCoordenadas(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();

    return {
      x:
        ((e.clientX - rect.left) / rect.width) *
        canvas.width,
      y:
        ((e.clientY - rect.top) / rect.height) *
        canvas.height,
    };
  }

  function comenzarFirma(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    if (finalizado) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    dibujando.current = true;

    canvas.setPointerCapture(e.pointerId);

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const { x, y } = obtenerCoordenadas(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function dibujarFirma(
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    if (!dibujando.current || finalizado) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const { x, y } = obtenerCoordenadas(e);

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function terminarFirma() {
    dibujando.current = false;
  }

  function limpiarFirma() {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    setFirma("");
  }

  function firmaEstaVacia() {
    const canvas = canvasRef.current;

    if (!canvas) return true;

    const ctx = canvas.getContext("2d");

    if (!ctx) return true;

    const imagen = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

    return !imagen.data.some(
      (valor, indice) =>
        indice % 4 === 3 && valor !== 0
    );
  }

  async function finalizarTrabajo() {
    if (!trabajo.trim()) {
      setMensaje(
        "Completá el campo 'Trabajo realizado'."
      );
      return;
    }

    if (firmaEstaVacia() && !firma) {
      setMensaje(
        "El cliente debe firmar en el recuadro."
      );
      return;
    }

    if (!aclaracion.trim()) {
      setMensaje(
        "Ingresá la aclaración del cliente."
      );
      return;
    }

    setGuardando(true);
    setMensaje("");

    let firmaFinal = firma;

    const canvas = canvasRef.current;

    if (canvas && !firmaEstaVacia()) {
      firmaFinal = canvas.toDataURL("image/png");
    }

    const { error } = await supabase
      .from("solicitudes")
      .update({
        trabajo_realizado: trabajo,
        observaciones_tecnico: observaciones,
        firma_cliente: firmaFinal,
        aclaracion_cliente: aclaracion,
        estado: "FINALIZADO",
        fecha_finalizacion:
          new Date().toISOString(),
      })
      .eq("id", solicitudId);

    if (error) {
      console.error(error);

      setMensaje(
        `Error al finalizar: ${error.message}`
      );

      setGuardando(false);
      return;
    }

    setMensaje(
      "Trabajo finalizado correctamente."
    );

    setGuardando(false);

    router.refresh();
  }

  // Clases estandarizadas para los inputs/textareas
  const inputClassName = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

  return (
    <div className="rounded-xl bg-white p-6 shadow">

      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">
          Completar trabajo
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Completá la información de la visita realizada.
        </p>
      </div>

      {/* TRABAJO REALIZADO */}
      <div className="mb-5">
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          ¿Qué trabajo se realizó?
        </label>

        <textarea
          value={trabajo}
          onChange={(e) =>
            setTrabajo(e.target.value)
          }
          disabled={finalizado}
          rows={5}
          placeholder="Ej: Se tomaron medidas finales de la abertura. Se verificó el estado de las guías..."
          className={inputClassName}
        />
      </div>

      {/* OBSERVACIONES */}
      <div className="mb-5">
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          Observaciones del técnico
        </label>

        <textarea
          value={observaciones}
          onChange={(e) =>
            setObservaciones(e.target.value)
          }
          disabled={finalizado}
          rows={4}
          placeholder="Problemas encontrados, medidas especiales, materiales necesarios, etc."
          className={inputClassName}
        />
      </div>

      {/* FIRMA */}
      <div className="border-t border-slate-200 pt-6">

        <h3 className="mb-4 text-lg font-bold text-slate-900">
          Conformidad del cliente
        </h3>

        <div className="mb-5">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Firma del cliente
          </label>

          <div className="overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white">
            <canvas
              ref={canvasRef}
              width={800}
              height={300}
              onPointerDown={comenzarFirma}
              onPointerMove={dibujarFirma}
              onPointerUp={terminarFirma}
              onPointerCancel={terminarFirma}
              className={`block h-48 w-full touch-none ${finalizado ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>

          {!finalizado && (
            <button
              type="button"
              onClick={limpiarFirma}
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
            >
              Borrar firma
            </button>
          )}

          <p className="mt-2 text-xs text-slate-500">
            El cliente puede firmar con el dedo, lápiz o mouse.
          </p>
        </div>

        {/* ACLARACIÓN */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Aclaración
          </label>

          <input
            type="text"
            value={aclaracion}
            onChange={(e) =>
              setAclaracion(e.target.value)
            }
            disabled={finalizado}
            placeholder="Nombre y apellido"
            className={inputClassName}
          />
        </div>
      </div>

      {/* BOTÓN */}
      {!finalizado && (
        <div className="mt-6">
          <button
            onClick={finalizarTrabajo}
            disabled={guardando}
            className="w-full rounded-xl bg-emerald-600 px-5 py-4 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando
              ? "Finalizando trabajo..."
              : "✓ Finalizar trabajo"}
          </button>
        </div>
      )}

      {/* MENSAJE */}
      {mensaje && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          {mensaje}
        </div>
      )}

      {finalizado && (
        <div className="mt-6 rounded-xl bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-800">
            ✓ Trabajo finalizado
          </p>

          <p className="mt-1 text-sm text-emerald-700">
            Este trabajo ya fue enviado como finalizado.
          </p>
        </div>
      )}
    </div>
  );
}