// src/components/incarcare/buton-trimite.tsx
"use client";

import { useFormStatus } from "react-dom";
import type { ReactElement, ReactNode } from "react";

import { useSemnalIncarcare } from "./use-incarcare";
import { Buton, type VariantaButon } from "@/components/ui/buton";

/**
 * Butonul de submit pentru formularele randate pe SERVER.
 *
 * Ăsta e golul sistemic al proiectului: `useFormStatus` apărea de ZERO ori în
 * `src/`, deși existau 36 de `<form action={…}>` cu Server Action, iar `Buton`
 * are rotița construită (`buton.tsx:124`) și nefolosită pe tot drumul de intrare.
 * Un Server Component nu poate purta hook-uri, deci butonul lui nu poate ști că
 * acțiunea e în zbor — decât dacă butonul însuși e client. Asta e tot.
 *
 * ── DE CE BLOCAREA CONTEAZĂ MAI MULT DECÂT ROTIȚA ─────────────────────────
 * react-dom 19.2.8 pornește acțiunea la ORICE `submit`: `startHostTransition`
 * nu are nicio verificare de „acțiune deja în curs". Pe `/alege-organizatia`
 * fiecare firmă e alt `<form>`, deci două clicuri pe două firme scriu amândouă
 * cookie-ul de organizație, iar care rămâne e nedeterminat. Pe `/autentificare`,
 * clicurile repetate consumă bugetul de 5 încercări la 15 minute — inclusiv cele
 * REUȘITE — deci omul care apasă de cinci ori fiindcă nu vede nimic își
 * blochează singur contul. `disabled` nu e cosmetică aici, e corectitudine.
 *
 * `useFormStatus` citește DOAR formularul-părinte, deci pe o listă de formulare
 * fiecare buton își știe doar starea lui. Blocarea celorlalte, când e nevoie de
 * ea, se face de către componenta care ține lista.
 */
export function ButonTrimite({
  children,
  textInCurs,
  eticheta,
  varianta = "primar",
  className,
  disabled,
}: Readonly<{
  children: ReactNode;
  /** Ce scrie pe buton cât lucrează. Fără el, textul rămâne cel normal, lângă rotiță. */
  textInCurs?: string | undefined;
  /** Ce se încarcă, pentru textul voalului global: „panoul", „lista de angajați". */
  eticheta?: string | undefined;
  varianta?: VariantaButon | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
}>): ReactElement {
  const { pending } = useFormStatus();
  useSemnalIncarcare(pending, eticheta);

  return (
    /*
      Răspândire condiționată, nu `className={className}`: `tsconfig` are
      `exactOptionalPropertyTypes`, iar `PropsButon` declară `className?: string`,
      nu `string | undefined`. Trimis explicit ca `undefined`, `tsc` îl refuză.
    */
    <Buton
      type="submit"
      varianta={varianta}
      inCurs={pending}
      {...(className === undefined ? {} : { className })}
      {...(textInCurs === undefined ? {} : { textInCurs })}
      {...(disabled === undefined ? {} : { disabled })}
    >
      {children}
    </Buton>
  );
}
