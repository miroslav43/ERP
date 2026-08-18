// src/app/(app)/profil/page.tsx
import type { Metadata } from "next";

import { FormularProfil } from "@/components/forms/formular-profil";
import { requireUser } from "@/lib/auth/current-user";
import { citesteProfilPropriu } from "@/lib/queries/profile";
import { formatDateTime } from "@/lib/format/date";

export const metadata: Metadata = { title: "Profilul meu" };

export default async function PaginaProfil() {
  const user = await requireUser();
  const profil = await citesteProfilPropriu(user.id);

  return (
    <main className="max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Profilul meu</h1>
        <p className="text-muted-foreground text-sm">
          {profil?.email ?? user.email}
          {profil === null
            ? null
            : ` · cont din ${formatDateTime(profil.created_at)}`}
        </p>
      </header>

      <FormularProfil
        numeInitial={profil?.full_name ?? user.fullName ?? ""}
        telefonInitial={profil?.phone ?? null}
      />
    </main>
  );
}
