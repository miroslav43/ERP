// src/app/(app)/reges/nav-reges.tsx
import type { ReactElement } from "react";

import { BandaFile, Fila } from "@/components/ui/file";

/**
 * Cele trei fețe ale REGES-Online, într-o singură bandă.
 *
 * ── DE CE ─────────────────────────────────────────────────────────────────
 * Propunerile de detașare aveau intrare PROPRIE în meniu, soră cu registrul
 * (`navigation.ts`, `reges` la 41 și `reges-propuneri` la 42) — două rânduri în
 * rail pentru același modul, iar din ecranul de propuneri drumul înapoi era o
 * firimitură, nu o filă. Dar nu sunt două module: o detașare din tabelul
 * principal ESTE propunerea din fila a doua, privită din celălalt capăt, iar
 * ambele pleacă la ITM prin aceeași coadă de mesaje.
 *
 * Fila activă se decide pe SERVER, ca la `NavCursuri` — nicio componentă
 * client, niciun `usePathname`. `aria-current="page"` trebuie să fie corect
 * încă din HTML-ul trimis, iar o bandă de trei linkuri nu merită hidratare.
 *
 * ── CE NU E ───────────────────────────────────────────────────────────────
 * Ascunderea unei file nu e barieră: `/reges/setari` verifică din nou
 * `reges:configure`, `/reges` și `/reges/propuneri` verifică `reges:read`, iar
 * RLS respinge rândurile chiar dacă cineva tastează adresa. Booleenii de aici
 * fac igienă vizuală — o filă care duce garantat la „Acces restricționat" e
 * zgomot, nu descoperire.
 */
export function NavReges({
  activ,
  poateCiti,
  poateConfigura,
  propuneriDeRaspuns = 0,
}: Readonly<{
  activ: "registru" | "propuneri" | "setari";
  poateCiti: boolean;
  poateConfigura: boolean;
  /**
   * Propunerile PRIMITE care încă așteaptă un răspuns. Zero ⇒ `Fila` nu
   * randează nicio pastilă: un „0" afișat e zgomot, nu informație.
   */
  propuneriDeRaspuns?: number;
}>): ReactElement {
  return (
    <BandaFile eticheta="Secțiunile modulului REGES-Online">
      {poateCiti ? (
        <>
          <Fila href="/reges" activ={activ === "registru"}>
            Registru
          </Fila>
          <Fila href="/reges/propuneri" activ={activ === "propuneri"} contor={propuneriDeRaspuns}>
            Propuneri detașare
          </Fila>
        </>
      ) : null}
      {poateConfigura ? (
        <Fila href="/reges/setari" activ={activ === "setari"}>
          Chei API
        </Fila>
      ) : null}
    </BandaFile>
  );
}
