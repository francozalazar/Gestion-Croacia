import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SolicitudesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Redirige directamente al Dashboard principal
  redirect("/dashboard");

  return null;
}