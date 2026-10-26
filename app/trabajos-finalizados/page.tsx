import { notFound } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { normalizarTipoVisita } from "@/lib/tipoVisita";
import TrabajosFinalizadosLista, {
  type TrabajoInstalado,
} from "@/components/TrabajosFinalizadosLista";

// Estados del pedido de fabrica anteriores a "Terminado".
const ENTRE_ETAPAS_FABRICA = [
  "PENDIENTE_APROBACION",
  "ENVIADO_A_CORTAR",
  "EN_CORTE",
  "EN_FABRICACION",
  "EN_FABRICA",
  "FALTANTES",
];

// Cierre del circuito: pedido de fabrica -> corte -> listo para colocar ->
// coordinacion -> el tecnico instalo y finalizo. Solo lee, no modifica nada.
export default async function TrabajosFinalizadosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  if (!profile || !["ADMIN", "OFICINA", "COORDINACION"].includes(profile.rol)) {
    notFound();
  }

  // Visitas ligadas a un pedido de fabrica que el tecnico ya finalizo.
  const { data: visitas } = await supabase
    .from("solicitudes")
    .select("id, solicitud_fabrica_id, tipo_visita, cliente_nombre, direccion, localidad, estado, fecha_finalizacion, tecnico_remito")
    .not("solicitud_fabrica_id", "is", null)
    .not("fecha_finalizacion", "is", null)
    .in("estado", ["FINALIZADO", "PENDIENTE_PRECIO", "PRESUPUESTADO"])
    .order("fecha_finalizacion", { ascending: false });

  // Solo visitas de instalacion (cortar e instalar / instalacion). Otras visitas
  // ligadas a fabrica (medicion, reclamo, etc.) no se cuentan como circuito completo.
  const lista = (visitas || []).filter((v) =>
    normalizarTipoVisita(v.tipo_visita).includes("instal")
  );
  const pedidoIds = [...new Set(lista.map((v) => v.solicitud_fabrica_id))];

  let pedidos: any[] = [];
  if (pedidoIds.length > 0) {
    const { data } = await supabase
      .from("solicitudes_fabrica")
      .select("id, numero_remito, cliente_nombre, creado_por, estado")
      .in("id", pedidoIds);
    pedidos = data || [];
  }

  const solicitudIds = lista.map((v) => v.id);
  let asignaciones: any[] = [];
  const filtrosAsig: string[] = [];
  if (solicitudIds.length > 0) filtrosAsig.push(`solicitud_id.in.(${solicitudIds.join(",")})`);
  if (pedidoIds.length > 0) filtrosAsig.push(`solicitud_fabrica_id.in.(${pedidoIds.join(",")})`);
  if (filtrosAsig.length > 0) {
    // La asignacion puede estar ligada a la visita o solo al pedido de fabrica.
    const { data } = await supabase
      .from("asignaciones")
      .select("solicitud_id, solicitud_fabrica_id, usuario_id")
      .or(filtrosAsig.join(","));
    asignaciones = data || [];
  }
  // Quien finalizo: autor de la foto guardada en la misma transaccion que fecha_finalizacion.
  let fotos: any[] = [];
  if (solicitudIds.length > 0) {
    const { data } = await supabase
      .from("fotos_trabajos")
      .select("solicitud_id, creado_por, created_at")
      .in("solicitud_id", solicitudIds);
    fotos = data || [];
  }
  const autorFinalizacion = (v: any): string | null => {
    const autores = [
      ...new Set(
        fotos
          .filter((f) => f.solicitud_id === v.id && f.created_at === v.fecha_finalizacion && f.creado_por)
          .map((f) => f.creado_por as string)
      ),
    ];
    return autores.length === 1 ? autores[0] : null;
  };
  const nombresTecnicos: Record<string, string> = {};
  const idsTec = [
    ...new Set([
      ...asignaciones.map((a) => a.usuario_id).filter(Boolean),
      ...lista.map(autorFinalizacion).filter(Boolean),
    ]),
  ] as string[];
  if (idsTec.length > 0) {
    const { data } = await supabase.from("profiles").select("id, nombre, apellido").in("id", idsTec);
    (data || []).forEach((p: any) => {
      nombresTecnicos[p.id] = [p.nombre, p.apellido].filter(Boolean).join(" ");
    });
  }

  // OFICINA ve solo los pedidos que cargo ella (creado_por del pedido de fabrica,
  // no de la visita, que la crea quien aprueba). ADMIN y COORDINACION ven todos.
  const trabajos: TrabajoInstalado[] = lista
    .map((v) => {
      const pedido = pedidos.find((p) => p.id === v.solicitud_fabrica_id);
      // Tecnico que realizo: autor comprobado de la finalizacion, o el nombre que cargo en el
      // remito. Si no hay prueba, se rotula "Asignado" solo con una asignacion unica; con
      // varias o ninguna no se elige una.
      const autor = autorFinalizacion(v);
      const asignados = [
        ...new Set(
          asignaciones
            .filter((a) => a.solicitud_id === v.id || a.solicitud_fabrica_id === v.solicitud_fabrica_id)
            .map((a) => a.usuario_id)
            .filter(Boolean)
        ),
      ] as string[];
      const tecnicoTexto =
        autor && nombresTecnicos[autor]
          ? nombresTecnicos[autor]
          : String(v.tecnico_remito || "").trim()
          ? String(v.tecnico_remito).trim()
          : asignados.length === 1 && nombresTecnicos[asignados[0]]
          ? `Asignado: ${nombresTecnicos[asignados[0]]}`
          : "";
      return {
        id: v.id,
        pedido: pedido?.numero_remito ?? v.solicitud_fabrica_id,
        cliente: pedido?.cliente_nombre || v.cliente_nombre || "Sin cliente",
        direccion: [v.direccion, v.localidad].filter(Boolean).join(" - "),
        fechaInstalacion: v.fecha_finalizacion as string | null,
        tecnico: tecnicoTexto,
        aviso: ENTRE_ETAPAS_FABRICA.includes(pedido?.estado)
          ? "Fábrica no marcó este pedido como Terminado"
          : "",
        creadoPor: pedido?.creado_por as string | undefined,
      };
    })
    .filter((t) => profile.rol !== "OFICINA" || t.creadoPor === user.id)
    .map(({ creadoPor, ...resto }) => resto);

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={profile.nombre}
        apellido={profile.apellido || ""}
        rol={profile.rol}
      />
      <main className="ml-0 md:ml-64 min-h-screen bg-slate-50 p-4 pt-20 md:p-8 md:pt-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/dashboard"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← Volver al inicio
          </Link>
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Trabajos finalizados
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Pedidos de fábrica con visita de instalación finalizada por el técnico. La fecha es la de finalización registrada en el remito, no una confirmación aparte de la obra.
            </p>
            {profile.rol === "OFICINA" && (
              <p className="mt-2 inline-block border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm text-blue-700">
                Mostrando los pedidos cargados por vos.
              </p>
            )}
          </div>
          <TrabajosFinalizadosLista trabajos={trabajos} />
        </div>
      </main>
    </div>
  );
}
