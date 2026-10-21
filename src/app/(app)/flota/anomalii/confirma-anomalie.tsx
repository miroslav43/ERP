"use client";

import { useCallback, useId } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Formular } from "@/components/ui/formular";

import { confirmaAnomalie } from "../actions";

/**
 * Confirmarea unei anomalii — o explicație, nu o corecție.
 *
 * Cifrele constatate rămân neatinse: `internal.anomalii_protejeaza` respinge
 * modificarea lor. Se scrie doar nota și momentul confirmării.
 *
 * `<Formular>`, nu `<form action>` brut: React 19 resetează formularul după
 * orice acțiune, iar explicația scrisă se pierdea la un refuz (aceeași clasă
 * de defect ca ADM-022). Eticheta rămâne doar pentru cititorul de ecran —
 * caseta stă pe rândul anomaliei, nu într-un formular de sine stătător.
 */
export function ConfirmaAnomalie({ id }: { readonly id: string }) {
  const router = useRouter();
  const idNota = useId();

  async function trimite(formular: FormData) {
    const nota = String(formular.get("nota") ?? "").trim();
    return await confirmaAnomalie({ id, nota: nota.length > 0 ? nota : null });
  }

  // Stabil între randări: intră în dependențele efectului din `<Formular>`.
  const laReusita = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <Formular actiune={trimite} laReusita={laReusita} className="gap-2">
      {(stare) => {
        const trimise: Readonly<Record<string, string>> =
          stare.data === null ? stare.valoriTrimise : {};
        return (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={idNota} className="sr-only">
              Explicația diferenței de kilometraj
            </label>
            <input
              id={idNota}
              name="nota"
              type="text"
              maxLength={500}
              placeholder="Ex. cursă necompletată pe 14 septembrie"
              defaultValue={trimise["nota"] ?? ""}
              className="border-foreground/60 rounded-control text-corp min-w-40 flex-1 border px-3 py-1.5"
            />
            <Buton
              type="submit"
              varianta="secundar"
              inCurs={stare.inCurs}
              textInCurs="Se salvează…"
            >
              Confirmă
            </Buton>
          </div>
        );
      }}
    </Formular>
  );
}
