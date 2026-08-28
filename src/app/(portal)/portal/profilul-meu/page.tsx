// src/app/(portal)/portal/profilul-meu/page.tsx
import type { Metadata } from "next";
import { LogOut } from "lucide-react";

import { deconecteaza } from "@/app/(app)/actions";
import { FormularProfil } from "@/components/forms/formular-profil";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { requireUser } from "@/lib/auth/current-user";
import { urlAvatar } from "@/lib/avatar/cale";
import { citesteProfilPropriu } from "@/lib/queries/profile";
import { ButonTrimite } from "@/components/incarcare/buton-trimite";

export const metadata: Metadata = { title: "Profilul meu" };

export default async function PaginaProfilulMeu() {
  const user = await requireUser();
  const profil = await citesteProfilPropriu(user.id);

  return (
    <div className="space-y-6 p-4">
      <AntetPagina titlu="Profilul meu" descriere={profil?.email ?? user.email} />

      <FormularProfil
        numeInitial={profil?.full_name ?? user.fullName ?? ""}
        telefonInitial={profil?.phone ?? null}
        avatarUrlInitial={urlAvatar(profil?.avatar_path ?? null)}
      />

      <form action={deconecteaza}>
        <ButonTrimite varianta="secundar" className="w-full" textInCurs="Se deconectează…">
          <LogOut className="size-4 shrink-0" aria-hidden />
          Deconectare
        </ButonTrimite>
      </form>
    </div>
  );
}
