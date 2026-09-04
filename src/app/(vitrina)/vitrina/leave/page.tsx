import type { Metadata } from "next";

import { todayInBucharest } from "@/lib/format/date";

import { VitrinaConcedii } from "./vitrina-leave";

export const metadata: Metadata = { title: "Concedii — demonstrație" };

/**
 * Randare la CERERE, nu la build.
 *
 * ── DE CE E OBLIGATORIU ───────────────────────────────────────────────────
 * `todayInBucharest()` e `new Date()` (`src/lib/format/date.ts`), iar pagina
 * n-are niciun API dinamic — nici `cookies()`, nici `headers()`, nici
 * `searchParams`. Fără linia asta, Next o prerandează integral la build:
 * `new Date()` rulează O SINGURĂ DATĂ, la coacerea imaginii `output:
 * "standalone"`, iar rezultatul e lipit în HTML-ul livrat de acolo încolo.
 * O imagine construită în septembrie ar fi arătat, în decembrie, un calendar
 * pe septembrie cu „azi" marcat pe 4 — exact îmbătrânirea tăcută pe care
 * docblock-ul de mai jos promite că o evită. Nu cade nimic și nu se logează
 * nimic: prospectul vede pur și simplu o lună moartă.
 *
 * ── DE CE `force-dynamic`, NU `revalidate = 3600` ─────────────────────────
 * ISR ar fi mărginit vechimea la o oră, dar cu două costuri neverificate:
 * cache-ul de revalidare se scrie pe discul containerului, iar aplicația
 * rulează în Swarm cu mai multe replici — fiecare cu propriul cache, deci
 * răspunsuri care se pot bate cap în cap la granița zilei. Proiectul n-are
 * NICIO pagină pe ISR azi (`export const revalidate` apare o singură dată, cu
 * valoarea 0, în `readyz/route.ts`), în timp ce `force-dynamic` e tiparul casei
 * în peste douăzeci de locuri, verificat în producție. Costul lui aici e
 * neglijabil: pagina n-atinge baza deloc, randează date fabricate din memorie,
 * și e încărcată leneș, dintr-un iframe.
 */
export const dynamic = "force-dynamic";

/**
 * Ancorat la ZIUA CURENTĂ, nu la o lună scrisă în cod. Un demo cu „martie 2026"
 * arată o lună moartă peste trei luni, fără nicio eroare — îmbătrânește tăcut
 * pe pagina publică.
 */
export default function PaginaVitrinaConcedii() {
  return (
    <main>
      <VitrinaConcedii azi={todayInBucharest()} />
    </main>
  );
}
