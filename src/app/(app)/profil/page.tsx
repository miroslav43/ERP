// src/app/(app)/profil/page.tsx
import type { Metadata } from "next";

import { FormularProfil } from "@/components/forms/formular-profil";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { requireUser } from "@/lib/auth/current-user";
import { urlAvatar } from "@/lib/avatar/cale";
import { citesteProfilPropriu } from "@/lib/queries/profile";
import { formatDateTime } from "@/lib/format/date";

export const metadata: Metadata = { title: "Profilul meu" };

export default async function PaginaProfil() {
  const user = await requireUser();
  const profil = await citesteProfilPropriu(user.id);

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <AntetPagina
        titlu="Profilul meu"
        descriere={
          (profil?.email ?? user.email) +
          (profil === null ? "" : ` · cont din ${formatDateTime(profil.created_at)}`)
        }
      />

      <FormularProfil
        numeInitial={profil?.full_name ?? user.fullName ?? ""}
        telefonInitial={profil?.phone ?? null}
        avatarUrlInitial={urlAvatar(profil?.avatar_path ?? null)}
      />
    </div>
  );
}
