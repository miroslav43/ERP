// src/app/(app)/puncte-lucru/formular-punct-lucru-nou.tsx
"use client";

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { JUDETE } from "@/schemas/organization";
import { creeazaPunctLucru } from "./actions";

/**
 * Punct de lucru nou.
 *
 * Formularul trece prin `<Formular>` + `<Camp>` din două motive măsurate:
 *
 * 1. `creeazaPunctLucruSchema` respinge pe câmp — „Denumirea trebuie să aibă
 *    cel puțin 2 caractere.” cade pe `denumire`, județul nerecunoscut cade pe
 *    `judet` — iar varianta veche arunca `fieldErrors` și afișa un singur `<p>`
 *    roșu lângă buton.
 * 2. Cu `<form action={fn}>` și câmpuri necontrolate, React 19 RESETEAZĂ
 *    formularul după acțiune: o denumire de o literă golea și adresa, și
 *    codul poștal. `valoriTrimise` le pune înapoi ca `defaultValue`.
 *
 * Identificatorii se prefixează cu `useId()`: pe aceeași pagină mai stau N
 * formulare de editare din `actiuni-punct-lucru.tsx`, cu exact aceleași nume de
 * câmp, iar `Camp` derivă `id` din `nume`.
 */

/** Cheile obiectului sunt EXACT cele din `creeazaPunctLucruSchema`. */
async function trimite(date: FormData) {
  // Județul: `judetSchema.nullable()` nu cunoaște șirul gol, deci „— Alegeți —”
  // se traduce în `null` aici, nu în schemă.
  const judet = String(date.get("judet") ?? "");
  return creeazaPunctLucru({
    denumire: String(date.get("denumire") ?? ""),
    adresa: String(date.get("adresa") ?? ""),
    judet: judet === "" ? null : judet,
    oras: String(date.get("oras") ?? ""),
    cod_postal: String(date.get("cod_postal") ?? ""),
    sediu_principal: date.get("sediu_principal") === "on",
    observatii: null,
  });
}

export function FormularPunctLucruNou() {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  // `useCallback`: `laReusita` intră în lista de dependențe a efectului din
  // `Formular`. O funcție nouă la fiecare randare ar reporni efectul după
  // succes, deci notificarea ar apărea de două ori.
  const laReusita = useCallback((): void => {
    setDeschis(false);
    router.refresh();
  }, [router]);

  if (!deschis) {
    return (
      <Buton
        varianta="primar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Punct de lucru nou
      </Buton>
    );
  }

  return (
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita="Punctul de lucru a fost creat."
      className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2"
    >
      {(stare) => (
        <>
          <Camp
            nume="denumire"
            id={idc("denumire")}
            eticheta="Denumire"
            obligatoriu
            erori={stare.erori["denumire"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={160}
                defaultValue={stare.valoriTrimise["denumire"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="judet"
            id={idc("judet")}
            eticheta="Județ"
            fel="select"
            erori={stare.erori["judet"] ?? []}
          >
            {(a) => (
              <select {...a} defaultValue={stare.valoriTrimise["judet"] ?? ""}>
                <option value="">— Alegeți —</option>
                {JUDETE.map((judet) => (
                  <option key={judet} value={judet}>
                    {judet}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <Camp
            nume="oras"
            id={idc("oras")}
            eticheta="Localitate"
            erori={stare.erori["oras"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={80}
                defaultValue={stare.valoriTrimise["oras"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="cod_postal"
            id={idc("cod_postal")}
            eticheta="Cod poștal"
            erori={stare.erori["cod_postal"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={10}
                defaultValue={stare.valoriTrimise["cod_postal"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="adresa"
            id={idc("adresa")}
            eticheta="Adresă"
            className="sm:col-span-2"
            erori={stare.erori["adresa"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={240}
                defaultValue={stare.valoriTrimise["adresa"] ?? ""}
              />
            )}
          </Camp>

          {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA
              controlului, iar la o casetă de bifat eticheta stă după — altfel
              ținta de atingere se rupe în două și rândul se citește invers. */}
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id={idc("sediu_principal")}
              name="sediu_principal"
              type="checkbox"
              defaultChecked={stare.valoriTrimise["sediu_principal"] === "on"}
              className={clasaBifa}
            />
            <label htmlFor={idc("sediu_principal")} className="text-foreground text-corp">
              Sediu principal
            </label>
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Buton type="submit" varianta="primar" inCurs={stare.inCurs} textInCurs="Se creează…">
              Creează punctul de lucru
            </Buton>
            <Buton
              varianta="link"
              disabled={stare.inCurs}
              onClick={() => {
                setDeschis(false);
              }}
            >
              Renunță
            </Buton>
          </div>
        </>
      )}
    </Formular>
  );
}
