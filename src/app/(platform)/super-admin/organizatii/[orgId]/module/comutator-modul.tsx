// src/app/(platform)/super-admin/organizatii/[orgId]/module/comutator-modul.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { comutaModul } from "./actions";

type Proprietati = Readonly<{
  organizationId: string;
  featureKey: string;
  denumire: string;
  activInitial: boolean;
}>;

export function ComutatorModul({
  organizationId,
  featureKey,
  denumire,
  activInitial,
}: Proprietati) {
  const [activ, setActiv] = useState(activInitial);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, startTransition] = useTransition();
  const router = useRouter();
  const idStare = useId();

  function comuta(): void {
    const dorit = !activ;
    setEroare(null);
    setMesaj(null);
    startTransition(async () => {
      const rezultat = await comutaModul({ organizationId, featureKey, enabled: dorit });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setActiv(rezultat.data.enabled);
      setMesaj(rezultat.data.mesaj);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={activ}
        aria-describedby={idStare}
        aria-label={`${activ ? "Dezactivează" : "Activează"} modulul ${denumire}`}
        disabled={inCurs}
        onClick={comuta}
        className={`border-border focus-visible:ring-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60 ${
          activ ? "bg-primary" : "bg-background"
        }`}
      >
        <span
          aria-hidden="true"
          className={`bg-surface inline-block h-4 w-4 transform rounded-full shadow transition-transform ${
            activ ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>

      <p id={idStare} aria-live="polite" className="text-muted-foreground text-right text-xs">
        {inCurs ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
            Se salvează…
          </span>
        ) : (
          (mesaj ?? (activ ? "Activ" : "Inactiv"))
        )}
      </p>

      {eroare ? (
        <p
          role="alert"
          className="text-danger inline-flex max-w-xs items-start gap-1 text-right text-xs"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
          {eroare}
        </p>
      ) : null}
    </div>
  );
}
