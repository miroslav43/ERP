// src/app/(app)/angajati/[id]/comutator-sef-departament.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";

import { buton } from "@/components/ui/buton";
import { arataToast } from "@/components/ui/toast";

import { desemneazaSefDepartament } from "../actions";

/**
 * „Șef al departamentului X" — bifat sau nu, de pe fișa omului.
 *
 * ── DE CE NU E ÎN DIALOGUL DE ÎNCADRARE ───────────────────────────────────
 * Scrie în `departments`, nu în `employees`, și cere `departments:update` în loc
 * de `employees:update`. Un `hr` poate schimba încadrarea cuiva fără să aibă
 * dreptul de a numi șefi; topite într-o singură casetă, cele două ar fi devenit
 * o permisiune pe care n-o are nimeni în bază.
 *
 * ── DE CE UN BUTON, ȘI NU UN `<input type="checkbox">` ────────────────────
 * Apăsarea are efecte care depășesc cu mult o bifă: noul șef primește rolul de
 * `manager`, fostul șef îl pierde dacă nu mai conduce nimic, iar membrii
 * departamentului trec în subordinea lui. O bifă care se salvează singură ar
 * ascunde toate trei. Butonul spune ce urmează să facă, iar notificarea spune
 * ce s-a întâmplat.
 *
 * ── CÂND ROLUL NU SE ACORDĂ ───────────────────────────────────────────────
 * `organization_members_update` cere `app.has_role(org, ['org_admin'])`. Un `hr`
 * are `departments:update = all`, deci structura se scrie, dar rolul nu — iar
 * acțiunea întoarce `rolAcordat: false`. Asta NU e o eroare și nu se raportează
 * ca atare: e o jumătate de treabă făcută, iar cealaltă jumătate trebuie cerută
 * unui administrator. Fără mesajul ăsta, omul ar crede că a terminat.
 */
interface Proprietati {
  readonly employeeId: string;
  readonly departamentId: string;
  readonly departamentDenumire: string;
  readonly esteSef: boolean;
}

export function ComutatorSefDepartament({
  employeeId,
  departamentId,
  departamentDenumire,
  esteSef,
}: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  function comuta(): void {
    porneste(async () => {
      const rezultat = await desemneazaSefDepartament({
        employee_id: employeeId,
        department_id: departamentId,
        sef: !esteSef,
      });

      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }

      // `informativ`, nu `reusita`: structura s-a scris, rolul nu. O bifă verde
      // ar spune „gata" pentru o treabă făcută pe jumătate. Nu există fel
      // „atenție" în `toast.tsx`, iar `eroare` ar fi fals — nimic n-a eșuat.
      arataToast(
        !esteSef && !rezultat.data.rolAcordat
          ? {
              fel: "informativ",
              text: `Este acum șef al departamentului „${departamentDenumire}”, dar rolul de manager nu a putut fi acordat: doar un administrator al organizației poate schimba roluri.`,
            }
          : {
              fel: "reusita",
              text: esteSef
                ? `Nu mai este șef al departamentului „${departamentDenumire}”.`
                : `Este acum șef al departamentului „${departamentDenumire}”, cu rolul de manager.`,
            },
      );
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={comuta}
      disabled={inCurs}
      className={buton({ varianta: esteSef ? "secundar" : "tertiar" })}
    >
      <Crown aria-hidden="true" className="size-3.5" />
      {inCurs
        ? "Se salvează…"
        : esteSef
          ? "Nu mai e șef de departament"
          : "Fă-l șef de departament"}
    </button>
  );
}
