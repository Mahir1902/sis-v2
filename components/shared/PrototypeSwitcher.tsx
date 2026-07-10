"use client";

// PROTOTYPE — delete when invoicing prototype is resolved
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

interface Props {
  variants: string[];
  labels: Record<string, string>;
  current: string;
}

export function PrototypeSwitcher({ variants, labels, current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const go = useCallback(
    (key: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("variant", key);
      router.replace(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  const prev = useCallback(() => {
    const i = variants.indexOf(current);
    go(variants[(i - 1 + variants.length) % variants.length]);
  }, [variants, current, go]);

  const next = useCallback(() => {
    const i = variants.indexOf(current);
    go(variants[(i + 1) % variants.length]);
  }, [variants, current, go]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      const editable = (e.target as HTMLElement).isContentEditable;
      if (tag === "input" || tag === "textarea" || editable) return;
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next]);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-900 px-4 py-2 shadow-xl">
        <button
          type="button"
          onClick={prev}
          className="text-white/70 transition hover:text-white"
          aria-label="Previous variant"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          {variants.map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => go(v)}
              className={`rounded-full px-3 py-0.5 text-sm font-medium transition ${
                v === current
                  ? "bg-white text-gray-900"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {v} — {labels[v]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={next}
          className="text-white/70 transition hover:text-white"
          aria-label="Next variant"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
