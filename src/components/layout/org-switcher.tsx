// src/components/layout/org-switcher.tsx
"use client";

/**
 * De ce <select> nativ și nu Radix DropdownMenu:
 * 1. Comutarea este o alegere dintr-o listă scurtă, exclusivă — exact semantica lui <select>.
 * 2. Accesibilitatea (rol, aria-expanded, navigare cu săgeți, tastare rapidă, VoiceOver/NVDA,
 *    picker nativ pe mobil) vine gratuit și corect, fără focus trap sau portal de întreținut.
 * 3. Funcționează fără JavaScript: <form action> + buton de submit rămâne utilizabil.
 * Un DropdownMenu ar fi justificat abia când elementele au acțiuni secundare (ex. „Părăsește organizația”).
 */

import { useActionState, useId, useState } from "react";
import { Building2, Check, Loader2 } from "lucide-react";

import { comutaOrganizatia } from "@/app/(app)/actions";
import { STARE_INITIALA_COMUTARE, type StareComutare } from "@/app/(app)/actions-types";

type Rol = "super_admin" | "org_admin" | "manager" | "hr" | "employee";

const ETICHETE_ROL: Readonly<Record<Rol, string>> = {
  super_admin: "Super-administrator",
  org_admin: "Administrator",
  manager: "Manager",
  hr: "Resurse umane",
  employee: "Angajat",
};

export type OrganizatieComutator = Readonly<{
  id: string;
  slug: string;
  name: string;
  role: Rol;
}>;

type Props = Readonly<{
  organizatii: readonly OrganizatieComutator[];
  organizatiaCurentaId: string;
}>;

export function OrgSwitcher({ organizatii, organizatiaCurentaId }: Props) {
  const idSelect = useId();
  const [selectata, setSelectata] = useState<string>(organizatiaCurentaId);
  const [stare, actiune, inCurs] = useActionState<StareComutare, FormData>(
    comutaOrganizatia,
    STARE_INITIALA_COMUTARE,
  );

  // Comutatorul are sens doar pentru cine chiar are unde comuta.
  if (organizatii.length <= 1) {
    return null;
  }

  const neschimbata = selectata === organizatiaCurentaId;

  return (
    <form action={actiune} className="flex items-center gap-2">
      <label htmlFor={idSelect} className="sr-only">
        Organizația activă
      </label>
      <div className="relative flex items-center">
        <Building2
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute left-2 h-4 w-4"
        />
        <select
          id={idSelect}
          name="organizationId"
          value={selectata}
          onChange={(eveniment) => setSelectata(eveniment.target.value)}
          disabled={inCurs}
          className="border-border bg-surface text-foreground disabled:border-border disabled:bg-surface disabled:text-muted-foreground h-9 max-w-56 truncate rounded-md border py-1 pr-2 pl-8 text-sm disabled:cursor-not-allowed"
        >
          {organizatii.map((organizatie) => (
            <option key={organizatie.id} value={organizatie.id}>
              {organizatie.name} — {ETICHETE_ROL[organizatie.role]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={neschimbata || inCurs}
        className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium disabled:cursor-not-allowed"
      >
        {inCurs ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <Check aria-hidden="true" className="h-4 w-4" />
        )}
        {inCurs ? "Se comută…" : "Comută"}
      </button>

      <p role="status" aria-live="polite" className="sr-only">
        {inCurs ? "Se comută organizația." : (stare.eroare ?? "")}
      </p>
      {stare.eroare !== null ? <span className="text-danger text-sm">{stare.eroare}</span> : null}
    </form>
  );
}
