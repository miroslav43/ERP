// src/app/(app)/angajati/[id]/incarcare-avatar-admin.tsx
"use client";

import { IncarcareAvatar } from "@/components/forms/incarcare-avatar";
import { pregatesteIncarcareAvatarAngajat, salveazaAvatarAngajat } from "./avatar-actions";

interface ProprietatiIncarcareAvatarAdmin {
  readonly employeeId: string;
  readonly urlInitial: string | null;
  readonly nume: string;
}

/** Adaptor subțire: leagă `employeeId` de acțiunile generice pe care le cere `IncarcareAvatar`. */
export function IncarcareAvatarAdmin({ employeeId, urlInitial, nume }: ProprietatiIncarcareAvatarAdmin) {
  return (
    <IncarcareAvatar
      urlInitial={urlInitial}
      nume={nume}
      pregateste={(input) => pregatesteIncarcareAvatarAngajat({ employeeId, ...input })}
      salveaza={(input) => salveazaAvatarAngajat({ employeeId, ...input })}
    />
  );
}
