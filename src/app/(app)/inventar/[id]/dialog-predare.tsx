"use client";

import { HandCoins } from "lucide-react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { STARI_OBIECT } from "@/schemas/inventory";

import { predaObiect } from "../actions";
import { ETICHETE_STARE } from "../etichete";

/**
 * Predarea obiectului către un angajat.
 *
 * Formularul stătea desfăcut în mijlocul fișei, cu aceeași greutate vizuală ca
 * datele obiectului — deși e un gest, nu o informație. Acum îl deschide butonul
 * din cardul de custodie, adică exact de lângă propoziția „Nimeni nu are
 * obiectul”.
 *
 * ── DE CE „BUN” ȘI NU STAREA OBIECTULUI ──────────────────────────────────
 * `stare_la_predare` e o constatare făcută ÎN MOMENTUL predării, semnată de
 * amândoi în procesul-verbal — nu o copie a stării din fișă. Dacă ar veni
 * precompletată cu ce scrie în evidență, ar fi o afirmație pe care n-a
 * verificat-o nimeni. Implicitul schemei rămâne „Bun”, iar cine predă alege.
 *
 * ── CÂND NU E CUI ────────────────────────────────────────────────────────
 * Fără angajați activi nu se randează niciun buton: un declanșator dezactivat
 * n-ar putea spune DE CE e dezactivat — proiectul n-are tooltip, deliberat.
 */
interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

interface Proprietati {
  readonly itemId: string;
  readonly angajati: readonly OptiuneAngajat[];
}

export function DialogPredare({ itemId, angajati }: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return predaObiect({
      item_id: itemId,
      employee_id: String(date.get("employee_id") ?? ""),
      stare_la_predare: String(date.get("stare_la_predare") ?? "bun"),
      observatii: String(date.get("observatii") ?? "").trim() || null,
    });
  }

  if (angajati.length === 0) {
    return (
      <p className="text-muted-foreground text-corp">
        Nu există angajați activi cărora să le puteți preda obiectul.
      </p>
    );
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Predă unui angajat",
        pictograma: <HandCoins aria-hidden="true" className="size-4" />,
      }}
      titlu="Predă obiectul unui angajat"
      descriere="Predarea se înregistrează cu ora curentă și generează procesul-verbal de predare-primire. Angajatul o confirmă din portalul lui."
      marime="mare"
      actiune={trimite}
      mesajReusita="Predarea a fost înregistrată."
      etichetaTrimite="Înregistrează predarea"
      textInCurs="Se înregistrează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="employee_id"
            id={idc("employee_id")}
            eticheta="Predat către"
            obligatoriu
            className="sm:col-span-2"
            erori={stare.erori["employee_id"] ?? []}
          >
            {(a) => (
              <select {...a} defaultValue={stare.valoriTrimise["employee_id"] ?? ""}>
                <option value="">Alegeți un angajat</option>
                {angajati.map((angajat) => (
                  <option key={angajat.id} value={angajat.id}>
                    {angajat.full_name ?? "Angajat fără nume"} ({angajat.marca})
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <Camp
            nume="stare_la_predare"
            id={idc("stare_la_predare")}
            eticheta="Stare la predare"
            fel="select"
            ajutor="Ce se constată acum, la mână, nu ce scrie în evidență."
            erori={stare.erori["stare_la_predare"] ?? []}
          >
            {(a) => (
              <select {...a} defaultValue={stare.valoriTrimise["stare_la_predare"] ?? "bun"}>
                {STARI_OBIECT.map((valoare) => (
                  <option key={valoare} value={valoare}>
                    {ETICHETE_STARE[valoare]}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <Camp
            nume="observatii"
            id={idc("observatii")}
            eticheta="Observații"
            fel="textarea"
            ajutor="Accesorii predate odată cu obiectul, zgârieturi, lipsuri."
            className="sm:col-span-2"
            erori={stare.erori["observatii"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                rows={3}
                maxLength={2000}
                defaultValue={stare.valoriTrimise["observatii"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
