"use client";

// src/app/(app)/cursuri/biblioteca/[id]/formular-link.tsx
//
// Linkul extern se ANALIZEAZĂ, nu se stochează. Din adresa lipită scoatem
// furnizorul, identificatorul și, la Vimeo, codul filmului nelistat; adresa de
// vizionare se reconstruiește din șablon pe server. Vezi `lib/media/link-extern.ts`.

import { Plus } from "lucide-react";
import { useState } from "react";

import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { analizeazaLink, ETICHETE_FURNIZOR } from "@/lib/media/link-extern";
import type { StareFormular } from "@/components/ui/formular";

import { salveazaVersiuneLink } from "../../actions";
import { citesteVersiuneLink } from "../../_formulare/citire";

/**
 * Câmpul de adresă, cu recunoașterea pe loc a furnizorului.
 *
 * ── DE CE COMPONENTĂ SEPARATĂ ─────────────────────────────────────────────
 * Starea de previzualizare trebuie să MOARĂ odată cu caseta. Ținută în
 * componenta de deasupra, ar fi supraviețuit unei renunțări: la a doua
 * deschidere, câmpul ar fi fost gol iar sub el ar fi scris încă „YouTube ·
 * dQw4w9WgXcQ" — o afirmație despre un link pe care nimeni nu l-a lipit.
 * `FormularDialog` randează copiii doar cât e deschis, deci un `useState` de
 * aici se golește singur.
 */
function CampAdresa({
  stare,
  id,
}: {
  readonly stare: StareFormular<unknown>;
  readonly id: string;
}) {
  const [previzualizare, setPrevizualizare] = useState<string | null>(null);

  return (
    <>
      <Camp
        nume="adresa"
        id={id}
        eticheta="Adresa filmului"
        obligatoriu
        ajutor="YouTube, Vimeo sau Loom. Copiați adresa din bara browserului."
        className="sm:col-span-2"
        erori={stare.erori["adresa"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="url"
            inputMode="url"
            maxLength={2048}
            defaultValue={stare.valoriTrimise["adresa"] ?? ""}
            onChange={(e) => {
              // Recunoașterea se face pe loc, cu ACEEAȘI funcție pe care o
              // folosește serverul: omul află imediat dacă linkul e bun, nu
              // după ce apasă.
              const r = analizeazaLink(e.target.value);
              setPrevizualizare(
                e.target.value.trim() === ""
                  ? null
                  : r.ok
                    ? `${ETICHETE_FURNIZOR[r.link.furnizor]} · ${r.link.id}${r.link.codPrivat === null ? "" : " (film nelistat)"}`
                    : r.motiv,
              );
            }}
          />
        )}
      </Camp>

      {previzualizare === null ? null : (
        <div className="sm:col-span-2">
          <Callout fel={previzualizare.includes("·") ? "informativ" : "atentie"}>
            {previzualizare}
          </Callout>
        </div>
      )}
    </>
  );
}

/**
 * Versiune nouă dintr-un link extern, într-o casetă.
 *
 * Formularul stătea deschis în secțiunea „Versiune nouă", sub explicația care
 * spune de ce o versiune publicată nu-și mai schimbă conținutul. Explicația
 * rămâne pe pagină; formularul se deschide din buton.
 */
export function FormularLink({ materialId }: { readonly materialId: string }) {
  return (
    <FormularDialog
      declansator={{
        eticheta: "Versiune nouă din link",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Versiune nouă din link extern"
      descriere="Parcurgerea nu se poate urmări la un film extern: rulează pe platforma furnizorului, care nu ne spune cât a văzut omul. Alegeți bifa sau declarația asumată ca dovadă."
      marime="mare"
      actiune={async (date) => salveazaVersiuneLink(citesteVersiuneLink(date, materialId))}
      mesajReusita="Linkul a fost salvat."
      etichetaTrimite="Salvează linkul"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <CampAdresa stare={stare} id={idc("adresa")} />

          <Camp
            nume="durata_secunde"
            id={idc("durata_secunde")}
            eticheta="Durata (secunde)"
            ajutor="Opțional. Se afișează angajatului ca timp estimat."
            erori={stare.erori["durata_secunde"] ?? []}
          >
            {(a) => <input {...a} type="number" min={1} max={86400} />}
          </Camp>

          <Camp nume="nota_versiune" id={idc("nota_versiune")} eticheta="Notă de versiune">
            {(a) => <input {...a} type="text" maxLength={500} />}
          </Camp>

          <div className="sm:col-span-2">
            <Callout fel="atentie" titlu="Ce nu putem măsura la un film extern">
              Parcurgerea nu se poate urmări: filmul rulează pe platforma furnizorului, care nu ne
              spune cât a văzut omul. Folosiți bifa sau declarația asumată. La deschidere, angajatul
              e întrebat înainte ca furnizorul să-i primească adresa IP.
            </Callout>
          </div>
        </div>
      )}
    </FormularDialog>
  );
}
