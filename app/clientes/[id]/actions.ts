"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function verificarAccesoCliente(clienteId: number) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autorizado");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  const esAdmin = perfil?.rol?.toUpperCase() === "ADMIN";

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, creado_por")
    .eq("id", clienteId)
    .single();

  if (!cliente) throw new Error("Cliente no encontrado");

  if (!esAdmin && cliente.creado_por && cliente.creado_por !== user.id) {
    throw new Error("No tenés acceso a este cliente");
  }

  return { supabase, user, esAdmin };
}

export async function crearVentaAction(formData: FormData) {
  const clienteId = Number(formData.get("clienteId"));
  const descripcion = String(formData.get("descripcion") || "").trim();
  const total = Number(formData.get("total") || 0);
  const direccionIdRaw = Number(formData.get("direccionId"));
  const nuevaDireccion = String(formData.get("nuevaDireccion") || "").trim();
  const nuevaLocalidad = String(formData.get("nuevaLocalidad") || "").trim();

  if (!clienteId || total < 0) return;

  const { supabase, user } = await verificarAccesoCliente(clienteId);

  let direccionId = direccionIdRaw || null;

  if (!direccionId && nuevaDireccion) {
    const { data: dir } = await supabase
      .from("direcciones")
      .insert({
        cliente_id: clienteId,
        direccion: nuevaDireccion,
        localidad: nuevaLocalidad || null,
      })
      .select("id")
      .single();
    direccionId = dir?.id ?? null;
  }

  const { error } = await supabase.from("ventas").insert({
    cliente_id: clienteId,
    direccion_id: direccionId,
    descripcion: descripcion || null,
    total,
    creado_por: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
}

export async function editarTotalVentaAction(formData: FormData) {
  const ventaId = Number(formData.get("ventaId"));
  const clienteId = Number(formData.get("clienteId"));
  const total = Number(formData.get("total") || 0);

  if (!ventaId || !clienteId || total < 0) return;

  const { supabase } = await verificarAccesoCliente(clienteId);

  const { error } = await supabase
    .from("ventas")
    .update({ total })
    .eq("id", ventaId);

  if (error) throw new Error(error.message);

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
}

export async function cargarPagoAction(formData: FormData) {
  const ventaId = Number(formData.get("ventaId"));
  const clienteId = Number(formData.get("clienteId"));
  const monto = Number(formData.get("monto") || 0);
  const fecha = String(formData.get("fecha") || "");
  const medio = String(formData.get("medio") || "").trim();
  const facturado = formData.get("facturado") === "on";
  const facturaUrl = String(formData.get("facturaUrl") || "").trim() || null;

  if (!ventaId || !clienteId || monto <= 0) return;

  const { supabase, user } = await verificarAccesoCliente(clienteId);

  const { error } = await supabase.from("pagos").insert({
    venta_id: ventaId,
    monto,
    fecha: fecha || undefined,
    medio: medio || null,
    facturado,
    factura_url: facturado ? facturaUrl : null,
    creado_por: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
}
