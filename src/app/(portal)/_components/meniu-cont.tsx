"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, LogOut, Smartphone, UserRound } from "lucide-react";

import { comutaOrganizatiaDirect, deconecteaza } from "@/app/(app)/actions";
import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { RandTrimite } from "@/components/incarcare/rand-trimite";

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

  const [lucreaza, setLucreaza] = useState(false);
  const panou = useRef<HTMLDetailsElement | null>(null);

  // `key={cale}` închide panoul la schimbarea de cale, dar comutarea de firmă te
  // poate lăsa exact pe aceeași cale — și atunci meniul rămânea deschis peste un
  // ecran care încă arată firma veche.
  useEffect(() => {
    if (lucreaza && panou.current !== null) panou.current.open = false;
  }, [lucreaza]);

  return (
    <details ref={panou} key={cale} className="relative">
      <summary className="hover:bg-background rounded-control flex size-11 cursor-pointer list-none items-center justify-center [&::-webkit-details-marker]:hidden">
        <AvatarAngajat url={avatarUrl} nume={numeAfisat} marime="sm" />
        <span className="sr-only">Contul meu</span>
      </summary>

      <div className="border-border bg-surface rounded-control shadow-plutitor absolute right-0 z-30 mt-1 w-64 border p-1">
        <div className="border-border border-b px-3 py-2">
          <p className="text-foreground text-corp truncate font-medium">{numeAfisat}</p>
          <p className="text-muted-foreground text-nota truncate">{email}</p>
        </div>

        <Link
          href="/portal/profilul-meu"
          className="text-foreground hover:bg-background text-corp flex min-h-11 items-center gap-2 rounded px-3"
        >
          <UserRound aria-hidden="true" className="size-4 shrink-0" />
          Profilul meu
        </Link>

        {/* Drumul permanent către instrucțiunile de instalare. Banda de pe
            ecranul de start se închide o dată și nu mai revine; fără intrarea
            asta, cine a închis-o din greșeală n-ar mai găsi niciodată pagina. */}
        <Link
          href="/portal/instalare"
          className="text-foreground hover:bg-background text-corp flex min-h-11 items-center gap-2 rounded px-3"
        >
          <Smartphone aria-hidden="true" className="size-4 shrink-0" />
          Instalează aplicația
        </Link>

        {/* Un formular per firmă, fără <select> și fără JS: lista are două-trei
            elemente, iar un buton se apasă din prima. */}
        {altele.map((organizatie) => (
          <form key={organizatie.id} action={comutaOrganizatiaDirect}>
            <input type="hidden" name="organizationId" value={organizatie.id} />
            <RandTrimite
              className={
                "text-foreground hover:bg-background text-corp flex min-h-11 w-full items-center gap-2 rounded px-3 text-left"
              }
              blocat={lucreaza}
              raporteaza={setLucreaza}
              eticheta={organizatie.name}
            >
              <ArrowLeftRight aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 truncate">Treci la {organizatie.name}</span>
            </RandTrimite>
          </form>
        ))}

        <form action={deconecteaza}>
          <RandTrimite
            className={
              "text-danger hover:bg-background text-corp flex min-h-11 w-full items-center gap-2 rounded px-3 text-left"
            }
            blocat={lucreaza}
            raporteaza={setLucreaza}
          >
            <LogOut aria-hidden="true" className="size-4 shrink-0" />
            Deconectare
          </RandTrimite>
        </form>
      </div>
    </details>
  );
}
