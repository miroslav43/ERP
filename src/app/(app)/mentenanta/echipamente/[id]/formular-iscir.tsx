"use client";

import { Plus } from "lucide-react";
import { useCallback } from "react";

import { FormularDialog } from "@/components/ui/formular-dialog";
import { adaugaAutorizatieIscir } from "../../actions";
import { CampuriAutorizatie } from "../../iscir/campuri-autorizatie";
import { valoriAutorizatie } from "../../iscir/valori-autorizatie";

/**
 * Autorizația ISCIR nouă, pe `<Formular>` + `<Camp>`.
 *
 * ── CE S-A REPARAT ────────────────────────────────────────────────────────
 * Formularul avea `<form action={trimite}>` cu câmpuri necontrolate. React 19
 * RESETEAZĂ un asemenea formular după ce acțiunea se încheie, deci o eroare de
 * validare — un `valabil_pana` scris greșit — golea și numărul, și tipul, și
 * condițiile. `<Formular>` ține starea în `useActionState` și dă valorile
 * înapoi prin `valoriTrimise`; fiecare `fieldErrors` stă lângă câmpul lui.
 *
 * ── M7 (0211) ─────────────────────────────────────────────────────────────
 * Câmpurile sunt cele din `iscir/campuri-autorizatie.tsx`, comune cu caseta
 * „Corectează”: regimul (echipament sub prag, în evidența RSVTI, fără număr —
 * cazul 42) și tipul din listă (`TIPURI_ISCIR`), nu text liber. Corectarea,
 * reînnoirea, suspendarea și ștergerea stau în `iscir/actiuni-autorizatie.tsx`.
 *
 * ── DE CE `id` EXPLICIT PE FIECARE CÂMP ───────────────────────────────────
 * Două casete pot fi deschise una după alta fără reîncărcare (nouă, apoi
 * corectura uneia existente), iar `tip` apare în mai multe; `idc` dă prefixul.
 */
export function FormularIscir({ equipmentId }: { readonly equipmentId: string }) {
  const trimite = useCallback(
    async (formular: FormData) =>
      await adaugaAutorizatieIscir({ ...valoriAutorizatie(formular), equipment_id: equipmentId }),
    [equipmentId],
  );

  return (
    <FormularDialog
      declansator={{
        eticheta: "Autorizație ISCIR nouă",
        varianta: "secundar",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Autorizație ISCIR nouă"
      descriere="Termenele intră în scadențele modulului și în alertele zilnice. O autorizație sau o verificare expirată se arată roșu peste tot; aplicația avertizează, nu oprește utilajul. Pentru un document care îl înlocuiește pe cel de acum, folosiți „Reînnoiește” pe autorizația existentă."
      marime="mare"
      actiune={trimite}
      mesajReusita="Autorizația ISCIR a fost salvată."
      etichetaTrimite="Salvează autorizația"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => <CampuriAutorizatie stare={stare} idc={idc} />}
    </FormularDialog>
  );
}
