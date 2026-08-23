// src/components/layout/user-menu.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, User, UserRound } from "lucide-react";
import { deconecteaza } from "@/app/(app)/actions";
import type { AppRole, AuthUser } from "@/lib/tenant/types";

const ROLURI: Record<string, string> = {
  super_admin: "Administrator platformă",
  org_admin: "Administrator",
  manager: "Manager",
  hr: "Resurse umane",
  employee: "Angajat",
};

/**
 * Meniul de cont al antetului — CONVERTIT CROMATIC, ÎNCĂ NEMONTAT.
 *
 * Astăzi are zero importuri: `topbar.tsx` desenează meniul cu un `<details>`,
 * care se închide doar la un al doilea clic pe rezumat. Componenta asta e mai
 * bună pe două puncte care se simt la tastatură: închide la `Escape` și închide
 * când focusul iese din ea (`relatedTarget` verificat pe `currentTarget`), plus
 * `role="menu"` / `role="menuitem"` corect.
 *
 * E gata de folosit: primește `user` și `role`, deci înlocuirea din `topbar.tsx`
 * e o schimbare de o linie plus cele două props. NU a fost făcută aici,
 * deliberat — montarea schimbă comportamentul antetului, iar asta e altă
 * schimbare decât recolorarea, și se verifică altfel.
 *
 * Cromatica e cea a antetului navy: declanșatorul pe `white/70` → `white` la
 * hover, panoul cade pe pânză și revine integral la crem.
 */
export function UserMenu({ user, role }: { user: AuthUser; role: AppRole }) {
  const [deschis, setDeschis] = useState(false);
  const nume = user.fullName ?? user.email;

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
        className="rounded-control text-corp flex h-9 items-center gap-2 px-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <UserRound className="size-5 shrink-0" aria-hidden />
        <span className="hidden max-w-[12rem] truncate sm:inline">{nume}</span>
      </button>

      {deschis && (
        <div
          role="menu"
          aria-label="Contul meu"
          className="bg-background border-border rounded-panou shadow-plutitor z-meniu absolute right-0 mt-1 w-64 border p-1"
        >
          <div className="border-border border-b px-3 py-2">
            <p className="text-foreground text-corp truncate font-medium">{nume}</p>
            <p className="text-muted-foreground text-nota truncate">{user.email}</p>
            <p className="text-muted-foreground text-nota mt-1">{ROLURI[role] ?? role}</p>
          </div>
          <Link
            href="/profil"
            role="menuitem"
            onClick={() => setDeschis(false)}
            className="text-foreground rounded-control hover:bg-surface text-corp flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
          >
            <User className="size-4 shrink-0" aria-hidden />
            Profilul meu
          </Link>
          <form action={deconecteaza} role="none">
            <button
              type="submit"
              role="menuitem"
              className="text-danger rounded-control hover:bg-surface text-corp flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              Deconectare
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
