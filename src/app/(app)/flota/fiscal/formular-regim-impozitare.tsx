"use client";

import { useRouter } from "next/navigation";
import { useCallback, type ReactElement } from "react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import {
  ETICHETE_REGIM_IMPOZITARE,
  REGIMURI_IMPOZITARE,
  type RegimImpozitare,
} from "@/domain/fleet/fiscal";

import { salveazaRegimImpozitare } from "../actions-fiscal";

/**
 * Regimul de impozitare al firmei (0202): micro, profit sau specific. Decide
 * doar dacă folosința personală a mașinii se sugerează ca avantaj în natură
 * (Codul fiscal art. 76 alin. (4) lit. ț^1)); nu schimbă nimic altundeva.
 *
 * Numele câmpului e EXACT cheia lui `regimImpozitareSchema`. Gol = nestabilit.
 */
export function FormularRegimImpozitare({
  regimCurent,
}: Readonly<{ regimCurent: RegimImpozitare | null }>): ReactElement {
  const router = useRouter();
  // Funcție stabilă: intră în dependențele efectului de succes din `Formular`.
  const laReusita = useCallback(() => {
    router.refresh();
  }, [router]);

  async function trimite(date: FormData) {
    return salveazaRegimImpozitare({
      regim_impozitare: String(date.get("regim_impozitare") ?? ""),
    });
  }

  return (
    <Formular
      actiune={trimite}
      mesajReusita="Regimul de impozitare a fost salvat."
      laReusita={laReusita}
    >
      {(stare) => (
        <>
          <Camp
            nume="regim_impozitare"
            eticheta="Regimul de impozitare al firmei"
            fel="select"
            ajutor="Firma pe impozitul microîntreprinderilor sau pe impozitul specific nu are avantaj în natură din folosința personală a mașinii; firma pe impozitul pe profit, da. Lăsat necompletat, sugestia nu se calculează."
            erori={stare.erori["regim_impozitare"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                defaultValue={stare.valoriTrimise["regim_impozitare"] ?? regimCurent ?? ""}
              >
                <option value="">Nestabilit</option>
                {REGIMURI_IMPOZITARE.map((r) => (
                  <option key={r} value={r}>
                    {ETICHETE_REGIM_IMPOZITARE[r]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <BaraActiuni aliniere="final">
            <Buton type="submit" varianta="primar" inCurs={stare.inCurs} textInCurs="Se salvează…">
              Salvează regimul
            </Buton>
          </BaraActiuni>
        </>
      )}
    </Formular>
  );
}
