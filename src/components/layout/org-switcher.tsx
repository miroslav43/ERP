// src/components/layout/org-switcher.tsx
"use client";

import { useState } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { switchOrganization } from "@/app/(app)/actions";
import type { OrgSummary } from "@/lib/tenant/types";

/**
 * Comutatorul apare doar dacă utilizatorul are mai multe organizații.
 * Nu trimite niciodată `organization_id` altui endpoint: Server Action-ul
 * revalidează apartenența, iar cookie-ul rămâne un hint neîncrezut.
 */
export function OrgSwitcher({
  organizations,
  activeId,
  activeName,
}: {
  organizations: readonly OrgSummary[];
  activeId: string;
  activeName: string;
}) {
  const [deschis, setDeschis] = useState(false);

  if (organizations.length <= 1) {
    return (
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <Building2 className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <span className="truncate">{activeName}</span>
      </span>
    );
  }

  return (
    <div
      className="relative"
      onKeyDown={(eveniment) => {
        if (eveniment.key === "Escape") setDeschis(false);
      }}
      onBlur={(eveniment) => {
        if (!eveniment.currentTarget.contains(eveniment.relatedTarget)) setDeschis(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={deschis}
        onClick={() => setDeschis(!deschis)}
        className="hover:bg-surface flex max-w-[16rem] items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium"
      >
        <Building2 className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <span className="truncate">{activeName}</span>
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </button>

      {deschis && (
        <div
          role="menu"
          aria-label="Organizațiile dvs."
          className="bg-surface border-border absolute left-0 z-30 mt-1 w-72 rounded-md border p-1 shadow-md"
        >
          {organizations.map((organizatie) => (
            <form key={organizatie.id} action={switchOrganization} role="none">
              <input type="hidden" name="organizationId" value={organizatie.id} />
              <button
                type="submit"
                role="menuitem"
                className="hover:bg-background flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{organizatie.name}</span>
                {organizatie.id === activeId && (
                  <>
                    <Check className="text-primary size-4 shrink-0" aria-hidden />
                    <span className="sr-only">(organizația activă)</span>
                  </>
                )}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
