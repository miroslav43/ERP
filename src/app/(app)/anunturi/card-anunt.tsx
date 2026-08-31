// src/app/(app)/anunturi/card-anunt.tsx
import Link from "next/link";
import { Pin } from "lucide-react";
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { extrasAnunt, type StareAnunt } from "@/domain/announcements/anunt";
import { formatDate, formatDateTime, toBucharestDateString } from "@/lib/format/date";
import { cn } from "@/lib/ui/cn";

/**
 * Un anunț, ca fișă pe avizier.
 *
 * ── DE CE CARD, NU RÂND DE LISTĂ ──────────────────────────────────────────
 * Lista de dinainte punea titlul, pastilele și un rând de metadate într-un
 * `divide-y` fără fundal. Din ea nu se putea afla CE scrie în anunț: `continut`
 * nu era nici măcar citit din bază. Un avizier din care nu se vede nimic până
 * nu deschizi fiecare foaie în parte e un cuprins, nu un avizier.
 *
 * ── DE CE LINKUL SE ÎNTINDE PESTE TOT CARDUL ──────────────────────────────
 * Ținta de clic era exact lățimea titlului — pe „Program de lucru" vreo 150px
 * dintr-un card de 700. `after:absolute after:inset-0` întinde zona activă a
 * ancorei peste tot cardul, fără să bage nimic altceva în numele ei accesibil:
 * pastilele și extrasul rămân în afara `<a>`, exact cum le pusese comentariul
 * din pagina veche („Ciornă Expirat Titlu" era numele citit cu voce tare).
 *
 * Nu se folosește tiparul opus — `<Link>` în jurul întregului card, ca în
 * portal — tocmai fiindcă acela reface problema pe care pagina o rezolvase.
 *
 * ── DE CE EXPIRATUL NU SE ESTOMPEAZĂ ──────────────────────────────────────
 * `opacity-60` pe un card întreg pare soluția evidentă și scade contrastul sub
 * prag pentru TOT ce e înăuntru, inclusiv pastila care explică de ce e
 * estompat. Starea o poartă cuvântul din pastilă și hașura de pe muchie —
 * `--hasura` e deja notația produsului pentru „nu se mai scrie aici".
 */
export type PropsCardAnunt = Readonly<{
  anunt: Readonly<{
    id: string;
    titlu: string;
    continut: string;
    fixat: boolean;
    publicat_la: string | null;
    expira_la: string | null;
    created_at: string;
  }>;
  stare: StareAnunt;
  /** `false` pentru cine n-are fișă de angajat — nu există „citit" fără cine. */
  necitit: boolean;
}>;

/** Ziua românească a unui moment. `expira_la` e ora 23:59:59 — minutul e zgomot. */
function ziua(moment: string): string {
  return formatDate(toBucharestDateString(new Date(moment)));
}

function metadate(anunt: PropsCardAnunt["anunt"], stare: StareAnunt): string {
  const expirare =
    anunt.expira_la === null
      ? ""
      : ` · ${stare === "expirat" ? "a expirat" : "expiră"} ${ziua(anunt.expira_la)}`;

  switch (stare) {
    case "ciorna":
      return `Creat ${formatDateTime(anunt.created_at)}`;
    case "programat":
      return `Se publică ${formatDateTime(anunt.publicat_la as string)}${expirare}`;
    default:
      return `Publicat ${formatDateTime(anunt.publicat_la as string)}${expirare}`;
  }
}

export function CardAnunt({ anunt, stare, necitit }: PropsCardAnunt): ReactElement {
  return (
    <li
      className={cn(
        "group bg-surface border-border rounded-panou relative border p-4",
        "hover:border-ring focus-within:border-ring transition-colors",
        // Muchia din stânga e singurul loc unde starea are voie să fie culoare:
        // e redundantă cu pastila, niciodată singura purtătoare de înțeles.
        anunt.fixat ? "border-l-primary border-l-[3px] pl-[calc(1rem-2px)]" : null,
      )}
    >
      <div className="flex items-start gap-3">
        {anunt.fixat ? (
          <Pin aria-hidden="true" className="text-primary mt-0.5 size-4 shrink-0" />
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/anunturi/${anunt.id}`}
              className={cn(
                "text-foreground text-corp font-semibold",
                "rounded-xs underline-offset-2 group-hover:underline",
                "after:absolute after:inset-0 after:content-['']",
                stare === "expirat" ? "text-muted-foreground" : null,
              )}
            >
              {anunt.titlu}
            </Link>

            {anunt.fixat ? <span className="sr-only">Fixat în capul listei.</span> : null}
            {stare === "ciorna" ? <Badge ton="ciorna">Ciornă</Badge> : null}
            {stare === "programat" ? <Badge ton="atentie">Programat</Badge> : null}
            {stare === "expirat" ? (
              <Badge ton="neutru" cuAvertisment>
                Expirat
              </Badge>
            ) : null}
          </div>

          <p className="text-muted-foreground text-corp mt-1 line-clamp-2 text-pretty">
            {extrasAnunt(anunt.continut)}
          </p>

          <p className="text-muted-foreground text-nota mt-2">{metadate(anunt, stare)}</p>
        </div>

        {necitit ? (
          <span className="mt-1 flex shrink-0 items-center gap-1.5">
            {/* Bulina e decor; înțelesul îl duce textul de dedesubt, ca la pictograma
                de „fixat". `aria-label` pe un `<span>` fără rol e ignorat de o parte
                dintre cititoarele de ecran — de aceea `sr-only`, nu `aria-label`. */}
            <span aria-hidden="true" className="bg-primary size-2 rounded-full" />
            <span className="text-muted-foreground text-nota">Necitit</span>
          </span>
        ) : null}
      </div>

      {stare === "expirat" ? (
        <span
          aria-hidden="true"
          className="rounded-b-panou absolute inset-x-0 bottom-0 h-1"
          style={{ backgroundImage: "var(--hasura)" }}
        />
      ) : null}
    </li>
  );
}
