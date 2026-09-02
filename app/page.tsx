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
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
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

        <p className="mt-6 text-center text-xs text-slate-400">
          Sistema de gestión · Cortinas Metálicas
        </p>
      </div>
    </main>
  );
}