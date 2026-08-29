// src/app/(app)/puncte-lucru/formular-punct-lucru-nou.tsx
"use client";

import { Plus } from "lucide-react";

import { Camp, clasaBifa } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { JUDETE } from "@/schemas/organization";
import { creeazaPunctLucru } from "./actions";

/**
 * Punct de lucru nou, într-o casetă.
 *
 * ── DE CE NU MAI CREȘTE ÎN PAGINĂ ─────────────────────────────────────────
 * Cele șapte câmpuri se desfăceau sub antet și împingeau lista punctelor
 * existente afară din prima privire — exact lista pe care omul o consultă ca
 * să nu adauge de două ori aceeași locație.
 *
 * ── CE PĂSTREAZĂ DIN VARIANTA VECHE ───────────────────────────────────────
 * 1. `creeazaPunctLucruSchema` respinge pe câmp — „Denumirea trebuie să aibă
 *    cel puțin 2 caractere.” cade pe `denumire`, județul nerecunoscut cade pe
 *    `judet` — iar `Camp` duce fiecare mesaj lângă câmpul lui.
 * 2. Cu `<form action={fn}>` și câmpuri necontrolate, React 19 RESETEAZĂ
 *    formularul după acțiune: o denumire de o literă golea și adresa, și codul
 *    poștal. `valoriTrimise` le pune înapoi ca `defaultValue`, iar caseta nu se
 *    închide la refuz.
 *
 * Identificatorii trec prin `idc`: pe aceeași pagină mai stau N formulare de
 * editare din `actiuni-punct-lucru.tsx`, cu exact aceleași nume de câmp, iar
 * `Camp` derivă `id` din `nume`.
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
    observatii: String(date.get("observatii") ?? ""),
  });
}

export function FormularPunctLucruNou() {
  return (
    <FormularDialog
      declansator={{
        eticheta: "Punct de lucru nou",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Punct de lucru nou"
      descriere="Locația apare în contracte, în pontaj și în declarațiile către ITM. Sediul principal e unul singur: bifându-l aici, se ia de la cel de dinainte."
      marime="mare"
      actiune={trimite}
      mesajReusita="Punctul de lucru a fost creat."
      etichetaTrimite="Creează punctul de lucru"
      textInCurs="Se creează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
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

          {/* Observațiile erau trimise ca `null` fix, deși schema le acceptă
              și pagina le citea din bază: coloana nu se putea scrie de nicăieri
              din interfață. */}
          <Camp
            nume="observatii"
            id={idc("observatii")}
            eticheta="Observații"
            fel="textarea"
            ajutor="Program, acces, persoană de contact — ce trebuie știut despre locație."
            className="sm:col-span-2"
            erori={stare.erori["observatii"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                maxLength={1000}
                rows={3}
                defaultValue={stare.valoriTrimise["observatii"] ?? ""}
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
        </div>
      )}
    </FormularDialog>
  );
}
