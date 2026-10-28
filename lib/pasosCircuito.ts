// Pasos del circuito que tocan varias tablas. Son llamadas separadas (no una
// transacción): el orden es primero la visita vinculada y al final el pedido que
// lo saca del listado, y si algo falla se deshace lo anterior para poder reintentar.
// Reciben el cliente de Supabase para poder probarse con un cliente simulado.
import { anularVisitas } from "./anularVisita";

export type ResultadoPaso = {
  ok: boolean;
  etapa?: string;
  error?: { message: string; code?: string } | null;
  deshecho?: boolean;
};

// Enviar a coordinación (Listos para colocar)
export async function enviarACoordinacionPasos(
  supabase: any,
  pedidoId: number,
  datos: Record<string, unknown>
): Promise<ResultadoPaso> {
  const visita = await supabase
    .from("solicitudes")
    .update(datos)
    .eq("solicitud_fabrica_id", pedidoId);
  if (visita.error) return { ok: false, etapa: "visita", error: visita.error };

  const pedido = await supabase
    .from("solicitudes_fabrica")
    .update(datos)
    .eq("id", pedidoId);
  if (pedido.error) return { ok: false, etapa: "pedido", error: pedido.error };
  return { ok: true };
}

// Asignar técnico en Coordinación
export async function asignarPasos(
  supabase: any,
  p: {
    id: number;
    esFabrica: boolean;
    tecnicoId: string;
    fecha: string;
    prioridad: number | null;
    datosActualizacion: Record<string, unknown>;
  }
): Promise<ResultadoPaso> {
  const columna = p.esFabrica ? "solicitud_fabrica_id" : "solicitud_id";
  const { data: previa } = await supabase
    .from("asignaciones")
    .select("*")
    .eq(columna, p.id)
    .maybeSingle();

  const datosAsig = {
    usuario_id: p.tecnicoId,
    fecha: p.fecha,
    tipo: "TECNICO",
    prioridad: p.prioridad,
  };

  let errAsig: any = null;
  if (p.esFabrica) {
    if (previa) {
      errAsig = (await supabase.from("asignaciones").update(datosAsig).eq("id", previa.id)).error;
    } else {
      errAsig = (
        await supabase
          .from("asignaciones")
          .insert({ solicitud_id: null, solicitud_fabrica_id: p.id, ...datosAsig })
      ).error;
    }
  } else {
    errAsig = (
      await supabase
        .from("asignaciones")
        .upsert(
          { solicitud_id: p.id, solicitud_fabrica_id: null, ...datosAsig },
          { onConflict: "solicitud_id" }
        )
    ).error;
  }
  if (errAsig) return { ok: false, etapa: "asignacion", error: errAsig };

  async function deshacer(): Promise<boolean> {
    if (previa) {
      const { id: _id, ...datosPrevios } = previa as any;
      const { error } = await supabase.from("asignaciones").update(datosPrevios).eq("id", previa.id);
      return !error;
    }
    const { data, error } = await supabase
      .from("asignaciones")
      .delete()
      .eq(columna, p.id)
      .select("id");
    return !error && !!data && data.length > 0;
  }

  let errPaso: any = null;
  let etapa = "";
  if (p.esFabrica) {
    errPaso = (
      await supabase.from("solicitudes").update(p.datosActualizacion).eq("solicitud_fabrica_id", p.id)
    ).error;
    etapa = "visita";
  }
  if (!errPaso) {
    errPaso = (
      await supabase
        .from(p.esFabrica ? "solicitudes_fabrica" : "solicitudes")
        .update(p.datosActualizacion)
        .eq("id", p.id)
    ).error;
    etapa = "pedido";
  }
  if (errPaso) {
    const deshecho = await deshacer();
    return { ok: false, etapa, error: errPaso, deshecho };
  }
  return { ok: true };
}

// Quitar asignación (vuelve a Coordinación) o anular visita, desde Recorrido.
export async function quitarOAnularPasos(
  supabase: any,
  p: {
    id: number;
    esFabrica: boolean;
    tecnicoId: string;
    fecha: string;
    accion: "QUITAR" | "ANULAR";
  }
): Promise<ResultadoPaso & { sinPermiso?: boolean }> {
  const columna = p.esFabrica ? "solicitud_fabrica_id" : "solicitud_id";
  const { data: borradas, error: errAsig } = await supabase
    .from("asignaciones")
    .delete()
    .eq(columna, p.id)
    .eq("usuario_id", p.tecnicoId)
    .eq("fecha", p.fecha)
    .select("*");
  if (errAsig) return { ok: false, etapa: "asignacion", error: errAsig };
  if (!borradas || borradas.length === 0) return { ok: false, etapa: "asignacion", sinPermiso: true };

  let err: any = null;
  let etapa = "";
  if (p.accion === "QUITAR") {
    const datos = { estado: "PENDIENTE_COORDINACION" };
    if (p.esFabrica) {
      err = (await supabase.from("solicitudes").update(datos).eq("solicitud_fabrica_id", p.id)).error;
      etapa = "visita";
    }
    if (!err) {
      err = (
        await supabase
          .from(p.esFabrica ? "solicitudes_fabrica" : "solicitudes")
          .update(datos)
          .eq("id", p.id)
      ).error;
      etapa = "pedido";
    }
  } else {
    if (p.esFabrica) {
      err = await anularVisitas(supabase, "solicitud_fabrica_id", p.id);
      etapa = "visita";
    }
    if (!err) {
      if (p.esFabrica) {
        err = (await supabase.from("solicitudes_fabrica").update({ estado: "ANULADO" }).eq("id", p.id)).error;
      } else {
        err = await anularVisitas(supabase, "id", p.id);
      }
      etapa = "pedido";
    }
  }

  if (err) {
    const filas = borradas.map(({ id: _id, ...resto }: any) => resto);
    const { error: errRestaurar } = await supabase.from("asignaciones").insert(filas);
    return { ok: false, etapa, error: err, deshecho: !errRestaurar };
  }
  return { ok: true };
}
