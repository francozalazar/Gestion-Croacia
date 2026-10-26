"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ResultadoStock = { ok: boolean; mensaje: string };

async function verificarAcceso() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Tu sesión venció. Entrá de nuevo." };

  const { data: yo } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  const rol = String(yo?.rol || "").toUpperCase();
  if (rol !== "ADMIN") {
    return { supabase, error: "Solo Administración maneja el stock." };
  }
  return { supabase, error: null as string | null };
}

export async function crearModeloAction(
  _prev: ResultadoStock | null,
  formData: FormData
): Promise<ResultadoStock> {
  const { supabase, error } = await verificarAcceso();
  if (error) return { ok: false, mensaje: error };

  const nombre = String(formData.get("nombre") || "").trim();
  const inicial = Number(formData.get("inicial") || 0);
  const minimo = Number(formData.get("minimo") || 0);

  if (!nombre) return { ok: false, mensaje: "Falta el nombre del modelo." };
  if (!Number.isInteger(inicial) || inicial < 0)
    return { ok: false, mensaje: "El stock inicial tiene que ser un número entero, 0 o más." };
  if (!Number.isInteger(minimo) || minimo < 0)
    return { ok: false, mensaje: "El mínimo tiene que ser un número entero, 0 o más." };

  const { data: motor, error: e1 } = await supabase
    .from("stock_motores")
    .insert({ nombre, cantidad: 0, minimo })
    .select("id")
    .single();
  if (e1 || !motor) {
    return {
      ok: false,
      mensaje: /duplicate|unique/i.test(e1?.message || "")
        ? "Ya existe un modelo con ese nombre."
        : "No se pudo crear el modelo. No se guardó nada.",
    };
  }

  if (inicial > 0) {
    const { error: e2 } = await supabase.from("stock_movimientos").insert({
      motor_id: motor.id,
      tipo: "INICIAL",
      cantidad: inicial,
      detalle: "Stock inicial",
    });
    if (e2) {
      return {
        ok: false,
        mensaje:
          "El modelo se creó pero no se pudo cargar el stock inicial. Cargalo como una entrada.",
      };
    }
  }

  revalidatePath("/stock");
  return {
    ok: true,
    mensaje: `Modelo "${nombre}" creado${inicial > 0 ? ` con ${inicial} unidades` : ""}.`,
  };
}

export async function registrarMovimientoAction(
  _prev: ResultadoStock | null,
  formData: FormData
): Promise<ResultadoStock> {
  const { supabase, error } = await verificarAcceso();
  if (error) return { ok: false, mensaje: error };

  const motorId = Number(formData.get("motor_id"));
  const tipo = String(formData.get("tipo") || "").toUpperCase();
  const cantidad = Number(formData.get("cantidad"));
  const detalle = String(formData.get("detalle") || "").trim();
  const pedidoRaw = String(formData.get("solicitud_fabrica_id") || "");

  if (!motorId) return { ok: false, mensaje: "Falta el motor." };
  if (!["ENTRADA", "SALIDA"].includes(tipo))
    return { ok: false, mensaje: "Tipo de movimiento inválido." };
  if (!Number.isInteger(cantidad) || cantidad <= 0)
    return { ok: false, mensaje: "La cantidad tiene que ser un número entero mayor a 0." };
  if (tipo === "SALIDA" && !detalle && !pedidoRaw)
    return { ok: false, mensaje: "Contá para qué se usó o elegí el trabajo." };

  const fila: Record<string, unknown> = {
    motor_id: motorId,
    tipo,
    cantidad,
    detalle: detalle || null,
  };
  if (tipo === "SALIDA" && pedidoRaw) fila.solicitud_fabrica_id = Number(pedidoRaw);

  const { error: e1 } = await supabase.from("stock_movimientos").insert(fila);
  if (e1) {
    return {
      ok: false,
      mensaje: /suficiente stock/i.test(e1.message)
        ? "No hay suficiente stock de ese motor para esa salida."
        : "No se pudo guardar el movimiento. El stock no cambió.",
    };
  }

  revalidatePath("/stock");
  return {
    ok: true,
    mensaje:
      tipo === "ENTRADA"
        ? `Entrada registrada: +${cantidad}.`
        : `Salida registrada: -${cantidad}.`,
  };
}

export async function actualizarMinimoAction(
  _prev: ResultadoStock | null,
  formData: FormData
): Promise<ResultadoStock> {
  const { supabase, error } = await verificarAcceso();
  if (error) return { ok: false, mensaje: error };

  const motorId = Number(formData.get("motor_id"));
  const minimo = Number(formData.get("minimo"));
  if (!motorId) return { ok: false, mensaje: "Falta el motor." };
  if (!Number.isInteger(minimo) || minimo < 0)
    return { ok: false, mensaje: "El mínimo tiene que ser un número entero, 0 o más." };

  const { error: e1 } = await supabase
    .from("stock_motores")
    .update({ minimo })
    .eq("id", motorId);
  if (e1) return { ok: false, mensaje: "No se pudo guardar el mínimo." };

  revalidatePath("/stock");
  return { ok: true, mensaje: "Mínimo actualizado." };
}

export async function cargarMotoresTrabajoAction(datos: {
  operacion: string;
  tecnicoId: string;
  solicitudId: number | null;
  pedidoId: number | null;
  items: { motor_id: number; cantidad: number }[];
}): Promise<ResultadoStock> {
  const { supabase, error } = await verificarAcceso();
  if (error) return { ok: false, mensaje: error };

  if (!datos.operacion || !datos.tecnicoId)
    return { ok: false, mensaje: "Faltan datos del envío. Volvé a abrir el trabajo." };
  if (Boolean(datos.solicitudId) === Boolean(datos.pedidoId))
    return { ok: false, mensaje: "No se pudo identificar el trabajo." };
  if (!datos.items.length)
    return { ok: false, mensaje: "Cargá al menos un modelo con su cantidad." };
  for (const it of datos.items) {
    if (!it.motor_id || !Number.isInteger(it.cantidad) || it.cantidad <= 0)
      return { ok: false, mensaje: "Cada motor necesita modelo y una cantidad entera mayor a 0." };
  }

  const { data, error: e1 } = await supabase.rpc("stock_cargar_motores_trabajo", {
    p_operacion: datos.operacion,
    p_tecnico: datos.tecnicoId,
    p_solicitud: datos.solicitudId,
    p_pedido: datos.pedidoId,
    p_items: datos.items,
  });
  if (e1) {
    return {
      ok: false,
      mensaje: /suficiente stock/i.test(e1.message)
        ? "No hay suficiente stock de uno de los motores. No se descontó nada."
        : /no está asignado/i.test(e1.message)
          ? "Ese trabajo ya no está asignado a ese técnico. Actualizá la lista."
          : "No se pudo guardar. No se descontó nada.",
    };
  }

  revalidatePath("/stock");
  const yaAplicado = Boolean((data as { ya_aplicado?: boolean } | null)?.ya_aplicado);
  return {
    ok: true,
    mensaje: yaAplicado
      ? "Esa carga ya estaba registrada; no se descontó de nuevo."
      : "Motores descontados del stock.",
  };
}
