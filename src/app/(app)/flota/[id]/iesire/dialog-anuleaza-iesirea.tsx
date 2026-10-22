"use client";

// src/app/(app)/flota/[id]/iesire/dialog-anuleaza-iesirea.tsx
//
// Anularea unei ieșiri înregistrate greșit (0218, F12h). Faptele ieșirii nu se
// editează (Decizia 2): se anulează și se reface. Vehiculul revine în parc,
// termenele ies din alerte, dar alocarea și rezervările NU revin.
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { anuleazaIesirea } from "./actions";

interface Proprietati {
  readonly iesireId: string;
  readonly vehiculId: string;
  readonly descriere: string;
}

export function DialogAnuleazaIesirea({
  iesireId,
  vehiculId,
  descriere,
}: Proprietati): ReactElement {
  return (
    <FormularDialog
      declansator={{ eticheta: "Anulează ieșirea", varianta: "tertiar" }}
      titlu="Anulați ieșirea din parc?"
      descriere={`${descriere}. Vehiculul revine în parc, iar termenele ieșirii ies din alerte (rămân în istoric). Alocarea încheiată și rezervările anulate NU revin: o predare se înregistrează din nou.`}
      actiune={(date) =>
        anuleazaIesirea({
          id: iesireId,
          vehicle_id: vehiculId,
          motiv_anulare: String(date.get("motiv_anulare") ?? "").trim(),
        })
      }
      mesajReusita="Ieșirea a fost anulată. Vehiculul e din nou în parc."
      etichetaTrimite="Anulează ieșirea"
      variantaTrimite="distructiv"
      textInCurs="Se anulează…"
    >
      {(stare, idc) => (
        <Camp
          nume="motiv_anulare"
          id={idc("motiv_anulare")}
          eticheta="De ce anulați ieșirea"
          obligatoriu
          ajutor="De exemplu: data sau felul ieșirii au fost greșite; vânzarea nu s-a mai făcut."
          erori={stare.erori["motiv_anulare"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="text"
              minLength={5}
              maxLength={500}
              defaultValue={stare.valoriTrimise["motiv_anulare"] ?? ""}
            />
          )}
        </Camp>
      )}
    </FormularDialog>
  );
}
