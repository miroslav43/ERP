// src/app/(app)/mentenanta/echipamente/[id]/buton-editeaza-echipament.tsx
"use client";

import { Pencil } from "lucide-react";
import { useCallback, useState } from "react";

import { Buton } from "@/components/ui/buton";
import { Dialog } from "@/components/ui/dialog";

import { FormularEchipament, type EchipamentEditabil } from "../formular-echipament";

/**
 * Editarea fișei de echipament, într-o casetă.
 *
 * ── DE CE `Dialog`, NU `FormularDialog` ───────────────────────────────────
 * `FormularDialog` cere o acțiune cu semnătura `(date: FormData) => …`, fiindcă
 * își randează singur `<form action={…}>`. `FormularEchipament` e însă unul
 * dintre cele patru formulare pe react-hook-form din depozit: `handleSubmit`
 * predă un obiect deja validat, nu `FormData`, iar formularul își poartă propriul
 * `<form onSubmit={…}>` cu butonul lui înăuntru. Cele două arhitecturi nu se
 * unifică — și nici nu trebuie: `Dialog` e exact stratul de care e nevoie aici,
 * iar `FormularDialog` e doar `Dialog` plus partea de `FormData`.
 *
 * ── DE CE NU MAI E UN `<details>` ─────────────────────────────────────────
 * Cele șaisprezece câmpuri se desfăceau ÎN pagină, sub lista de date a
 * echipamentului, și împingeau sub linia de plutire planurile de mentenanță,
 * intervențiile și scadențele ISCIR — adică toată partea pentru care se intră pe
 * fișă. `<details>` ascundea problema cât era închis, dar deschis o avea
 * întreagă.
 *
 * Caseta se randează doar cât e deschisă: react-hook-form își construiește
 * starea pentru șaisprezece câmpuri la montare, iar fișa nu trebuie să plătească
 * asta pentru un formular pe care nu-l deschide nimeni. Montarea îl și repune pe
 * valorile din bază, deci o încercare abandonată nu lasă urme.
 */
export function ButonEditeazaEchipament(props: {
  readonly echipament: EchipamentEditabil;
  readonly angajati: readonly { readonly id: string; readonly nume: string }[];
  readonly departamente: readonly { readonly id: string; readonly nume: string }[];
  readonly ssmActiv: boolean;
  readonly poateDerogare: boolean;
}) {
  const [deschis, setDeschis] = useState(false);

  const inchide = useCallback((): void => {
    setDeschis(false);
  }, []);

  return (
    <>
      <Buton
        varianta="secundar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        <Pencil aria-hidden="true" className="size-4" />
        Editează datele echipamentului
      </Buton>

      {deschis ? (
        <Dialog
          deschis
          laInchidere={inchide}
          titlu={`Editează „${props.echipament.denumire}”`}
          descriere="Codul echipamentului e unic în organizație. Trecerea pe „ISCIR” cere tipul autorizării, iar scoaterea din regim ISCIR fără o derogare motivată e refuzată de bază."
          marime="lucru"
        >
          <FormularEchipament {...props} laReusita={inchide} />
        </Dialog>
      ) : null}
    </>
  );
}
