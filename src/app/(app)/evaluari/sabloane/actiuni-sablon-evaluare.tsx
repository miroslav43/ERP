// src/app/(app)/evaluari/sabloane/actiuni-sablon-evaluare.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";

import { Buton } from "@/components/ui/buton";

import { dezactiveazaSablonEvaluare } from "../actions";

export function ActiuniSablonEvaluare({ id }: { readonly id: string }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  return (
    <Buton
      varianta="distructiv"
      disabled={inCurs}
      onClick={() => {
        porneste(async () => {
          await dezactiveazaSablonEvaluare({ id });
          router.refresh();
        });
      }}
    >
      <Ban aria-hidden="true" className="size-3.5" />
      Dezactivează
    </Buton>
  );
}
