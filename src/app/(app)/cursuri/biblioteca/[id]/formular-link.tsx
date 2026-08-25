"use client";

// src/app/(app)/cursuri/biblioteca/[id]/formular-link.tsx
//
// Linkul extern se ANALIZEAZĂ, nu se stochează. Din adresa lipită scoatem
// furnizorul, identificatorul și, la Vimeo, codul filmului nelistat; adresa de
// vizionare se reconstruiește din șablon pe server. Vezi `lib/media/link-extern.ts`.

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { analizeazaLink, ETICHETE_FURNIZOR } from "@/lib/media/link-extern";

import { salveazaVersiuneLink } from "../../actions";

export function FormularLink({ materialId }: { readonly materialId: string }) {
  const router = useRouter();
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;
  const [previzualizare, setPrevizualizare] = useState<string | null>(null);

  const laReusita = useCallback((): void => {
    setPrevizualizare(null);
    router.refresh();
  }, [router]);

  return (
    <Formular
      actiune={async (date) =>
        salveazaVersiuneLink({
          material_id: materialId,
          adresa: String(date.get("adresa") ?? ""),
          durata_secunde: String(date.get("durata_secunde") ?? ""),
          nota_versiune: String(date.get("nota_versiune") ?? ""),
        })
      }
      laReusita={laReusita}
      mesajReusita="Linkul a fost salvat."
      className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-2"
    >
      {(stare) => (
        <>
          <Camp
            nume="adresa"
            id={idc("adresa")}
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
                  // folosește serverul: omul află imediat dacă linkul e bun,
                  // nu după ce apasă.
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
              Parcurgerea nu se poate urmări: filmul rulează pe platforma
              furnizorului, care nu ne spune cât a văzut omul. Folosiți bifa sau
              declarația asumată. La deschidere, angajatul e întrebat înainte ca
              furnizorul să-i primească adresa IP.
            </Callout>
          </div>

          <BaraActiuni className="sm:col-span-2">
            <Buton type="submit" varianta="primar" inCurs={stare.inCurs} textInCurs="Se salvează…">
              Salvează linkul
            </Buton>
          </BaraActiuni>
        </>
      )}
    </Formular>
  );
}
