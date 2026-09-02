"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/cliente";
import { useRouter } from "next/navigation";
import { Factory, UserCog } from "lucide-react";

type Usuario = {
  id: string;
  nombre: string;
  apellido: string | null;
  rol: string;
};

type Props = {
  solicitudId: number;
  usuarios: Usuario[];
  asignacion?: {
    usuario_id: string;
    tipo: string;
  } | null;
};

export default function AsignarSolicitud({
  solicitudId,
  usuarios,
  asignacion,
}: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [usuarioId, setUsuarioId] = useState(
    asignacion?.usuario_id || ""
  );

  const [tipo, setTipo] = useState(
    asignacion?.tipo || "TECNICO"
  );

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const usuariosFiltrados = usuarios.filter(
    (usuario) => usuario.rol === tipo
  );

  async function asignar() {
    if (!usuarioId) {
      setMensaje(
        tipo === "FABRICA"
          ? "Seleccioná un usuario de fábrica."
          : "Seleccioná un técnico."
      );
      return;
    }

    setGuardando(true);
    setMensaje("");

    const { error } = await supabase.rpc(
      "asignar_solicitud",
      {
        p_solicitud_id: solicitudId,
        p_usuario_id: usuarioId,
        p_tipo: tipo,
      }
    );

    if (error) {
      console.error(error);

      setMensaje(
        `Error al asignar: ${error.message}`
      );

      setGuardando(false);
      return;
    }

    setMensaje(
      tipo === "FABRICA"
        ? "Trabajo enviado a fábrica correctamente."
        : "Trabajo asignado al técnico correctamente."
    );

    setGuardando(false);

    router.refresh();
  }

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 p-5 lg:w-80">
      <h3 className="mb-4 text-lg font-bold text-gray-900">
        Asignar trabajo
      </h3>

      {/* TIPO */}

      <label className="mb-2 block text-sm font-medium text-gray-700">
        Destino del trabajo
      </label>

      <select
        value={tipo}
        onChange={(e) => {
          setTipo(e.target.value);
          setUsuarioId("");
          setMensaje("");
        }}
        className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-gray-900"
      >
        <option value="TECNICO">
          👷 Técnico
        </option>

        <option value="FABRICA">
          🏭 Fábrica
        </option>
      </select>

      {/* USUARIO */}

      <label className="mb-2 block text-sm font-medium text-gray-700">
        {tipo === "FABRICA"
          ? "Usuario de fábrica"
          : "Técnico"}
      </label>

      {usuariosFiltrados.length === 0 ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          {tipo === "FABRICA" ? (
            <>
              No hay usuarios con el rol{" "}
              <strong>FABRICA</strong>.
            </>
          ) : (
            <>
              No hay usuarios con el rol{" "}
              <strong>TECNICO</strong>.
            </>
          )}
        </div>
      ) : (
        <select
          value={usuarioId}
          onChange={(e) =>
            setUsuarioId(e.target.value)
          }
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-gray-900"
        >
          <option value="">
            Seleccionar...
          </option>

          {usuariosFiltrados.map((usuario) => (
            <option
              key={usuario.id}
              value={usuario.id}
            >
              {usuario.nombre}{" "}
              {usuario.apellido || ""}
            </option>
          ))}
        </select>
      )}

      {/* INFO DEL DESTINO */}

      <div className="mt-4 rounded-lg bg-white p-3 text-sm text-gray-600">
        {tipo === "FABRICA" ? (
          <div className="flex gap-2">
            <Factory
              size={18}
              className="mt-0.5 shrink-0"
            />

            <p>
              El trabajo será enviado a fábrica.
              Allí podrán cambiar su estado a{" "}
              <strong>En fabricación</strong>,{" "}
              <strong>Faltantes</strong> o{" "}
              <strong>Listo para colocar</strong>.
            </p>
          </div>
        ) : (
          <div className="flex gap-2">
            <UserCog
              size={18}
              className="mt-0.5 shrink-0"
            />

            <p>
              El técnico podrá ver el trabajo
              asignado y completarlo cuando termine.
            </p>
          </div>
        )}
      </div>

      {/* BOTÓN */}

      <button
        onClick={asignar}
        disabled={
          guardando ||
          !usuarioId
        }
        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {guardando
          ? "Asignando..."
          : tipo === "FABRICA"
          ? "Enviar a fábrica"
          : "Asignar técnico"}
      </button>

      {mensaje && (
        <p className="mt-3 rounded-lg bg-white p-3 text-sm text-gray-600">
          {mensaje}
        </p>
      )}
    </div>
  );
}