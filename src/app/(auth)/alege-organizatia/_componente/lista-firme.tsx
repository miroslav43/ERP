// src/app/(auth)/alege-organizatia/_componente/lista-firme.tsx
"use client";

import { Building2 } from "lucide-react";
import { useState, useTransition, type ReactElement } from "react";

import { comutaOrganizatiaDirect } from "@/app/(app)/actions";
import { Rotita } from "@/components/incarcare/rotita";
import { useSemnalIncarcare } from "@/components/incarcare/use-incarcare";
import { cn } from "@/lib/ui/cn";

/**
 * Alegerea firmei — controlul cu cea mai mare consecință din tot produsul.
 *
 * Ecranul era, până acum, un `<form action={comutaOrganizatiaDirect}>` per
 * firmă, cu `<button type="submit">` brut, într-un Server Component care nu
 * poate purta hook-uri. Două defecte, nu unul:
 *
 * 1. TĂCEREA. Acțiunea face patru drumuri la bază, apoi `revalidatePath("/",
 *    "layout")` și `redirect` într-un layout `force-dynamic` cu încă 6-9 valuri.
 *    În tot intervalul ăsta butonul rămânea identic, cu `hover:` încă activ.
 *    `loading.tsx` nu ajută: în timpul unui Server Action nu se afișează
 *    NICIODATĂ.
 *
 * 2. CURSA. `startHostTransition` din react-dom 19.2.8 pornește acțiunea la
 *    ORICE `submit`, fără nicio verificare de „acțiune deja în curs", iar
 *    fiecare firmă era alt `<form>`, deci alt fiber. Două clicuri pe două firme
 *    porneau două `comutaNucleu`, amândouă apucau să scrie cookie-ul de
 *    organizație, iar care rămânea era nedeterminat — adică omul putea ajunge
 *    să lucreze în ALTĂ firmă decât cea pe care a apăsat-o. Într-un produs
 *    multi-tenant asta nu e o problemă de confort.
 *
 * Reparația pentru amândouă e aceeași: o singură componentă client care ține
 * starea pentru toată lista și dezactivează TOATE butoanele cât timp unul
 * lucrează. Voalul global e a doua plasă, nu prima — el apare abia la 400 ms,
 * iar cursa se câștigă în primele 150.
 */

export type FirmaAleasa = Readonly<{
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly role: string;
}>;

const ETICHETE_ROL: Readonly<Record<string, string>> = {
  super_admin: "Super-administrator",
  org_admin: "Administrator",
  manager: "Manager",
  hr: "Resurse umane",
  employee: "Angajat",
};

export function ListaFirme({
  organizatii,
}: Readonly<{ organizatii: readonly FirmaAleasa[] }>): ReactElement {
  const [inCurs, incepe] = useTransition();
  const [idAles, setIdAles] = useState<string | null>(null);

  const aleasa = organizatii.find((o) => o.id === idAles);
  useSemnalIncarcare(inCurs, aleasa === undefined ? undefined : aleasa.name);

  function alege(organizationId: string): void {
    if (inCurs) return;
    setIdAles(organizationId);
    const date = new FormData();
    date.set("organizationId", organizationId);
    incepe(() => {
      void comutaOrganizatiaDirect(date);
    });
  }

  return (
    <ul className="flex flex-col gap-2">
      {organizatii.map((organizatie) => {
        const eAceasta = idAles === organizatie.id && inCurs;
        return (
          <li key={organizatie.id}>
            <button
              type="button"
              onClick={() => alege(organizatie.id)}
              disabled={inCurs}
              aria-busy={eAceasta ? true : undefined}
              className={cn(
                "border-border bg-surface rounded-panou flex min-h-14 w-full items-center gap-3 border px-4 py-3 text-left transition-colors",
                // Ținta e rândul ÎNTREG, nu denumirea: 56px, peste minimul de 44.
                // Nimeni nu alege firma greșită fiindcă a atins doi pixeli mai jos.
                inCurs ? "cursor-default opacity-60" : "hover:bg-background",
                eAceasta ? "border-primary opacity-100" : "",
              )}
            >
              {eAceasta ? (
                <Rotita className="text-primary shrink-0" />
              ) : (
                <Building2 aria-hidden="true" className="text-primary h-5 w-5 shrink-0" />
              )}
              <span className="flex min-w-0 flex-col">
                {/* Conținut de la utilizator: randat ca text, niciodată ca HTML (S8). */}
                <span className="text-foreground text-sectiune truncate font-semibold">
                  {organizatie.name}
                </span>
                <span className="text-muted-foreground text-nota truncate">
                  {eAceasta
                    ? "Se deschide…"
                    : `${ETICHETE_ROL[organizatie.role] ?? organizatie.role} · /${organizatie.slug}`}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
