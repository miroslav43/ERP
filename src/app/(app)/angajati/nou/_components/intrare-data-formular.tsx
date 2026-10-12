// src/app/(app)/angajati/nou/_components/intrare-data-formular.tsx
"use client";

import { useController, type Control, type FieldPath } from "react-hook-form";

import type { AtributeControl } from "@/components/ui/camp";
import { IntrareData } from "@/components/ui/intrare-data";
import type { InroleazaAngajatInput } from "@/schemas/employee";

/**
 * `IntrareData` legată de starea asistentului de înrolare (ONB-033).
 *
 * Asistentul e pe react-hook-form, iar valorile pleacă din starea formularului,
 * nu din `FormData`. `register` nu se poate pune pe `IntrareData`: caseta
 * vizibilă n-are `name` și ține textul românesc, valoarea ISO stă în câmpul
 * ascuns. De aceea câmpul e CONTROLAT prin `useController`: un `setValue` din
 * afară (pasul 3 completează singur „Vechime în unitate din” din „Angajat de
 * la”) se vede în casetă, iar ce alege omul intră în formular ca ISO.
 *
 * `name` se oprește aici: fără `FormData`, câmpul ascuns n-ar servi nimănui,
 * iar căutarea `[name=…]` a focusului pe eroare l-ar nimeri pe el, invizibil,
 * în locul casetei. Caseta poartă `id`-ul lui `<Camp>`, pe care îl caută
 * focusul din `asistent-angajat-nou.tsx`.
 */
export function IntrareDataFormular({
  control,
  nume,
  atribute,
}: Readonly<{
  control: Control<InroleazaAngajatInput>;
  nume: FieldPath<InroleazaAngajatInput>;
  atribute: Partial<AtributeControl>;
}>) {
  const { field } = useController({ control, name: nume });
  const { name: _nume, ...faraNume } = atribute;
  return (
    <IntrareData
      {...faraNume}
      valoare={typeof field.value === "string" ? field.value : ""}
      onSchimba={(zi) => {
        field.onChange(zi);
        field.onBlur();
      }}
    />
  );
}
