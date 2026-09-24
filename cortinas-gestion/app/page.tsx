"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/cliente";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const scrollToEmpresa = () => {
    document.getElementById("empresa")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  async function handleLogin(e: FormEvent) {
    e.preventDefault();

    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  // Clases estandarizadas para los inputs
  const inputClassName = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

  return (
    <main className="min-h-screen bg-slate-100">
      <section className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white p-8 shadow-xl">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-2xl">
                🏠
              </div>

              <h1 className="text-2xl font-bold text-slate-900">
                Cortinas Gestión
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Sistema de gestión de trabajos
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  required
                  className={inputClassName}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Contraseña
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={inputClassName}
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={scrollToEmpresa}
              aria-label="Ir a la sección de empresa"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white text-xl text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:text-slate-900"
            >
              ↓
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Sistema de gestión · Cortinas Metálicas
          </p>
        </div>
      </section>

      <section id="empresa" className="bg-slate-900 px-6 py-20 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Empresa</p>
              <h2 className="mt-3 text-2xl font-bold">Gestión de obra y producción</h2>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Cobertura</p>
              <h3 className="mt-3 text-xl font-semibold">Manejo de clientes, trabajos y coordinación</h3>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Operación</p>
              <h3 className="mt-3 text-xl font-semibold">Seguimiento claro de estado en fábrica y finalizados</h3>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}