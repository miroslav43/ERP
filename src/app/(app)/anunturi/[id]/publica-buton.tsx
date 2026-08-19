"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { publicaAnunt } from "../actions";

export function PublicaButon({ id }: { readonly id: string }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={inCurs}
        onClick={() => {
          setEroare(null);
          porneste(async () => {
            const rezultat = await publicaAnunt({ id });
            if (!rezultat.ok) {
              setEroare(rezultat.error.message);
              return;
            }
            router.refresh();
          });
        }}
        className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
      >
        {inCurs ? "Se publică…" : "Publică acum"}
      </button>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-sm">
          {eroare}
        </p>
      )}
    </div>
  );
}
