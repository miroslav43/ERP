"use client";

// src/app/(app)/flota/[id]/iesire/buton-redeschide-obligatia.tsx
//
// Redeschiderea unui termen de ieșire închis din greșeală (0218, F12h). Baza o
// refuză când un termen care depinde de acesta e deja făcut (P0001, mesajul ei).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { redeschideObligatia } from "./actions";

interface Proprietati {
  readonly termenId: string;
  readonly vehiculId: string;
  readonly denumire: string;
  readonly stare: string;
}

export function ButonRedeschideObligatia({
  termenId,
  vehiculId,
  denumire,
  stare,
}: Proprietati): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  function confirma(): void {
    porneste(async () => {
      const rezultat = await redeschideObligatia({ id: termenId, vehicle_id: vehiculId });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: "Termenul a fost redeschis." });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        aria-label={`Redeschide termenul „${denumire}”`}
        onClick={() => {
          setDeschis(true);
        }}
      >
        Redeschide
      </Buton>

      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu="Redeschideți termenul?"
        consecinta="Termenul revine în alerte, cu data lui. Termenele care curg din el își pierd data până îl marcați din nou."
        cifre={[
          { eticheta: "Termen", valoare: denumire },
          { eticheta: "Acum", valoare: stare },
        ]}
        etichetaConfirmare="Redeschide"
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
