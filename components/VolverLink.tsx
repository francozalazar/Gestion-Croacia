"use client";

import { useRouter } from "next/navigation";

export default function VolverLink({
  fallback,
  className,
}: {
  fallback: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      className={className || "text-sm text-slate-500 hover:text-slate-800"}
    >
      ← Volver
    </button>
  );
}
