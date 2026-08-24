// src/app/(portal)/_components/antet-portal.tsx
import Link from "next/link";
import { Bell } from "lucide-react";

import { MeniuCont, type OrganizatiePortal } from "./meniu-cont";

/**
 * Antetul portalului: cine ești, unde ești, ce te așteaptă.
 *
 * Nimic din el nu depinde de pagina curentă. Fiecare ecran își randează propriul
 * `<h1>`; un titlu aici ar fi al doilea titlu al aceleiași pagini și ar cere o
 * componentă client în plus, doar ca să traducă o cale într-o etichetă.
 *
 * `pt-[env(safe-area-inset-top)]` stă pe înveliș, nu pe rândul cu `h-14`: așa
 * antetul rămâne de 56 px, iar rezerva pentru crestătură se adună deasupra lui.
 */
export function AntetPortal({
  numeOrganizatie,
  numeAfisat,
  email,
  avatarUrl,
  necitite,
  organizatii,
  organizatiaCurentaId,
}: {
  readonly numeOrganizatie: string;
  readonly numeAfisat: string;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly necitite: number;
  readonly organizatii: readonly OrganizatiePortal[];
  readonly organizatiaCurentaId: string;
}) {
  return (
    <header
      data-tipar="ascunde"
      className="border-border bg-surface sticky top-0 z-10 border-b pt-[env(safe-area-inset-top)]"
    >
      <div className="flex h-14 items-center gap-3 px-4">
        <div className="min-w-0">
          {/* Numele firmei apare doar pe telefon: pe laptop e deja în capul
              rail-ului, iar de două ori pe același ecran e zgomot. */}
          <p className="text-muted-foreground text-nota truncate md:hidden">{numeOrganizatie}</p>
          <p className="text-foreground text-corp truncate font-semibold">{numeAfisat}</p>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/portal/notificarile-mele"
            aria-label={
              necitite > 0 ? `Notificări: ${necitite} necitite` : "Notificări: niciuna necitită"
            }
            className="text-muted-foreground hover:bg-background hover:text-foreground rounded-control relative inline-flex size-11 items-center justify-center"
          >
            <Bell aria-hidden="true" className="size-5" />
            {necitite > 0 ? (
              <span className="bg-danger text-danger-foreground absolute top-1 right-1 min-w-4 rounded-full px-1 text-[10px] leading-4 font-semibold tabular-nums">
                {necitite > 99 ? "99+" : necitite}
              </span>
            ) : null}
          </Link>

          <MeniuCont
            numeAfisat={numeAfisat}
            email={email}
            avatarUrl={avatarUrl}
            organizatii={organizatii}
            organizatiaCurentaId={organizatiaCurentaId}
          />
        </div>
      </div>
    </header>
  );
}
