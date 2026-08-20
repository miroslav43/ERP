// src/app/(app)/evaluari/sabloane/actiuni-sablon-evaluare.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";

import { dezactiveazaSablonEvaluare } from "../actions";

export function ActiuniSablonEvaluare({ id }: { readonly id: string }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  return (
    <button
      type="button"
      disabled={inCurs}
      onClick={() => {
        porneste(async () => {
          await dezactiveazaSablonEvaluare({ id });
          router.refresh();
        });
      }}
      className="text-danger hover:bg-danger/8 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Ban aria-hidden="true" className="size-3.5" />
      Dezactivează
    </button>
  );
}
