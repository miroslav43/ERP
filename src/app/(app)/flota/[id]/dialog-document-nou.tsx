"use client";

import { Plus } from "lucide-react";
import type { ReactElement } from "react";

import { FormularDialog } from "@/components/ui/formular-dialog";
import type { TipDocument } from "@/lib/queries/fleet";

import { adaugaDocument } from "../actions";
import { CampuriDocument } from "./campuri-document";
import { valoriDocument } from "./valori-document";

/**
 * Adăugarea ȘI reînnoirea unui document, în casetă.
 *
 * Două declanșatoare, aceeași scriere (`adaugaDocument`, un INSERT nou):
 *  · cu `tip`: „+” pe rândul unui document care lipsește — tipul vine
 *    preselectat, omul nu-l mai alege o dată din lista pe care tocmai l-a
 *    văzut lipsind;
 *  · fără `tip`: butonul „Document nou” din capul secțiunii, cu tipul la
 *    alegere.
 *
 * Nu există „Reînnoiește” separat: reînnoirea e o inserare nouă, documentul
 * vechi rămâne istoric, iar `internal.vdoc_dupa` recalculează care e cel
 * curent — cel cu `expira_la` maxim, nu ultimul introdus.
 *
 * Panoul permanent de sub tabel („Adaugă sau reînnoiește un document”) a fost
 * scos: stătea deschis tot timpul, pe o fișă pe care se citește mult mai des
 * decât se scrie, și dubla „+”-ul de pe rând.
 */
interface Proprietati {
  readonly vehiculId: string;
  /** Tipul preselectat (rândul „Lipsește”). Absent ⇒ butonul general al secțiunii. */
  readonly tip?: TipDocument | undefined;
  readonly tipuri: readonly TipDocument[];
}

export function DialogDocumentNou({ vehiculId, tip, tipuri }: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return adaugaDocument({ vehicle_id: vehiculId, ...valoriDocument(date) });
  }

  return (
    <FormularDialog
      declansator={
        tip === undefined
          ? {
              eticheta: "Document nou",
              varianta: "secundar",
              pictograma: <Plus aria-hidden="true" className="size-4" />,
            }
          : {
              eticheta: <Plus aria-hidden="true" className="size-4" />,
              varianta: "tertiar",
              marime: "iconita",
              "aria-label": `Adaugă documentul „${tip.denumire}”`,
            }
      }
      titlu={tip === undefined ? "Adaugă sau reînnoiește un document" : `Adaugă „${tip.denumire}”`}
      descriere="Reînnoirea se face tot de aici: documentul cu data de expirare cea mai îndepărtată devine automat cel curent, iar cel vechi rămâne în istoric."
      marime="mare"
      actiune={trimite}
      mesajReusita="Documentul a fost salvat."
      etichetaTrimite="Salvează documentul"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <CampuriDocument stare={stare} idc={idc} tipuri={tipuri} tipImplicit={tip?.id} />
      )}
    </FormularDialog>
  );
}
