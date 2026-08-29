// src/app/(app)/angajati/[id]/formular-inceteaza-contract.tsx
"use client";

import { Camp, clasaBifa } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { inceteazaContract } from "../actions";

/**
 * Încetarea contractului, într-o casetă.
 *
 * ── DE CE CASETĂ, ȘI DE CE TOCMAI AICI ────────────────────────────────────
 * Formularul se desfăcea sub contract, cu chenar roșu, la câțiva pixeli de
 * restul acțiunilor fișei. Butonul rămâne distructiv (conturat, nu plin — se
 * inversează la hover; vezi `buton.tsx`), dar caseta adaugă ce lipsea: omul
 * trebuie să treacă printr-un gest deliberat înainte să scrie o dată de
 * încetare peste un contract activ.
 *
 * NU e o `ConfirmareActiune`: aceea e pentru acțiuni fără câmpuri. Aici sunt
 * patru, dintre care unul — arhivarea fișei — atinge altceva decât contractul.
 * Consecința lui e scrisă lângă bifă, nu presupusă.
 *
 * Ca și celelalte formulare ale fișei, trecerea prin `Formular` repară două
 * lucruri tăcute: `fieldErrors` nu se mai aruncă (un temei legal prea scurt
 * cade acum pe `temei_incetare`, nu într-o propoziție generală), iar resetul de
 * după acțiune al lui React 19 nu mai golește data și motivul la fiecare refuz.
 */

interface Proprietati {
  readonly contractId: string;
}

export function FormularInceteazaContract({ contractId }: Proprietati) {
  /** Cheile obiectului sunt EXACT cele din `inceteazaContractSchema`. */
  async function trimite(date: FormData) {
    return inceteazaContract({
      contract_id: contractId,
      incetat_la: String(date.get("incetat_la") ?? ""),
      temei_incetare: String(date.get("temei_incetare") ?? ""),
      motiv_incetare: String(date.get("motiv_incetare") ?? ""),
      arhiveaza_fisa: date.get("arhiveaza_fisa") === "on",
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Încetează contractul",
        varianta: "distructiv",
        className: "mt-3",
      }}
      titlu="Încetarea contractului"
      descriere="Contractul se închide la data de mai jos și nu mai intră în calculul salarial de după ea. Temeiul și motivul ajung în registrul de evidență și în adeverințe."
      marime="mare"
      actiune={trimite}
      mesajReusita="Contractul a fost încetat."
      etichetaTrimite="Confirmă încetarea"
      variantaTrimite="distructiv"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="incetat_la"
            id={idc("incetat_la")}
            eticheta="Data încetării"
            obligatoriu
            erori={stare.erori["incetat_la"] ?? []}
          >
            {(a) => (
              <input {...a} type="date" defaultValue={stare.valoriTrimise["incetat_la"] ?? ""} />
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
                placeholder="Ex. art. 55 lit. a) Codul muncii"
                defaultValue={stare.valoriTrimise["temei_incetare"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="motiv_incetare"
            id={idc("motiv_incetare")}
            eticheta="Motivul încetării"
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
                defaultValue={stare.valoriTrimise["motiv_incetare"] ?? ""}
              />
            )}
          </Camp>

          {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA
              controlului, iar la o casetă de bifat eticheta stă după. */}
          <div className="flex items-start gap-2 sm:col-span-2">
            <input
              id={idc("arhiveaza_fisa")}
              name="arhiveaza_fisa"
              type="checkbox"
              defaultChecked={stare.valoriTrimise["arhiveaza_fisa"] === "on"}
              className={`${clasaBifa} mt-0.5`}
            />
            <label htmlFor={idc("arhiveaza_fisa")} className="text-foreground text-corp">
              Arhivează fișa angajatului, dacă acesta nu mai are alt contract activ
            </label>
          </div>
        </div>
      )}
    </FormularDialog>
  );
}
