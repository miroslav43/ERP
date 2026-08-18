// src/app/(portal)/portal/profilul-meu/page.tsx
import type { Metadata } from "next";
import { LogOut } from "lucide-react";

import { deconecteaza } from "@/app/(app)/actions";
import { FormularProfil } from "@/components/forms/formular-profil";
import { requireUser } from "@/lib/auth/current-user";
import { citesteProfilPropriu } from "@/lib/queries/profile";

export const metadata: Metadata = { title: "Profilul meu" };

export default async function PaginaProfilulMeu() {
  const user = await requireUser();
  const profil = await citesteProfilPropriu(user.id);

  return (
    <div className="space-y-6 p-4">
      <header>
        <h1 className="text-foreground text-xl font-semibold">Profilul meu</h1>
        <p className="text-muted-foreground text-sm">{profil?.email ?? user.email}</p>
      </header>

      <FormularProfil
        numeInitial={profil?.full_name ?? user.fullName ?? ""}
        telefonInitial={profil?.phone ?? null}
      />

      <form action={deconecteaza}>
        <button
          type="submit"
          className="border-border hover:bg-surface flex w-full min-h-11 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          Deconectare
        </button>
      </form>
    </div>
  );
}
