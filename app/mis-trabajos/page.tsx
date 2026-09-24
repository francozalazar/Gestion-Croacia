import { redirect } from "next/navigation";

// Pagina reemplazada por /trabajos. Redirigimos por si alguien la tenia guardada.
export default function MisTrabajosPage() {
  redirect("/trabajos");
}
