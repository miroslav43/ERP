"use client";

// src/app/(app)/flota/[id]/pv/[pv]/actiuni-pv.tsx
//
// Tranzițiile procesului-verbal (0215, F12c): finalizarea și ștergerea ciornei,
// anularea PV-ului finalizat. Fiecare buton are propriul `useTransition`: un
// refuz la finalizare nu blochează ștergerea, iar „Se finalizează…” e semnul că
// apăsarea a fost înregistrată.

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";

import { anuleazaPv, finalizeazaPv, stergePv } from "../actions";

interface Proprietati {
  readonly pvId: string;
  readonly vehiculId: string;
  readonly stare: "ciorna" | "finalizat";
  readonly anulat: boolean;
}

function Finalizeaza({
  pvId,
  vehiculId,
}: Readonly<{ pvId: string; vehiculId: string }>): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);
  return (
    <>
      <Buton varianta="primar" onClick={() => setDeschis(true)}>
        Finalizează
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => setDeschis(false)}
        titlu="Finalizați procesul-verbal?"
        consecinta="Procesul-verbal primește număr și se înregistrează în registrul general. După finalizare nu se mai modifică: o greșeală se corectează prin anulare și un proces-verbal nou."
        etichetaConfirmare="Finalizează"
        inCurs={inCurs}
        laConfirmare={() => {
          porneste(async () => {
            const r = await finalizeazaPv({ id: pvId, vehicle_id: vehiculId });
            if (!r.ok) {
              arataToast({ fel: "eroare", text: r.error.message });
              return;
            }
            setDeschis(false);
            arataToast({
              fel: "reusita",
              text: `Procesul-verbal ${r.data.numar} a fost finalizat.`,
            });
            router.refresh();
          });
        }}
      />
    </>
  );
}

function StergeCiorna({
  pvId,
  vehiculId,
}: Readonly<{ pvId: string; vehiculId: string }>): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);
  return (
    <>
      <Buton varianta="tertiar" onClick={() => setDeschis(true)}>
        Șterge ciorna
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => setDeschis(false)}
        titlu="Ștergeți ciorna?"
        consecinta="Ciorna nu are număr și nu e în registru. Predarea rămâne fără proces-verbal până întocmiți altul."
        etichetaConfirmare="Șterge ciorna"
        distructiv
        inCurs={inCurs}
        laConfirmare={() => {
          porneste(async () => {
            const r = await stergePv({ id: pvId, vehicle_id: vehiculId });
            if (!r.ok) {
              arataToast({ fel: "eroare", text: r.error.message });
              return;
            }
            setDeschis(false);
            arataToast({ fel: "reusita", text: "Ciorna a fost ștearsă." });
            router.push(`/flota/${vehiculId}`);
          });
        }}
      />
    </>
  );
}

function Anuleaza({
  pvId,
  vehiculId,
}: Readonly<{ pvId: string; vehiculId: string }>): ReactElement {
  return (
    <FormularDialog
      declansator={{ eticheta: "Anulează", varianta: "tertiar" }}
      titlu="Anularea procesului-verbal"
      descriere="Numărul și rândul din registru rămân consumate; registrul primește anularea cu motivul. Hârtia semnată se păstrează, cu mențiunea anulării."
      actiune={(date) =>
        anuleazaPv({
          id: pvId,
          vehicle_id: vehiculId,
          motiv_anulare: String(date.get("motiv_anulare") ?? "").trim(),
        })
      }
      mesajReusita="Procesul-verbal a fost anulat."
      etichetaTrimite="Anulează procesul-verbal"
      variantaTrimite="distructiv"
      textInCurs="Se anulează…"
    >
      {(stare, idc) => (
        <Camp
          nume="motiv_anulare"
          id={idc("motiv_anulare")}
          eticheta="Motivul anulării"
          fel="textarea"
          obligatoriu
          ajutor="Între 10 și 500 de caractere. Apare în registru."
          erori={stare.erori["motiv_anulare"] ?? []}
        >
          {(a) => (
            <textarea
              {...a}
              minLength={10}
              maxLength={500}
              rows={3}
              defaultValue={stare.valoriTrimise["motiv_anulare"] ?? ""}
            />
          )}
        </Camp>
      )}
    </FormularDialog>
  );
}

export function ActiuniPv({ pvId, vehiculId, stare, anulat }: Proprietati): ReactElement | null {
  if (stare === "ciorna") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Finalizeaza pvId={pvId} vehiculId={vehiculId} />
        <StergeCiorna pvId={pvId} vehiculId={vehiculId} />
      </span>
    );
  }
  if (anulat) return null;
  return <Anuleaza pvId={pvId} vehiculId={vehiculId} />;
}
