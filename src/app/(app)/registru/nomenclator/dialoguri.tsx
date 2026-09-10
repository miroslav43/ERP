"use client";

// src/app/(app)/registru/nomenclator/dialoguri.tsx
//
// Cele două casete ale nomenclatorului: adaptarea unui dosar și consemnarea
// avizului de la Arhivele Naționale.
//
// Ambele stau în același fișier fiindcă se folosesc doar aici, pe același ecran,
// și împart contextul legal. Despărțite ar fi două fișiere de treizeci de rânduri
// și un import în plus, fără niciun câștig de citire.

import { FormularDialog } from "@/components/ui/formular-dialog";
import { Camp } from "@/components/ui/camp";
import { FileCheck2, Pencil } from "lucide-react";

import { actualizeazaAvizNomenclator, actualizeazaDosarNomenclator } from "../actions";

export type DosarEditabil = Readonly<{
  id: string;
  indicativ: string;
  continut: string;
  termenPastrare: string;
}>;

/**
 * Adaptarea unui dosar. Indicativul se afișează, nu se editează: e o coloană
 * GENERATĂ în bază din cifra romană, litera și cifra arabă — art. 11.
 */
export function DialogDosar({ dosar }: { readonly dosar: DosarEditabil }) {
  return (
    <FormularDialog
      declansator={{
        eticheta: `Modifică dosarul ${dosar.indicativ}`,
        varianta: "tertiar",
        marime: "iconita",
        "aria-label": `Modifică dosarul ${dosar.indicativ}`,
        pictograma: <Pencil aria-hidden="true" className="size-4" />,
      }}
      titlu={`Dosarul ${dosar.indicativ}`}
      descriere="Nomenclatorul livrat de aplicație e un punct de plecare. Art. 11 spune că se întocmește de fiecare firmă pentru documentele proprii."
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
      mesajReusita="Dosarul a fost actualizat."
      marime="mediu"
      actiune={async (date: FormData) =>
        actualizeazaDosarNomenclator({
          id: dosar.id,
          continut: String(date.get("continut") ?? ""),
          termen_pastrare: String(date.get("termen_pastrare") ?? ""),
        })
      }
    >
      {(stare, idc) => (
        <>
          <Camp
            nume="continut"
            eticheta="Conținutul documentelor care constituie dosarul"
            fel="textarea"
            obligatoriu
            ajutor="Rubrica a treia din anexa nr. 1 — conținutul, în rezumat."
            {...(stare.erori["continut"] === undefined ? {} : { erori: stare.erori["continut"] })}
          >
            {(atribute) => (
              <textarea
                {...atribute}
                id={idc("continut")}
                rows={3}
                maxLength={500}
                defaultValue={stare.valoriTrimise["continut"] ?? dosar.continut}
              />
            )}
          </Camp>

          <Camp
            nume="termen_pastrare"
            eticheta="Termen de păstrare"
            obligatoriu
            ajutor="Rubrica a patra. Se scrie „permanent”, „CS” (când se schimbă) sau un număr de ani. ⚠️ Confirmați termenele cu contabilul sau juristul: statele de salarii se păstrează 50 de ani, celelalte documente financiar-contabile 10 ani."
            {...(stare.erori["termen_pastrare"] === undefined
              ? {}
              : { erori: stare.erori["termen_pastrare"] })}
          >
            {(atribute) => (
              <input
                {...atribute}
                id={idc("termen_pastrare")}
                maxLength={20}
                defaultValue={stare.valoriTrimise["termen_pastrare"] ?? dosar.termenPastrare}
              />
            )}
          </Camp>
        </>
      )}
    </FormularDialog>
  );
}

export type AvizCurent = Readonly<{
  avizatLa: string | null;
  numarAviz: string | null;
  directiaJudeteana: string | null;
  observatii: string | null;
}>;

/**
 * Consemnarea avizului. Aplicația nu-l poate obține — art. 5 lit. a) trimite
 * firma la Arhivele Naționale sau la direcția județeană — dar poate spune cinstit
 * dacă nomenclatorul e confirmat sau doar întocmit.
 */
export function DialogAviz({ aviz }: { readonly aviz: AvizCurent | null }) {
  return (
    <FormularDialog
      declansator={{
        eticheta: aviz?.avizatLa == null ? "Consemnează avizul" : "Modifică avizul",
        varianta: "secundar",
        pictograma: <FileCheck2 aria-hidden="true" className="size-4" />,
      }}
      titlu="Avizul Arhivelor Naționale"
      descriere="Nomenclatorul se confirmă de Arhivele Naționale sau de direcția județeană. Aplicația nu poate obține avizul; îl consemnează, ca ecranul să spună dacă există."
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
      mesajReusita="Avizul a fost consemnat."
      marime="mediu"
      actiune={async (date: FormData) =>
        actualizeazaAvizNomenclator({
          avizat_la: String(date.get("avizat_la") ?? ""),
          numar_aviz: String(date.get("numar_aviz") ?? ""),
          directia_judeteana: String(date.get("directia_judeteana") ?? ""),
          observatii: String(date.get("observatii") ?? ""),
        })
      }
    >
      {(stare, idc) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Camp
              nume="avizat_la"
              eticheta="Data avizului"
              {...(stare.erori["avizat_la"] === undefined
                ? {}
                : { erori: stare.erori["avizat_la"] })}
            >
              {(atribute) => (
                <input
                  {...atribute}
                  id={idc("avizat_la")}
                  type="date"
                  defaultValue={stare.valoriTrimise["avizat_la"] ?? aviz?.avizatLa ?? ""}
                />
              )}
            </Camp>

            <Camp
              nume="numar_aviz"
              eticheta="Numărul avizului"
              {...(stare.erori["numar_aviz"] === undefined
                ? {}
                : { erori: stare.erori["numar_aviz"] })}
            >
              {(atribute) => (
                <input
                  {...atribute}
                  id={idc("numar_aviz")}
                  maxLength={60}
                  defaultValue={stare.valoriTrimise["numar_aviz"] ?? aviz?.numarAviz ?? ""}
                />
              )}
            </Camp>
          </div>

          <Camp
            nume="directia_judeteana"
            eticheta="Direcția județeană"
            ajutor="Cine a confirmat nomenclatorul: Arhivele Naționale sau direcția județeană pe raza căreia se află firma."
            {...(stare.erori["directia_judeteana"] === undefined
              ? {}
              : { erori: stare.erori["directia_judeteana"] })}
          >
            {(atribute) => (
              <input
                {...atribute}
                id={idc("directia_judeteana")}
                maxLength={120}
                defaultValue={
                  stare.valoriTrimise["directia_judeteana"] ?? aviz?.directiaJudeteana ?? ""
                }
              />
            )}
          </Camp>

          <Camp
            nume="observatii"
            eticheta="Observații"
            fel="textarea"
            {...(stare.erori["observatii"] === undefined
              ? {}
              : { erori: stare.erori["observatii"] })}
          >
            {(atribute) => (
              <textarea
                {...atribute}
                id={idc("observatii")}
                rows={3}
                maxLength={1000}
                defaultValue={stare.valoriTrimise["observatii"] ?? aviz?.observatii ?? ""}
              />
            )}
          </Camp>
        </>
      )}
    </FormularDialog>
  );
}
