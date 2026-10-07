// src/app/(app)/mentenanta/echipamente/[id]/buton-editeaza-echipament.tsx
"use client";

import { Pencil } from "lucide-react";
import type { ReactElement } from "react";

import { FormularDialog } from "@/components/ui/formular-dialog";

import { actualizeazaEchipament } from "../../actions";
import {
  CampuriEchipament,
  type OptiuneEchipament,
  type ValoriInitialeEchipament,
} from "../campuri-echipament";
import { valoriEchipament } from "../valori-echipament";

export type EchipamentEditabil = ValoriInitialeEchipament & Readonly<{ id: string }>;

/**
 * Editarea fișei de echipament, în casetă — pe `FormularDialog`, ca restul.
 *
 * ── CE S-A SCHIMBAT ───────────────────────────────────────────────────────
 * Până la M2 caseta era un `Dialog` gol în jurul lui `formular-echipament.tsx`,
 * singurul formular de mentenanță pe react-hook-form: cele două arhitecturi nu
 * se unificau, deci butoanele stăteau în formular, erorile de server se împăcau
 * de mână cu cele de client, iar „Echipament nou" rămăsese pagină întreagă.
 * `CampuriEchipament` + `valoriEchipament` sunt aceleași în ambele casete;
 * `FormularDialog` aduce de la sine toast-ul, `router.refresh()` și refuzul de a
 * se închide cât o trimitere e în zbor.
 *
 * ── DE CE NU MAI E UN `<details>` ─────────────────────────────────────────
 * Cele șaisprezece câmpuri se desfăceau ÎN pagină și împingeau sub linia de
 * plutire planurile, intervențiile și scadențele ISCIR — adică toată partea
 * pentru care se intră pe fișă.
 */
export function ButonEditeazaEchipament({
  echipament,
  angajati,
  departamente,
  ssmActiv,
  poateDerogare,
}: {
  readonly echipament: EchipamentEditabil;
  readonly angajati: readonly OptiuneEchipament[];
  readonly departamente: readonly OptiuneEchipament[];
  readonly ssmActiv: boolean;
  readonly poateDerogare: boolean;
}): ReactElement {
  async function trimite(date: FormData) {
    return actualizeazaEchipament({ id: echipament.id, ...valoriEchipament(date) });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Editează datele echipamentului",
        varianta: "secundar",
        pictograma: <Pencil aria-hidden="true" className="size-4" />,
      }}
      titlu={`Editează „${echipament.denumire}”`}
      descriere="Codul echipamentului e unic în organizație. Trecerea pe „ISCIR” cere tipul autorizării, iar un responsabil fără autorizație nominală valabilă e refuzat de bază — sau acceptat cu derogare motivată, de un administrator."
      marime="lucru"
      actiune={trimite}
      mesajReusita="Datele echipamentului au fost salvate."
      etichetaTrimite="Salvează modificările"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <CampuriEchipament
          stare={stare}
          idc={idc}
          angajati={angajati}
          departamente={departamente}
          ssmActiv={ssmActiv}
          poateDerogare={poateDerogare}
          echipament={echipament}
        />
      )}
    </FormularDialog>
  );
}
