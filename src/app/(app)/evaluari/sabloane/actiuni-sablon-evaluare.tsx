"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { dezactiveazaSablonEvaluare } from "../actions";

/**
 * Butonul ignora complet rezultatul acțiunii: `await …; router.refresh()`.
 * Poarta politicii `evaluation_templates_update` NU e permisiunea verificată în
 * preambulul acțiunii (`evaluations:update`), ci `employees:update` — un rol
 * care are una fără cealaltă primea exact aceeași reîmprospătare tăcută ca la
 * reușită, iar șablonul rămânea activ. Acțiunea întoarce deja refuzul; ecranul
 * trebuie să îl și SPUNĂ.
 *
 * Confirmarea prealabilă e aici fiindcă dezactivarea n-are pereche: nicio
 * acțiune nu pune `activ` înapoi pe `true`. Din interfață, un clic greșit e
 * definitiv — deci merită întrebarea.
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
            const rezultat = await dezactiveazaSablonEvaluare({ id });
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
