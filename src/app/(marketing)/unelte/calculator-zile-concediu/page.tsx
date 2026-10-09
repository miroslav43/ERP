// src/app/(marketing)/unelte/calculator-zile-concediu/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_CALCULATOR_CONCEDIU } from "@/content/landing/unelte";
import { todayInBucharest } from "@/lib/format/date";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { AN_MAX, AN_MIN } from "../cerere-concediu-de-odihna/cerere";
import { zileLucratoareText } from "../cerere-concediu-de-odihna/text-zile";
import { calculeaza, citesteCalculul, DREPT_MINIM, SUPLIMENT_MINIM } from "./calcul";

/**
 * Calculatorul de zile de concediu de odihnă, gratuit, fără cont.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Cererea de concediu numără zilele unei PERIOADE. Întrebarea de dinainte —
 * „câte zile am în anul ăsta, dacă m-am angajat în martie?” — se caută separat
 * și are un concurent direct (folositor.ro, auditul din 8 oct 2026). Răspunsul
 * cinstit are două părți: minimul și suplimentul sunt lege, proporția e
 * practică. Pagina le spune separat.
 *
 * Formular GET, fără JavaScript, ca la celelalte unelte: rezultatul stă în
 * adresă și se poate trimite.
 */
const CALE = "/unelte/calculator-zile-concediu";

export function generateMetadata(): Metadata {
  return metadatePagina(metaUnealta(CALE));
}

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

/** Zile cu zecimale, în formatul românesc: „16,67”. */
const zecimal = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });

export default async function PaginaCalculatorConcediu({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(p)) {
    const v = Array.isArray(valoare) ? valoare[0] : valoare;
    if (v !== undefined) q.set(cheie, v);
  }
  const anCurent = Number(todayInBucharest().slice(0, 4));
  const { intrare, probleme } = citesteCalculul(q, anCurent);
  const r = probleme.length === 0 ? calculeaza(intrare) : null;

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: CALE,
          nume: ANTET_CALCULATOR_CONCEDIU.titlu,
          descriere: ANTET_CALCULATOR_CONCEDIU.lead,
        })}
      />
      <AntetSecundar
        text={ANTET_CALCULATOR_CONCEDIU}
        firimituri={[
          { eticheta: "Acasă", href: "/" },
          { eticheta: "Unelte", href: "/unelte" },
          { eticheta: "Zile de concediu", href: CALE },
        ]}
      />

      <Banda inaltime="scurta">
        <form action="#rezultat" method="get" className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Anul</span>
            <input
              type="number"
              name="an"
              min={AN_MIN}
              max={AN_MAX}
              defaultValue={q.get("an") ?? String(intrare.an)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Zile pe an în contract</span>
            <input
              type="number"
              name="drept"
              min={DREPT_MINIM}
              max={60}
              defaultValue={q.get("drept") ?? String(intrare.dreptAnual)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Zile suplimentare</span>
            <input
              type="number"
              name="suplimentar"
              min={0}
              max={30}
              defaultValue={q.get("suplimentar") ?? String(intrare.suplimentar)}
              className={CLASA_CAMP}
            />
            <span className="text-mk-text-slab text-[0.8125rem]">
              Condiții grele, handicap, sub 18 ani: cel puțin {SUPLIMENT_MINIM} — art. 147.
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">
              Data angajării (dacă e în anul ales)
            </span>
            <input
              type="date"
              name="angajare"
              defaultValue={q.get("angajare") ?? ""}
              min={`${String(AN_MIN)}-01-01`}
              max={`${String(AN_MAX)}-12-31`}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Data plecării (dacă e în anul ales)</span>
            <input
              type="date"
              name="incetare"
              defaultValue={q.get("incetare") ?? ""}
              min={`${String(AN_MIN)}-01-01`}
              max={`${String(AN_MAX)}-12-31`}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="bg-mk-cerneala text-mk-text-inv font-mk-date w-full px-4 py-2.5 text-[0.8125rem] tracking-[0.08em] uppercase"
            >
              Calculează
            </button>
          </div>
        </form>
      </Banda>

      <Banda id="rezultat" inaltime="scurta">
        {r === null ? (
          <div role="alert" className="border-mk-rigla border p-4 text-[0.9375rem]">
            <p className="font-medium">Nu se poate calcula așa:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {probleme.map((pr) => (
                <li key={pr}>{pr}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="max-w-[62ch] space-y-3 text-[1rem] leading-[1.7]">
            <p>
              Dreptul pe un an întreg: <strong>{zileLucratoareText(r.dreptTotal)}</strong>
              {intrare.suplimentar > 0
                ? ` (${String(intrare.dreptAnual)} din contract și ${String(intrare.suplimentar)} suplimentare)`
                : ""}
              .
            </p>
            {r.anIntreg ? (
              <p>
                Lucrați tot anul {intrare.an}, deci vi se cuvine dreptul întreg:{" "}
                <strong>{zileLucratoareText(r.dreptTotal)}</strong>.
              </p>
            ) : (
              <>
                <p>
                  În {intrare.an} lucrați {r.luniLucrate} luni din 12. Proporțional: {r.dreptTotal}{" "}
                  ÷ 12 × {r.luniLucrate} = <strong>{zecimal(r.proportional)} zile</strong> —
                  rotunjit în jos {zileLucratoareText(r.inJos)}, în sus{" "}
                  {zileLucratoareText(r.inSus)}.
                </p>
                <p className="text-mk-text-slab text-[0.9375rem]">
                  Proporția e practica uzuală, nu un articol din Codul muncii; rotunjirea o
                  stabilesc contractul colectiv sau regulamentul intern. Luna angajării și cea a
                  plecării se socotesc întregi, ca în modulul de concedii din aplicație.
                </p>
              </>
            )}
            <p>
              <Link
                href={`/unelte/cerere-concediu-de-odihna?an=${String(intrare.an)}#documentul`}
                className="underline underline-offset-4"
              >
                Fă cererea de concediu pentru anul {intrare.an}, cu zilele lucrătoare calculate
              </Link>
            </p>
          </div>
        )}
      </Banda>

      <Banda
        inaltime="medie"
        supratitlu="Ce spune legea"
        titlu="Ce e lege și ce e doar obicei"
        lead="Patru reguli din Codul muncii stabilesc dreptul. Proporția pentru un an lucrat parțial nu e una dintre ele."
      >
        <div className="border-mk-rigla/40 mt-8 border-t">
          {[
            {
              titlu: "Cel puțin 20 de zile lucrătoare",
              text: "Art. 145 alin. (1): durata minimă a concediului de odihnă anual e de 20 de zile lucrătoare. Durata efectivă se scrie în contractul individual de muncă — alin. (2) — și poate fi mai mare, niciodată mai mică.",
            },
            {
              titlu: "Zile suplimentare, cel puțin 3",
              text: "Art. 147: salariații din condiții grele, periculoase sau vătămătoare, nevăzătorii, alte persoane cu handicap și tinerii sub 18 ani au un concediu suplimentar de cel puțin 3 zile lucrătoare, stabilit prin contractul colectiv aplicabil.",
            },
            {
              titlu: "Concediul medical nu taie zile",
              text: "Art. 145 alin. (4): incapacitatea temporară de muncă, concediile de maternitate, paternal, de risc maternal, pentru îngrijirea copilului bolnav, de îngrijitor și absența din art. 152² se consideră activitate prestată.",
            },
            {
              titlu: "Proporția: practică, nu articol",
              text: "Pentru un an lucrat parțial, „dreptul ÷ 12 × lunile lucrate” e formula folosită peste tot, dar nu are un articol în Codul muncii: vine din contractele colective și din practică. Verificați contractul colectiv aplicabil și regulamentul intern.",
            },
          ].map((rand) => (
            <div
              key={rand.titlu}
              className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
            >
              <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
                {rand.titlu}
              </h3>
              <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6] md:col-span-8">
                {rand.text}
              </p>
            </div>
          ))}
        </div>
      </Banda>

      <Banda
        inaltime="medie"
        supratitlu="Fără calcule de mână"
        titlu="Soldul de concediu, ținut de aplicație"
        lead="În Administrativo, dreptul fiecărui om se calculează din contract și din regulile firmei, iar soldul scade singur la fiecare cerere aprobată."
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={RO.hero.ctaPrimar.href}
            data-umami-event="cta-calculator-concediu"
            className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
          >
            {RO.hero.ctaPrimar.eticheta}
          </Link>
          <Link
            href="/module/concedii"
            className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
          >
            Cum funcționează modulul Concedii
          </Link>
        </div>
        <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/calculator-zile-concediu"]} />
      </Banda>
    </Cadru>
  );
}
