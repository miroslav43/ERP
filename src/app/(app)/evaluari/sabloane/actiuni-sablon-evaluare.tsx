"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { arhiveazaSablonEvaluare } from "../actions";

/**
 * Butonul ignora complet rezultatul acțiunii: `await …; router.refresh()`.
 * Poarta politicii `evaluation_templates_update` NU e permisiunea verificată în
 * preambulul acțiunii (`evaluations:update`), ci `employees:update` — un rol
 * care are una fără cealaltă primea exact aceeași reîmprospătare tăcută ca la
 * reușită, iar șablonul rămânea activ. Acțiunea întoarce deja refuzul; ecranul
 * trebuie să îl și SPUNĂ.
 *
 * Confirmarea prealabilă a rămas deși dezactivarea are ACUM pereche
 * (`reactiveazaSablonEvaluare`, adus de ramura `feat/departamente-vizualizari`):
 * ecranul ăsta încă nu oferă reactivarea, deci din interfața de aici un clic
 * greșit tot e fără drum înapoi.
 *
 * Acțiunea s-a redenumit `dezactiveaza…` → `arhiveaza…` pe aceeași ramură;
 * semantica e neschimbată (`comutaActiv(false)`, `evaluations:update` cu scope
 * `all`). Textele din interfață rămân „dezactivează”, fiindcă asta înțelege
 * utilizatorul — „arhivare” ar promite o listă de arhivă care nu există.
 */
export function ActiuniSablonEvaluare({
  id,
  denumire,
}: {
  readonly id: string;
  readonly denumire: string;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  return (
    <>
      <Buton varianta="distructiv" disabled={inCurs} onClick={() => setDeschis(true)}>
        <Ban aria-hidden="true" className="size-3.5" />
        {/* Butonul spunea doar „Dezactivează”: pe o listă de șabloane, textul nu
            spunea PE CARE, iar la cititorul de ecran toate erau identice. */}
        Dezactivează „{denumire}”
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => setDeschis(false)}
        titlu={`Dezactivați șablonul „${denumire}”?`}
        consecinta="Nu va mai putea fi ales la o evaluare nouă. Evaluările deja făcute pe el rămân neatinse, dar reactivarea nu se poate face din acest ecran."
        etichetaConfirmare="Dezactivează"
        distructiv
        inCurs={inCurs}
        laConfirmare={() => {
          porneste(async () => {
            const rezultat = await arhiveazaSablonEvaluare({ id });
            if (!rezultat.ok) {
              arataToast({ fel: "eroare", text: rezultat.error.message });
              return;
            }
            setDeschis(false);
            arataToast({ fel: "reusita", text: `Șablonul „${denumire}” a fost dezactivat.` });
            router.refresh();
          });
        }}
      />
    </>
  );
}
