"use client";

// src/app/(app)/registru/dialog-document-primit.tsx
//
// Înregistrarea unui document primit pe hârtie.
//
// ── DE CE ECRANUL ĂSTA EXISTĂ ───────────────────────────────────────────────
// Ordinul 217/1996 art. 8 cere înregistrarea TUTUROR documentelor intrate, nu
// doar a celor pe care le produce aplicația. O demisie adusă la ghișeu, o adresă
// de la inspectoratul teritorial, o citație nu au rând în nicio tabelă — deci
// niciun trigger nu le poate prinde. Fără formularul ăsta, registrul e complet
// doar pe jumătate, iar jumătatea care lipsește e exact cea pe care o cere
// Codul muncii art. 81: „angajatorul este obligat să înregistreze demisia".
//
// Fluxul de demisie nu există încă în aplicație. Până există, pe aici trece.
//
// ── DE CE NU SE POATE ALEGE „IEȘIRE" ────────────────────────────────────────
// Ce emite firma are o sursă în bază și un trigger care înregistrează singur. O
// ieșire introdusă de mână ar fi un document pe care aplicația nu-l are — un
// număr alocat unei hârtii pe care nimeni n-o mai poate regăsi. Baza refuză
// oricum, cu P0001; lista de aici oprește mai devreme.

import { FormularDialog } from "@/components/ui/formular-dialog";
import { Camp } from "@/components/ui/camp";
import { FilePlus2 } from "lucide-react";

import { inregistreazaDocumentManual } from "./actions";

/** Tipurile pe care le primește o firmă pe hârtie, cu eticheta lor în română. */
const TIPURI = [
  ["document_personal", "Act depus la dosarul de personal"],
  ["cerere_concediu", "Cerere de concediu"],
  ["adeverinta", "Adeverință primită"],
  ["permis_munca", "Aviz sau permis de muncă"],
  ["fisa_aptitudine", "Fișă de aptitudine, medicina muncii"],
  ["autorizatie_iscir", "Autorizație ISCIR"],
  ["autorizatie_mediu", "Autorizație de mediu"],
  ["document_vehicul", "Document al vehiculului"],
  ["nota_interna", "Notă internă"],
] as const;

export function DialogDocumentPrimit() {
  return (
    <FormularDialog
      declansator={{
        eticheta: "Document primit",
        varianta: "secundar",
        pictograma: <FilePlus2 aria-hidden="true" className="size-4" />,
      }}
      titlu="Înregistrează un document primit"
      descriere="Pentru documentele care ajung pe hârtie și nu au corespondent în aplicație — o demisie, o adresă de la inspectorat, o citație. Numărul se alocă la salvare și nu se mai poate schimba."
      etichetaTrimite="Înregistrează"
      textInCurs="Se alocă numărul…"
      mesajReusita="Documentul a primit număr de înregistrare."
      actiune={async (date: FormData) =>
        inregistreazaDocumentManual({
          sens: String(date.get("sens") ?? "intrare"),
          tip_document: String(date.get("tip_document") ?? ""),
          continut_rezumat: String(date.get("continut_rezumat") ?? ""),
          numar_document_emitent: String(date.get("numar_document_emitent") ?? ""),
          data_document_emitent: String(date.get("data_document_emitent") ?? ""),
          emitent: String(date.get("emitent") ?? ""),
          numar_file: String(date.get("numar_file") ?? ""),
          numar_anexe: String(date.get("numar_anexe") ?? ""),
          punct_lucru_id: "",
        })
      }
    >
      {(stare, idc) => (
        <>
          <Camp
            nume="sens"
            eticheta="Sens"
            obligatoriu
            ajutor="Legea 16/1996 art. 7 împarte documentele în intrate, ieșite și întocmite pentru uz intern. Ce emite firma se înregistrează singur."
            {...(stare.erori["sens"] === undefined ? {} : { erori: stare.erori["sens"] })}
          >
            {(atribute) => (
              <select
                {...atribute}
                id={idc("sens")}
                defaultValue={stare.valoriTrimise["sens"] ?? "intrare"}
              >
                <option value="intrare">Intrat — primit din afara firmei</option>
                <option value="intern">Uz intern — întocmit în firmă</option>
              </select>
            )}
          </Camp>

          <Camp
            nume="tip_document"
            eticheta="Tip document"
            obligatoriu
            ajutor="Tipul decide dosarul din nomenclator, deci indicativul care se trece pe document."
            {...(stare.erori["tip_document"] === undefined
              ? {}
              : { erori: stare.erori["tip_document"] })}
          >
            {(atribute) => (
              <select
                {...atribute}
                id={idc("tip_document")}
                defaultValue={stare.valoriTrimise["tip_document"] ?? "document_personal"}
              >
                {TIPURI.map(([valoare, eticheta]) => (
                  <option key={valoare} value={valoare}>
                    {eticheta}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <Camp
            nume="continut_rezumat"
            eticheta="Conținutul documentului, în rezumat"
            fel="textarea"
            obligatoriu
            ajutor="Ordin 217/1996 art. 9. Ce scrieți aici e tot ce va vedea un inspector despre documentul acesta."
            {...(stare.erori["continut_rezumat"] === undefined
              ? {}
              : { erori: stare.erori["continut_rezumat"] })}
          >
            {(atribute) => (
              <textarea
                {...atribute}
                id={idc("continut_rezumat")}
                rows={3}
                maxLength={500}
                defaultValue={stare.valoriTrimise["continut_rezumat"] ?? ""}
                placeholder="Demisie depusă de Popescu Ion, cu preaviz de 20 de zile lucrătoare"
              />
            )}
          </Camp>

          <Camp
            nume="emitent"
            eticheta="Emitentul"
            ajutor="Cine a întocmit documentul: salariatul, inspectoratul, medicul, instanța."
            {...(stare.erori["emitent"] === undefined ? {} : { erori: stare.erori["emitent"] })}
          >
            {(atribute) => (
              <input
                {...atribute}
                id={idc("emitent")}
                maxLength={200}
                defaultValue={stare.valoriTrimise["emitent"] ?? ""}
              />
            )}
          </Camp>

          <div className="grid gap-4 sm:grid-cols-2">
            <Camp
              nume="numar_document_emitent"
              eticheta="Numărul dat de emitent"
              ajutor="Art. 9 cere ambele numere: al nostru și al lui."
              {...(stare.erori["numar_document_emitent"] === undefined
                ? {}
                : { erori: stare.erori["numar_document_emitent"] })}
            >
              {(atribute) => (
                <input
                  {...atribute}
                  id={idc("numar_document_emitent")}
                  maxLength={120}
                  defaultValue={stare.valoriTrimise["numar_document_emitent"] ?? ""}
                />
              )}
            </Camp>

            <Camp
              nume="data_document_emitent"
              eticheta="Data documentului"
              {...(stare.erori["data_document_emitent"] === undefined
                ? {}
                : { erori: stare.erori["data_document_emitent"] })}
            >
              {(atribute) => (
                <input
                  {...atribute}
                  id={idc("data_document_emitent")}
                  type="date"
                  defaultValue={stare.valoriTrimise["data_document_emitent"] ?? ""}
                />
              )}
            </Camp>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Camp
              nume="numar_file"
              eticheta="Numărul filelor"
              {...(stare.erori["numar_file"] === undefined
                ? {}
                : { erori: stare.erori["numar_file"] })}
            >
              {(atribute) => (
                <input
                  {...atribute}
                  id={idc("numar_file")}
                  type="number"
                  min={0}
                  max={9999}
                  defaultValue={stare.valoriTrimise["numar_file"] ?? ""}
                />
              )}
            </Camp>

            <Camp
              nume="numar_anexe"
              eticheta="Numărul anexelor"
              {...(stare.erori["numar_anexe"] === undefined
                ? {}
                : { erori: stare.erori["numar_anexe"] })}
            >
              {(atribute) => (
                <input
                  {...atribute}
                  id={idc("numar_anexe")}
                  type="number"
                  min={0}
                  max={9999}
                  defaultValue={stare.valoriTrimise["numar_anexe"] ?? ""}
                />
              )}
            </Camp>
          </div>
        </>
      )}
    </FormularDialog>
  );
}
