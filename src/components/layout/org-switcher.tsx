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
      {/*
        Câmpul rămâne CREM deși stă pe navy, și e singurul control din antet
        care face asta. Motivul e că lista de opțiuni a unui `<select>` nativ o
        desenează browserul, nu pagina: `bg-transparent` ar face doar caseta să
        se topească în navy, iar opțiunile ar rămâne pe fundalul lui — text
        crem pe crem la deschidere. Un câmp crem, cu chenar, arată ca un
        control și se citește în ambele stări (16,03:1 închis, la fel deschis).
      */}
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
          className="border-border bg-background text-foreground rounded-control text-corp disabled:border-border disabled:bg-surface disabled:text-muted-foreground h-9 max-w-56 truncate border py-1 pr-2 pl-8 disabled:cursor-not-allowed"
        >
          {organizatii.map((organizatie) => (
            <option key={organizatie.id} value={organizatie.id}>
              {organizatie.name} — {ETICHETE_ROL[organizatie.role]}
            </option>
          ))}
        </select>
      </div>

      {/*
        `bg-primary` ar fi fost navy pe navy — butonul ar fi dispărut în antet.
        Pe navy, „plin" se face din alb translucid: `white/70` (8,61:1) în
        repaus, alb plin la hover. Blocat, coboară la `white/60` (6,67:1) —
        peste prag, dar vizibil mai stins decât starea activă. Starea blocată se
        face din culoare, niciodată din opacitate: diluată la jumătate ar fi dat
        3,22:1, iar la 60% tot doar 4,34:1.
      */}
      <button
        type="submit"
        disabled={neschimbata || inCurs}
        className="rounded-control text-corp inline-flex h-9 items-center gap-1.5 border border-white/15 px-3 font-medium text-white/70 transition-colors enabled:hover:bg-white/10 enabled:hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/60"
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
      {/*
        Eroarea nu poate fi `text-danger` aici: #b3261e pe #0f1e3d dă 2,51:1.
        Inversată — text crem pe roșu plin — urcă la 6,23:1 și rămâne roșie.
      */}
      {stare.eroare !== null ? (
        <span className="bg-danger text-danger-foreground rounded-control text-nota px-2 py-1">
          {stare.eroare}
        </span>
      ) : null}
    </form>
  );
}
