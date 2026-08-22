"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, LogOut, UserRound } from "lucide-react";

import { comutaOrganizatiaDirect, deconecteaza } from "@/app/(app)/actions";
import { AvatarAngajat } from "@/components/data/avatar-angajat";

export interface OrganizatiePortal {
  readonly id: string;
  readonly name: string;
}

/**
 * Meniul de cont din antetul portalului: profil, comutare de firmă, deconectare.
 *
 * `<details>` nativ, ca în `components/layout/topbar.tsx` — zero JavaScript
 * propriu, tastatură și cititor de ecran gratis, fără ARIA scris de mână.
 *
 * `key={cale}` remontează elementul la fiecare navigare, deci panoul se închide
 * singur. Fără el, DOM-ul supraviețuiește navigării client-side și meniul rămâne
 * deschis peste pagina nouă.
 *
 * Comutarea de firmă e AICI, nu doar în aplicația mare, fiindcă altfel cineva
 * care e angajat într-o firmă și administrator în alta rămâne blocat în portal:
 * poarta îl trimite încoace, iar portalul n-avea niciun drum înapoi.
 */
export function MeniuCont({
  numeAfisat,
  email,
  avatarUrl,
  organizatii,
  organizatiaCurentaId,
}: {
  readonly numeAfisat: string;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly organizatii: readonly OrganizatiePortal[];
  readonly organizatiaCurentaId: string;
}) {
  const cale = usePathname();
  const altele = organizatii.filter((o) => o.id !== organizatiaCurentaId);

  return (
    <details key={cale} className="relative">
      <summary className="hover:bg-background flex size-11 cursor-pointer list-none items-center justify-center rounded-md [&::-webkit-details-marker]:hidden">
        <AvatarAngajat url={avatarUrl} nume={numeAfisat} marime="sm" />
        <span className="sr-only">Contul meu</span>
      </summary>

      <div className="border-border bg-surface absolute right-0 z-30 mt-1 w-64 rounded-md border p-1 shadow-lg">
        <div className="border-border border-b px-3 py-2">
          <p className="text-foreground truncate text-sm font-medium">{numeAfisat}</p>
          <p className="text-muted-foreground truncate text-xs">{email}</p>
        </div>

        <Link
          href="/portal/profilul-meu"
          className="text-foreground hover:bg-background flex min-h-11 items-center gap-2 rounded px-3 text-sm"
        >
          <UserRound aria-hidden="true" className="size-4 shrink-0" />
          Profilul meu
        </Link>

        {/* Un formular per firmă, fără <select> și fără JS: lista are două-trei
            elemente, iar un buton se apasă din prima. */}
        {altele.map((organizatie) => (
          <form key={organizatie.id} action={comutaOrganizatiaDirect}>
            <input type="hidden" name="organizationId" value={organizatie.id} />
            <button
              type="submit"
              className="text-foreground hover:bg-background flex min-h-11 w-full items-center gap-2 rounded px-3 text-left text-sm"
            >
              <ArrowLeftRight aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 truncate">Treci la {organizatie.name}</span>
            </button>
          </form>
        ))}

        <form action={deconecteaza}>
          <button
            type="submit"
            className="text-danger hover:bg-background flex min-h-11 w-full items-center gap-2 rounded px-3 text-left text-sm"
          >
            <LogOut aria-hidden="true" className="size-4 shrink-0" />
            Deconectare
          </button>
        </form>
      </div>
    </details>
  );
}
