"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { stergeDocument } from "../actions";

/**
 * Scoaterea unui document din fișă.
 *
 * ── CE SE ÎNTÂMPLĂ ÎN URMĂ, ȘI NU SE VEDE DE AICI ────────────────────────────
 * Ștergerea e logică (`deleted_at`), iar `internal.vdoc_dupa` recalculează pe
 * urmă documentul CURENT din rândurile rămase. Ștergi RCA-ul valabil, iar cel de
 * anul trecut îi ia locul automat, cu semaforul și rândul din `expirables` mutate
 * odată cu el. Dacă nu mai rămâne niciunul, scadența se închide logic — dar
 * tipul obligatoriu reapare imediat în tabel ca „Lipsește", roșu.
 *
 * De asta `consecinta` spune ce se întâmplă cu SCADENȚA, nu doar cu rândul: un
 * om care șterge polița curentă crede că șterge o linie dintr-un tabel, nu că
 * mută conformitatea vehiculului înapoi cu un an.
 *
 * ── FĂRĂ `cereTastare` ───────────────────────────────────────────────────────
 * Tastarea unui cuvânt de confirmare e pentru ce nu se poate reface. Un document
 * se reintroduce în treizeci de secunde din panoul de dedesubt, iar poliția
 * fizică e oricum în dosar. Ar fi ceremonie fără miză.
 */
interface Proprietati {
  readonly documentId: string;
  readonly vehiculId: string;
  readonly denumireTip: string;
  readonly esteCurent: boolean;
  readonly expiraLa: string | null;
}

export function ButonStergeDocument({
  documentId,
  vehiculId,
  denumireTip,
  esteCurent,
  expiraLa,
}: Proprietati): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  function confirma(): void {
    porneste(async () => {
      const rezultat = await stergeDocument({ id: documentId, vehicle_id: vehiculId });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: `Documentul „${denumireTip}” a fost șters.` });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Șterge documentul „${denumireTip}”`}
        onClick={() => {
          setDeschis(true);
        }}
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Buton>

      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu="Ștergeți documentul?"
        consecinta={
          esteCurent
            ? "Documentul iese din fișă. Dacă vehiculul mai are unul mai vechi de același tip, acela redevine documentul curent și semaforul se recalculează după data LUI. Dacă nu, tipul rămâne necompletat."
            : "Documentul iese din fișă. E o versiune veche, deci semaforul de scadențe nu se schimbă."
        }
        cifre={[
          { eticheta: "Tip", valoare: denumireTip },
          { eticheta: "Expiră", valoare: expiraLa ?? "necompletat" },
        ]}
        etichetaConfirmare="Șterge documentul"
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
