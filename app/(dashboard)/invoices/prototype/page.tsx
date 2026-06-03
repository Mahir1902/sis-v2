"use client";

// PROTOTYPE — Three variants of the invoicing page UI.
// Switchable via ?variant=A|B|C (default: A).
// Delete this route and its _components/ when a variant has been chosen.

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PrototypeSwitcher } from "@/components/shared/PrototypeSwitcher";
import { VariantA } from "./_components/VariantA";
import { VariantB } from "./_components/VariantB";
import { VariantC } from "./_components/VariantC";

const VARIANTS = ["A", "B", "C"];
const LABELS: Record<string, string> = {
  A: "Document view",
  B: "Kanban board",
  C: "Power table",
};

function InvoicePrototypeInner() {
  const searchParams = useSearchParams();
  const variant = searchParams.get("variant") ?? "A";

  return (
    <div className="relative p-6">
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      <PrototypeSwitcher
        variants={VARIANTS}
        labels={LABELS}
        current={variant}
      />
    </div>
  );
}

export default function InvoicePrototypePage() {
  return (
    <Suspense>
      <InvoicePrototypeInner />
    </Suspense>
  );
}
