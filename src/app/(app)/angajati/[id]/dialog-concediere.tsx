// src/app/(app)/angajati/[id]/dialog-concediere.tsx
"use client";

import { UserMinus } from "lucide-react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { IntrareData } from "@/components/ui/intrare-data";
import { todayInBucharest } from "@/lib/format/date";

import { inceteazaContract } from "../actions";

/**
 * Concedierea, ca un singur gest, la finalul fișei.
 *
 * ── DE CE ÎNCĂ UN DECLANȘATOR PESTE `FormularInceteazaContract` ───────────
 * Nu e o a doua acțiune: amândouă cheamă `inceteazaContract`. Diferă ÎNTREBAREA
 * din spatele lor, iar întrebarea decide unde stă butonul și ce scrie pe el.
 *
 * Cel din secțiunea „Contracte" răspunde la „vreau să închid contractul ĂSTA" —
 * are înțeles doar lângă contractul respectiv, și rămâne acolo tocmai pentru
 * cumulul de funcții, unde sunt mai multe contracte active și trebuie ales unul.
 *
 * Ăsta răspunde la „omul ăsta pleacă din firmă". Aceea nu e o operațiune pe un
 * rând dintr-o listă, e sfârșitul fișei — de aceea stă ultimul pe pagină, în
 * aceeași secțiune cu ștergerea, și de aceea `arhiveaza_fisa` e ADEVĂRAT fără
 * bifă. Bifa are sens când întrebi despre un contract („și fișa, ce fac cu
 * ea?"); când întrebi despre plecarea omului, răspunsul e deja dat de întrebare.
 *
 * ── CE NU FACE ────────────────────────────────────────────────────────────
 * Nu șterge fișa și nu poate. `inceteazaContract` mută `employees.status` în
 * `arhivat` și scrie `terminated_on`, atât — istoricul de pontaj, concedii și
 * documente rămâne întreg, fiindcă adeverințele de vechime se emit din el ani
 * după plecare. Ștergerea e butonul de alături, disponibil abia după ce nu mai
 * există contract activ, fiindcă exact asta refuză `mesajRefuzStergere`.
 *
 * ── ARHIVAREA NU E GARANTATĂ DE AICI ──────────────────────────────────────
 * Acțiunea arhivează fișa doar dacă nu mai rămâne NICIUN contract de bază activ
 * (`este_act_aditional = false`). La cumul de funcții, prima încetare lasă fișa
 * în efectiv — corect, omul chiar mai lucrează. Pagina spune asta deasupra
 * butonului, în loc să promită aici ceva ce serverul numără altfel.
 */

interface Proprietati {
  readonly contractId: string;
  readonly numarContract: string;
  readonly nume: string;
  readonly marca: string;
  /**
   * Începutul contractului. Devine `min` pe câmpul de dată: serverul respinge
   * oricum o încetare anterioară lui (`businessRule`), dar refuzul ar sosi după
   * ce omul a scris deja temeiul și motivul.
   */
  readonly valabilDeLa: string;
}

export function DialogConcediere({
  contractId,
  numarContract,
  nume,
  marca,
  valabilDeLa,
}: Proprietati) {
  /** Cheile obiectului sunt EXACT cele din `incetareContractSchema`. */
  async function trimite(date: FormData) {
    return inceteazaContract({
      contract_id: contractId,
      incetat_la: String(date.get("incetat_la") ?? ""),
      temei_incetare: String(date.get("temei_incetare") ?? ""),
      motiv_incetare: String(date.get("motiv_incetare") ?? ""),
      arhiveaza_fisa: true,
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Concediază angajatul",
        varianta: "distructiv",
        pictograma: <UserMinus aria-hidden="true" className="size-4" />,
      }}
      titlu="Concediați acest angajat?"
      descriere="Contractul se închide la data de mai jos, evenimentul de încetare pleacă spre REGES, iar fișa trece în arhivă și iese din efectiv. Pontajul, concediile și documentele rămân — adeverințele de vechime se emit din ele și după plecare."
      marime="mare"
      actiune={trimite}
      mesajReusita={`${nume} a fost scos din efectiv.`}
      etichetaTrimite="Confirmă concedierea"
      variantaTrimite="distructiv"
      textInCurs="Se înregistrează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {/*
            Rezumatul stă ÎN casetă, nu doar pe buton: caseta acoperă pagina, iar
            pe fișa deschisă din căutare numele de sub ea nu se mai vede. Aceleași
            clase ca `cifre` din `ConfirmareActiune` — e aceeași întrebare
            („pe cine, exact?"), pusă cu câmpuri în plus.
          */}
          <dl className="border-border divide-border rounded-panou divide-y border sm:col-span-2">
            <div className="flex items-baseline justify-between gap-4 px-3 py-2">
              <dt className="text-muted-foreground text-corp">Angajat</dt>
              <dd className="text-foreground text-corp font-semibold">{nume}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-3 py-2">
              <dt className="text-muted-foreground text-corp">Marca</dt>
              <dd className="text-foreground text-corp font-mono font-semibold tabular-nums">
                {marca}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-3 py-2">
              <dt className="text-muted-foreground text-corp">Contract</dt>
              <dd className="text-foreground text-corp font-mono font-semibold tabular-nums">
                nr. {numarContract}
              </dd>
            </div>
          </dl>

          <Camp
            nume="incetat_la"
            id={idc("incetat_la")}
            eticheta="Data încetării"
            obligatoriu
            erori={stare.erori["incetat_la"] ?? []}
          >
            {(a) => (
              <IntrareData
                {...a}
                min={valabilDeLa}
                implicit={stare.valoriTrimise["incetat_la"] ?? todayInBucharest()}
              />
            )}
          </Camp>

          <Camp
            nume="temei_incetare"
            id={idc("temei_incetare")}
            eticheta="Temei legal"
            obligatoriu
            erori={stare.erori["temei_incetare"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                minLength={2}
                maxLength={120}
                placeholder="Ex. art. 65 alin. (1) Codul muncii"
                defaultValue={stare.valoriTrimise["temei_incetare"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="motiv_incetare"
            id={idc("motiv_incetare")}
            eticheta="Motivul concedierii"
            fel="textarea"
            obligatoriu
            className="sm:col-span-2"
            erori={stare.erori["motiv_incetare"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                minLength={3}
                maxLength={500}
                rows={3}
                placeholder="Ce se trece în decizia de încetare și în registrul de evidență."
                defaultValue={stare.valoriTrimise["motiv_incetare"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
