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
  const [servit, setServit] = useState(activInitial);
  const [confirmare, setConfirmare] = useState<{ activ: boolean; text: string } | null>(null);
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, startTransition] = useTransition();
  const router = useRouter();
  const idStare = useId();

  /**
   * Serverul e sursa de adevăr, `useState` nu o știe.
   *
   * `useState(activInitial)` citește proprietatea O SINGURĂ DATĂ, la montare;
   * după `router.refresh()` — sau după „Pornește tot”, care schimbă starea a
   * cincisprezece comutatoare deodată — componenta primește altă valoare, iar
   * comutatorul continuă să deseneze ce ținea el minte. Comparația de mai jos e
   * tiparul din documentația React („adjusting state when a prop changes”):
   * se face ÎN TIMPUL randării, nu într-un `useEffect`, care ar mai desena o
   * dată ecranul cu starea veche înainte să-l corecteze.
   */
  if (servit !== activInitial) {
    setServit(activInitial);
    setActiv(activInitial);
    setEroare(null);
  }

  function comuta(): void {
    const dorit = !activ;
    setEroare(null);
    setConfirmare(null);
    startTransition(async () => {
      const rezultat = await comutaModul({ organizationId, featureKey, enabled: dorit });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setActiv(rezultat.data.enabled);
      setConfirmare({ activ: rezultat.data.enabled, text: rezultat.data.mesaj });
      router.refresh();
    });
  }

  // Confirmarea se leagă de starea pe care o descrie. Altfel „Modulul Pontaj a
  // fost activat” ar rămâne scris sub un comutator pe care „Oprește tot” tocmai
  // l-a stins.
  const eticheta =
    confirmare && confirmare.activ === activ ? confirmare.text : activ ? "Activ" : "Inactiv";

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
        className={`border-border disabled:border-border disabled:bg-surface disabled:text-muted-foreground relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed ${
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

      <p id={idStare} aria-live="polite" className="text-muted-foreground text-nota text-right">
        {inCurs ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
            Se salvează…
          </span>
        ) : (
          eticheta
        )}
      </p>

      {eroare ? (
        <p
          role="alert"
          className="text-danger text-nota inline-flex max-w-xs items-start gap-1 text-right"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
          {eroare}
        </p>
      ) : null}
    </div>
  );
}
