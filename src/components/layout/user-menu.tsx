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
        className="hover:bg-surface flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
      >
        <UserRound className="text-muted-foreground size-5 shrink-0" aria-hidden />
        <span className="hidden max-w-[12rem] truncate sm:inline">{nume}</span>
      </button>

      {deschis && (
        <div
          role="menu"
          aria-label="Contul meu"
          className="bg-surface border-border absolute right-0 z-30 mt-1 w-64 rounded-md border p-1 shadow-md"
        >
          <div className="border-border border-b px-3 py-2">
            <p className="truncate text-sm font-medium">{nume}</p>
            <p className="text-muted-foreground truncate text-xs">{user.email}</p>
            <p className="text-muted-foreground mt-1 text-xs">{ROLURI[role] ?? role}</p>
          </div>
          <Link
            href="/profil"
            role="menuitem"
            onClick={() => setDeschis(false)}
            className="hover:bg-background flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm"
          >
            <User className="size-4 shrink-0" aria-hidden />
            Profilul meu
          </Link>
          <form action={deconecteaza} role="none">
            <button
              type="submit"
              role="menuitem"
              className="hover:bg-background flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm"
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
