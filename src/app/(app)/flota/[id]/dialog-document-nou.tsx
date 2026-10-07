"use client";

import { Plus } from "lucide-react";
import type { ReactElement } from "react";

import { FormularDialog } from "@/components/ui/formular-dialog";
import type { TipDocument } from "@/lib/queries/fleet";

import { adaugaDocument } from "../actions";
import { CampuriDocument } from "./campuri-document";
import { valoriDocument } from "./valori-document";

/**
 * „Adaugă” pe rândul unui document OBLIGATORIU care lipsește.
 *
 * Rândul roșu „Lipsește” nu avea nicio acțiune: celula întorcea `null` când
 * documentul nu exista, iar omul trebuia să coboare la panoul de sub tabel și
 * să aleagă din nou tipul pe care tocmai îl văzuse lipsind. `tipImplicit` din
 * `CampuriDocument` exista pentru exact cazul ăsta, dar nu-l trimitea nimeni.
 *
 * Scrierea e aceeași cu a panoului: `adaugaDocument`, un INSERT nou.
 */
interface Proprietati {
  readonly vehiculId: string;
  readonly tip: TipDocument;
  readonly tipuri: readonly TipDocument[];
}

export function DialogDocumentNou({ vehiculId, tip, tipuri }: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return adaugaDocument({ vehicle_id: vehiculId, ...valoriDocument(date) });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: <Plus aria-hidden="true" className="size-4" />,
        varianta: "tertiar",
        marime: "iconita",
        "aria-label": `Adaugă documentul „${tip.denumire}”`,
      }}
      titlu={`Adaugă „${tip.denumire}”`}
      descriere="Documentul devine curent singur, dacă are data de expirare cea mai îndepărtată."
      marime="mare"
      actiune={trimite}
      mesajReusita="Documentul a fost salvat."
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <CampuriDocument stare={stare} idc={idc} tipuri={tipuri} tipImplicit={tip.id} />
      )}
    </FormularDialog>
  );
}
