// src/app/(platform)/super-admin/organizatii/[orgId]/module/comutator-toate.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, PowerOff, Zap } from "lucide-react";

import { Buton } from "@/components/ui/buton";

import { comutaToateModulele } from "./actions";

type Proprietati = Readonly<{
  organizationId: string;
  /** Câte module NECOMUTABILE-de-nucleu are catalogul, adică pe câte lucrează butoanele. */
  comutabile: number;
  /** Câte dintre ele sunt acum active. */
  active: number;
}>;

/**
 * Pornește tot / Oprește tot.
 *
 * Pornirea se aplică direct: adaugă acces, se întoarce dintr-un clic. Oprirea
 * cere confirmare — stinge dintr-o dată meniul întregii firme, iar butonul stă
 * la doi centimetri de celălalt. Aceeași asimetrie ca la acțiunile de
 * organizație: „Activează” imediat, „Suspendă” după un pas în plus.
 */
export function ComutatorToate({ organizationId, comutabile, active }: Proprietati) {
  const [confirmaOprirea, setConfirmaOprirea] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, startTransition] = useTransition();
  const router = useRouter();

  function comuta(enabled: boolean): void {
    setEroare(null);
    setMesaj(null);
    startTransition(async () => {
      const rezultat = await comutaToateModulele({ organizationId, enabled });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setConfirmaOprirea(false);
      setMesaj(rezultat.data.mesaj);
      router.refresh();
    });
  }

  const toateActive = active >= comutabile;
  const toateInactive = active === 0;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {confirmaOprirea ? (
        <div className="border-danger bg-surface flex max-w-sm flex-col gap-2 rounded-xl border p-3">
          <p className="text-foreground text-corp">
            Oprești toate cele {active} module active? Utilizatorii firmei pierd imediat accesul la
            ecranele lor; datele rămân în bază.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Buton
              varianta="tertiar"
              disabled={inCurs}
              onClick={() => {
                setConfirmaOprirea(false);
                setEroare(null);
              }}
            >
              Renunță
            </Buton>
            <Buton
              varianta="distructiv"
              inCurs={inCurs}
              textInCurs="Se oprește…"
              onClick={() => comuta(false)}
            >
              Da, oprește tot
            </Buton>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Buton
            varianta="primar"
            inCurs={inCurs}
            textInCurs="Se salvează…"
            disabled={toateActive}
            title={toateActive ? "Toate modulele sunt deja active." : undefined}
            onClick={() => comuta(true)}
          >
            <Zap aria-hidden="true" className="h-4 w-4" />
            Pornește tot
          </Buton>
          <Buton
            varianta="distructiv"
            disabled={inCurs || toateInactive}
            title={toateInactive ? "Niciun modul activ de oprit." : undefined}
            onClick={() => {
              setMesaj(null);
              setEroare(null);
              setConfirmaOprirea(true);
            }}
          >
            <PowerOff aria-hidden="true" className="h-4 w-4" />
            Oprește tot
          </Buton>
        </div>
      )}

      <p aria-live="polite" className="text-muted-foreground text-nota text-right">
        {mesaj ?? `${active} din ${comutabile} module comutabile sunt active.`}
      </p>

      {eroare ? (
        <p
          role="alert"
          className="text-danger text-nota inline-flex max-w-sm items-start gap-1 text-right"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
          {eroare}
        </p>
      ) : null}
    </div>
  );
}
