"use client";

import { Pencil } from "lucide-react";
import type { ReactElement } from "react";

import { FormularDialog } from "@/components/ui/formular-dialog";
import type { DocumentVehicul, TipDocument } from "@/lib/queries/fleet";

import { actualizeazaDocument } from "../actions";
import { CampuriDocument } from "./campuri-document";
import { valoriDocument } from "./valori-document";

/**
 * Corectarea unui document deja introdus. NU e reînnoire.
 *
 * Reînnoirea rămâne panoul din pagină: polița nouă e un rând nou, cea veche
 * rămâne ca istoric. Caseta asta e pentru cifra greșită — data pusă anapoda,
 * emitentul scris pe jumătate, costul uitat. Distincția contează fiindcă un
 * UPDATE peste polița veche ar șterge tocmai dovada că a existat.
 *
 * `document_type_id` rămâne modificabil: cine a ales „Asigurare RCA" în loc de
 * „Asigurare CASCO" trebuie să poată repara fără să șteargă și să reintroducă.
 * `internal.vdoc_dupa` resincronizează amândouă grupurile în cazul ăsta.
 */
interface Proprietati {
  readonly vehiculId: string;
  readonly documentul: DocumentVehicul;
  readonly denumireTip: string;
  readonly tipuri: readonly TipDocument[];
}

export function DialogDocument({
  vehiculId,
  documentul,
  denumireTip,
  tipuri,
}: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return actualizeazaDocument({
      id: documentul.id,
      vehicle_id: vehiculId,
      ...valoriDocument(date),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: <Pencil aria-hidden="true" className="size-4" />,
        varianta: "tertiar",
        marime: "iconita",
        "aria-label": `Modifică documentul „${denumireTip}”`,
      }}
      titlu={`Modifică „${denumireTip}”`}
      descriere="Corectează datele documentului existent. Pentru o poliță NOUĂ folosiți panoul de adăugare — reînnoirea păstrează documentul vechi ca istoric."
      marime="mare"
      actiune={trimite}
      mesajReusita="Documentul a fost actualizat."
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <CampuriDocument stare={stare} idc={idc} tipuri={tipuri} documentul={documentul} />
      )}
    </FormularDialog>
  );
}
