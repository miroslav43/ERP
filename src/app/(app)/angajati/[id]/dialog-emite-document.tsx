// src/app/(app)/angajati/[id]/dialog-emite-document.tsx
"use client";

import { FilePlus2 } from "lucide-react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";

import { emiteDocumentPersonalizat } from "./documente/actions";

export type OptiuneDocumentFirma = Readonly<{ cod: string; denumire: string; serie: string }>;

async function trimite(fd: FormData) {
  return emiteDocumentPersonalizat({
    employeeId: String(fd.get("employeeId") ?? ""),
    cod: String(fd.get("cod") ?? ""),
  });
}

/**
 * Emiterea unui document creat de firmă, pentru angajatul din fișă.
 *
 * Spre deosebire de regenerare, nu anulează nimic: un document al firmei se
 * poate emite de câte ori e nevoie, fiecare cu numărul lui din serie.
 */
export function DialogEmiteDocument({
  employeeId,
  documente,
}: Readonly<{
  employeeId: string;
  documente: readonly OptiuneDocumentFirma[];
}>): React.ReactElement {
  return (
    <FormularDialog
      declansator={{
        eticheta: "Emite document",
        varianta: "secundar",
        pictograma: <FilePlus2 aria-hidden="true" className="size-4" />,
      }}
      titlu="Emiterea unui document al firmei"
      descriere="Documentul se generează din șablonul firmei, cu datele angajatului completate automat, primește următorul număr din serie și se înregistrează în registrul general."
      actiune={trimite}
      etichetaTrimite="Emite"
      textInCurs="Se emite…"
      laReusita={(data) => {
        arataToast({
          fel: "reusita",
          text: `${data.denumire} a fost emis cu numărul ${data.numarAfisat}.`,
        });
      }}
    >
      {(stare, idc) => (
        <div className="space-y-4">
          <input type="hidden" name="employeeId" value={employeeId} />
          <Camp
            nume="cod"
            id={idc("cod")}
            eticheta="Documentul"
            fel="select"
            obligatoriu
            erori={stare.erori["cod"] ?? []}
          >
            {(atribute) => (
              <select {...atribute} defaultValue={stare.valoriTrimise["cod"] ?? ""}>
                <option value="" disabled>
                  Alege documentul…
                </option>
                {documente.map((d) => (
                  <option key={d.cod} value={d.cod}>
                    {d.denumire} (seria {d.serie})
                  </option>
                ))}
              </select>
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
