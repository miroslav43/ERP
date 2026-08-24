// src/components/layout/meniu-cont.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Check, ChevronDown, LogOut, UserRound } from "lucide-react";

import { comutaOrganizatiaDirect, deconecteaza } from "@/app/(app)/actions";
import type { AppRole } from "@/lib/tenant/types";

/** Rândul din lista de firme a meniului de cont și din paleta de comenzi. */
export type OrganizatieComutator = Readonly<{
  id: string;
  slug: string;
  name: string;
  role: AppRole;
}>;

const ETICHETE_ROL: Readonly<Record<AppRole, string>> = {
  super_admin: "Super-administrator",
  org_admin: "Administrator",
  manager: "Manager",
  hr: "Resurse umane",
  employee: "Angajat",
};

/**
 * Meniul de cont din antetul aplicației de firmă.
 *
 * ── DE CE `key={cale}` ────────────────────────────────────────────────────
 * `<details>` nu are stare React: e DOM. La o navigare client-side, React
 * păstrează elementul și atributul `open` supraviețuiește — meniul rămânea
 * deschis peste pagina următoare. Cheia îl remontează la fiecare schimbare de
 * cale, deci se închide singur. Defectul era reparat în portal
 * (`(portal)/_components/meniu-cont.tsx:46`) și nereparat aici.
 *
 * `[&::-webkit-details-marker]:hidden` lipsea la fel: fără el, Safari desenează
 * triunghiul nativ de disclosure lângă avatar.
 *
 * ── DE CE COMUTAREA DE FIRMĂ E AICI ───────────────────────────────────────
 * Era un `<select className="max-w-56">` plus un buton „Comută" de ~90 px, în
 * antet. Trei consecințe, toate reparate de mutarea asta:
 *
 * 1. Antetul nu mai încape pe telefon. La 375 px, doar comutatorul lua ~314 px,
 *    peste declanșatorul sertarului (44), clopoțel (44) și avatar.
 * 2. `<select>`-ul era CONTROLAT cu `useState(organizatiaCurentaId)`, inițializat
 *    o singură dată. `(app)/layout.tsx` nu se remontează la navigare, deci după
 *    o comutare făcută din altă parte — paleta ⌘K o face — starea rămânea pe
 *    firma VECHE: antetul afișa firma A cât timp railul, paginile și datele
 *    erau ale firmei B. O identitate greșită afișată fără nicio eroare, pe cel
 *    mai sensibil control din produs.
 * 3. Comutarea cerea două gesturi (alege, apoi apasă). Aici e unul, ca în
 *    portal: un formular per firmă, fără JavaScript propriu.
 *
 * Eroarea nu se mai injectează ca text într-un antet de 56 px:
 * `comutaOrganizatiaDirect` redirectează la `/alege-organizatia?eroare=acces`,
 * care e un ecran întreg și e singura destinație corectă când apartenența a
 * dispărut între randare și clic.
 */
export function MeniuCont({
  utilizator,
  rol,
  organizatii,
  organizatiaCurentaId,
}: {
  readonly utilizator: Readonly<{ email: string; fullName: string | null }>;
  readonly rol: AppRole;
  readonly organizatii: readonly OrganizatieComutator[];
  readonly organizatiaCurentaId: string;
}) {
  const cale = usePathname();
  const nume = utilizator.fullName ?? utilizator.email;
  const altele = organizatii.filter((organizatie) => organizatie.id !== organizatiaCurentaId);

  return (
    <details key={cale} className="relative">
      <summary className="rounded-control text-corp flex h-11 cursor-pointer list-none items-center gap-1.5 px-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden">
        <UserRound aria-hidden="true" className="size-5 shrink-0" />
        {/* Numele dispare sub `sm`, unde antetul are patru ținte de 44 px și
            niciun pixel în plus. Ținta rămâne aceeași; doar eticheta cade. */}
        <span className="hidden max-w-40 truncate sm:inline">{nume}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 opacity-80" />
        <span className="sr-only">Contul meu</span>
      </summary>

      {/* Panoul cade pe pânză, deci revine la paleta crem. `z-meniu` (30) îl
          ține peste conținut, dar sub antetul care l-a deschis. */}
      <div className="border-border bg-background rounded-panou shadow-plutitor z-meniu absolute right-0 mt-1 w-72 border p-1">
        <div className="border-border border-b px-3 py-2">
          <p className="text-foreground text-corp truncate font-medium">{nume}</p>
          {/* E-mailul apare doar când numele NU e chiar el — altfel același
              șir s-ar repeta pe două rânduri. */}
          {utilizator.fullName !== null ? (
            <p className="text-muted-foreground text-nota truncate">{utilizator.email}</p>
          ) : null}
          {/* Rolul e AL FIRMEI CURENTE, nu al contului: același om poate fi
              administrator într-o firmă și angajat în alta, iar meniul e chiar
              locul de unde comută între ele. */}
          <p className="text-muted-foreground text-nota mt-1">{ETICHETE_ROL[rol]}</p>
        </div>

        <Link
          href="/profil"
          className="text-foreground rounded-control hover:bg-surface text-corp flex min-h-11 items-center gap-2 px-3 transition-colors"
        >
          <UserRound aria-hidden="true" className="size-4 shrink-0" />
          Profilul meu
        </Link>

        {organizatii.length > 1 ? (
          <div className="border-border mt-1 border-t pt-1">
            <p className="text-muted-foreground text-eticheta px-3 pt-1 pb-1 font-semibold tracking-[0.1em] uppercase">
              Firmele mele
            </p>
            <p className="text-foreground text-corp flex min-h-11 items-center gap-2 px-3">
              <Check aria-hidden="true" className="text-primary size-4 shrink-0" />
              <span className="min-w-0 truncate font-medium">
                {organizatii.find((organizatie) => organizatie.id === organizatiaCurentaId)?.name ??
                  "Firma curentă"}
              </span>
            </p>
            {altele.map((organizatie) => (
              <form key={organizatie.id} action={comutaOrganizatiaDirect}>
                <input type="hidden" name="organizationId" value={organizatie.id} />
                <button
                  type="submit"
                  className="text-foreground rounded-control hover:bg-surface text-corp flex min-h-11 w-full items-center gap-2 px-3 text-left transition-colors"
                >
                  <ArrowLeftRight aria-hidden="true" className="size-4 shrink-0" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{organizatie.name}</span>
                    <span className="text-muted-foreground text-nota truncate">
                      {ETICHETE_ROL[organizatie.role]}
                    </span>
                  </span>
                </button>
              </form>
            ))}
          </div>
        ) : null}

        {/* Deconectarea nu distruge nimic — se revine cu o autentificare. Roșul
            rămâne pentru ce nu se poate lua înapoi; aici semnalul e separarea
            printr-un chenar și poziția ultimă. */}
        <div className="border-border mt-1 border-t pt-1">
          <form action={deconecteaza}>
            <button
              type="submit"
              className="text-foreground rounded-control hover:bg-surface text-corp flex min-h-11 w-full items-center gap-2 px-3 text-left transition-colors"
            >
              <LogOut aria-hidden="true" className="size-4 shrink-0" />
              Deconectare
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}
