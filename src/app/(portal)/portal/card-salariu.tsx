// src/app/(portal)/portal/card-salariu.tsx
// Rezumatul de salariu de pe ecranul de start al portalului. Pur, fără citiri
// proprii: primește înregistrarea deja autorizată de pagina care îl montează —
// aceeași convenție ca `components/payroll/fluturas.tsx`.

import Link from "next/link";
import { Wallet } from "lucide-react";

import { Inel } from "@/components/grafice/inel";
import { formatLei } from "@/lib/format/money";
import { formatMonthYear } from "@/lib/format/date";
import type { DetaliuInregistrare } from "@/lib/queries/payroll";

/**
 * ── DE CE CARDUL ĂSTA NU E ALBASTRU, DEȘI CELELALTE DOUĂ SUNT ───────────────
 * Nu e o scăpare de stil. `Inel` desparte feliile cu un contur desenat în
 * `var(--color-background)` (`grafice/inel.tsx`), fiindcă două serii alăturate
 * nu pot garanta 3:1 între ele și granița se face structural. Pe un card
 * `bg-primary`, conturul acela ar ieși crem pe navy: două linii deschise, late,
 * tăind inelul în locuri care n-au nicio noimă.
 *
 * Ierarhia iese, de altfel, mai bine: două carduri pline care CER o acțiune
 * (concediu, pontaj) și unul liniștit care SPUNE o cifră.
 *
 * ── DE CE CIFRA MARE E `net_de_plata`, NU `net` ─────────────────────────────
 * `net` e ce rămâne după contribuții și impozit; `net_de_plata` e după rețineri
 * (popriri, rate, avansuri). Întrebarea la care răspunde ecranul de start e
 * „cât încasez", iar răspunsul ăla e al doilea număr. Când cele două diferă,
 * diferența se scrie pe față dedesubt — o cifră mare care nu se potrivește cu
 * extrasul de cont e mai rea decât nicio cifră.
 *
 * Inelul rămâne totuși pe `net`, fiindcă el împarte BRUTUL: net + CAS + CASS +
 * impozit dă exact brutul, iar reținerile nu sunt o felie din el — se scad
 * după. Suma din centrul inelului e brutul, și scrie asta.
 */
export function CardSalariu({
  inregistrare,
  perioada,
}: {
  readonly inregistrare: DetaliuInregistrare;
  /** `null` doar dacă perioada chiar nu s-a putut citi — vezi 0113. */
  readonly perioada: { readonly an: number; readonly luna: number } | null;
}) {
  const taxe = inregistrare.cas + inregistrare.cass + inregistrare.impozit;

  return (
    <section
      aria-labelledby="salariu"
      className="bg-surface border-border rounded-panou border p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="salariu" className="text-foreground text-corp font-semibold">
          Salariul meu
        </h2>
        <p className="text-muted-foreground text-nota">
          {perioada === null ? "cel mai recent" : formatMonthYear(perioada.an, perioada.luna)}
        </p>
      </div>

      <p className="text-foreground mt-1 text-4xl font-semibold tabular-nums">
        {formatLei(inregistrare.net_de_plata)}
      </p>
      <p className="text-muted-foreground text-corp">încasat net</p>

      {inregistrare.retineri_total > 0 ? (
        <p className="text-muted-foreground text-nota mt-1">
          din {formatLei(inregistrare.net)} net, {formatLei(inregistrare.retineri_total)} rețineri
        </p>
      ) : null}

      {/*
        Două felii, nu patru. Pe fluturaș, împărțirea pe CAS/CASS/impozit e
        informația; aici, întrebarea e doar „cât se duce și cât rămâne", iar o
        legendă de patru rânduri ar fi mai înaltă decât inelul de 110px de lângă
        ea. Detalierea e la o atingere distanță, pe /portal/salariul-meu.

        Culorile nu se dau: cad pe paleta categorică, unde seria 1 e chiar navy-ul
        aplicației. Ce rămâne la om iese astfel în culoarea tare, iar taxele în
        cea ștearsă — fără să folosim tokeni de STARE, care ar face din impozit
        o eroare și din CAS o avertizare.
      */}
      <div className="mt-3">
        <Inel
          titlu="Cât rămâne din salariul brut și cât se duce pe taxe"
          unitate="Lei"
          marime={110}
          felii={[
            { eticheta: "Rămâne la mine", valoare: inregistrare.net },
            { eticheta: "Taxe", valoare: taxe },
          ]}
          formateaza={formatLei}
          subtitluCentral="brut"
        />
      </div>

      <Link
        href="/portal/salariul-meu"
        className="text-primary text-corp mt-3 inline-flex items-center gap-2 underline-offset-2 hover:underline"
      >
        <Wallet aria-hidden="true" className="size-4" />
        Vezi fluturașul
      </Link>
    </section>
  );
}
