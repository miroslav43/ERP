// src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { RO } from "@/content/landing/ro";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import {
  construiesteFoaie,
  LUNI,
  normalizeazaAn,
  normalizeazaAngajati,
  normalizeazaLuna,
  normalizeazaOre,
  AN_MAX,
  AN_MIN,
} from "./foaie";

/**
 * Foaie de pontaj lunară, gratuită, fără cont.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * „Foaie de pontaj lunar excel" e una dintre puținele căutări din zona asta cu
 * intenție clară și cu concurență slabă: rezultatele sunt șabloane statice, de
 * pe bloguri, cu sărbătorile scrise de mână pentru anul în care au fost făcute.
 * Anul următor arată la fel de convingător și sunt greșite.
 *
 * Aici sărbătorile se CALCULEAZĂ, inclusiv Paștele ortodox și zilele care depind
 * de el — același cod care ține calendarul aplicației. E singurul lucru pe care
 * un fișier descărcat nu-l poate face, și e chiar motivul pentru care foaia asta
 * merită să existe separat de produs.
 *
 * ── DE CE FORMULAR GET, FĂRĂ JAVASCRIPT ───────────────────────────────────
 * Parametrii stau în adresă, deci foaia se poate pune la favorite și se poate
 * trimite pe e-mail gata completată. Merge cu JavaScript oprit, merge la
 * tipărire directă din browser, iar exportul e un link, nu un buton care are
 * nevoie de hidratare.
 */
export const metadata: Metadata = {
  title: "Foaie de pontaj lunar, gratuită — cu sărbătorile calculate",
  description:
    "Generează o foaie colectivă de prezență pentru orice lună, cu weekendurile și sărbătorile legale marcate automat. Se tipărește sau se descarcă în Excel. Fără cont.",
  alternates: { canonical: "/unelte/foaie-de-pontaj" },
};

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2 text-[0.9375rem]";

export default async function PaginaFoaieDePontaj({ searchParams }: Proprietati) {
  const p = await searchParams;
  const acum = new Date();
  const an = normalizeazaAn(unul(p.an), acum.getUTCFullYear());
  const luna = normalizeazaLuna(unul(p.luna), acum.getUTCMonth() + 1);
  const oreZi = normalizeazaOre(unul(p.ore));
  const brutAngajati = unul(p.angajati) ?? "";
  const angajati = normalizeazaAngajati(brutAngajati);
  const foaie = construiesteFoaie(an, luna, angajati, oreZi);

  const parametri = new URLSearchParams({
    an: String(an),
    luna: String(luna),
    ore: String(oreZi),
    ...(brutAngajati === "" ? {} : { angajati: brutAngajati }),
  });

  return (
    <Cadru text={RO}>
      {/* `data-tipar="ascunde"` e convenția proiectului: la tipărire rămâne doar
          foaia, fără antet, formular și subsol. */}
      <div data-tipar="ascunde">
        <AntetSecundar
          text={{
            supratitlu: "Unealtă gratuită",
            titlu: "Foaie de pontaj lunar",
            lead: "Alege luna și scrie numele. Weekendurile și sărbătorile legale se marchează singure — inclusiv Paștele ortodox și zilele care depind de el. Se tipărește sau se descarcă în Excel, fără cont.",
          }}
        />
      </div>

      <Banda inaltime="scurta">
        <form
          method="get"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-tipar="ascunde"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Luna</span>
            <select name="luna" defaultValue={String(luna)} className={CLASA_CAMP}>
              {LUNI.map((nume, i) => (
                <option key={nume} value={String(i + 1)}>
                  {nume}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Anul</span>
            <input
              type="number"
              name="an"
              min={AN_MIN}
              max={AN_MAX}
              defaultValue={String(an)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Ore pe zi</span>
            <input
              type="number"
              name="ore"
              min={1}
              max={24}
              step="0.5"
              defaultValue={String(oreZi)}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              data-umami-event="foaie-genereaza"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 w-full items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              Generează
            </button>
          </div>
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
            <span className="text-[0.875rem] font-medium">Angajați</span>
            <span className="text-mk-text-slab text-[0.8125rem]">
              Câte un nume pe rând. Lasă gol dacă vrei foaia goală, de completat cu pixul.
            </span>
            <textarea
              name="angajati"
              rows={4}
              defaultValue={brutAngajati}
              placeholder={"Popa Ion\nIlie Maria\nRadu Andrei"}
              className={CLASA_CAMP}
            />
          </label>
        </form>

        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2" data-tipar="ascunde">
          <p className="text-mk-text-slab text-[0.9375rem]">
            <span className="font-mk-date text-mk-text">{foaie.zileLucratoare}</span> zile
            lucrătoare · <span className="font-mk-date text-mk-text">{foaie.normaLunara}</span> ore
            normă
          </p>
          <a
            href={`/api/unelte/foaie-de-pontaj?${parametri.toString()}`}
            data-umami-event="foaie-excel"
            className="text-[0.9375rem] underline underline-offset-4"
          >
            Descarcă în Excel
          </a>
        </div>
      </Banda>

      <Banda inaltime="scurta">
        <figure className="mk-foaie">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="font-mk-date text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
              Foaie colectivă de prezență · {foaie.eticheta}
            </p>
            <p className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.08em] uppercase">
              {foaie.zileLucratoare} zile lucrătoare × {foaie.oreZi} h = {foaie.normaLunara} h
            </p>
          </figcaption>

          <div className="border-mk-rigla relative mt-3 overflow-x-auto border">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Foaie colectivă de prezență pentru {foaie.eticheta}, necompletată.
              </caption>
              <thead>
                <tr className="border-mk-rigla border-b">
                  <th
                    scope="col"
                    className="border-mk-liniatura font-mk-date text-mk-text-slab w-[128px] border-r px-2 py-1.5 text-left text-[0.6875rem] font-medium tracking-[0.06em] uppercase"
                  >
                    Angajat
                  </th>
                  {foaie.zile.map((z) => (
                    <th
                      key={z.zi}
                      scope="col"
                      title={z.sarbatoare ?? undefined}
                      className={`border-mk-liniatura font-mk-date border-r px-0.5 py-1.5 text-center text-[0.6875rem] font-medium ${
                        z.sarbatoare !== null
                          ? "bg-mk-sl-hartie"
                          : z.weekend
                            ? "bg-mk-weekend-hartie"
                            : ""
                      }`}
                    >
                      <span className="block leading-tight">{z.zi}</span>
                      <span className="text-mk-text-slab block text-[0.625rem] leading-tight">
                        {z.litera}
                      </span>
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="border-mk-rigla font-mk-date w-[64px] border-l px-1 py-1.5 text-right text-[0.6875rem] font-medium tracking-[0.06em] uppercase"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {foaie.angajati.map((nume, index) => (
                  <tr
                    key={`${nume}-${index}`}
                    className="border-mk-liniatura border-b last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="border-mk-liniatura h-8 border-r px-2 text-left text-[0.8125rem] font-normal"
                    >
                      {nume}
                    </th>
                    {foaie.zile.map((z) => (
                      <td
                        key={z.zi}
                        className={`border-mk-liniatura border-r ${
                          z.sarbatoare !== null
                            ? "bg-mk-sl-hartie"
                            : z.weekend
                              ? "bg-mk-weekend-hartie"
                              : ""
                        }`}
                      />
                    ))}
                    <td className="border-mk-rigla border-l" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sărbătorile lunii, scrise. Într-o foaie tipărită, o celulă colorată
              nu spune DE CE e colorată, iar culoarea dispare la alb-negru. */}
          {foaie.zile.some((z) => z.sarbatoare !== null) && (
            <p className="text-mk-text-slab mt-3 text-[0.8125rem] leading-[1.6]">
              Sărbători legale în {foaie.eticheta}:{" "}
              {foaie.zile
                .filter((z) => z.sarbatoare !== null)
                .map((z) => `${z.zi} — ${z.sarbatoare ?? ""}`)
                .join(" · ")}
              .
            </p>
          )}
        </figure>
      </Banda>

      <Banda inaltime="medie" titlu="De ce sărbătorile de aici sunt corecte" data-tipar="ascunde">
        <div className="mt-6 max-w-[68ch] space-y-4" data-tipar="ascunde">
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Un șablon de foaie de calcul descărcat de pe internet are sărbătorile scrise de mână,
            pentru anul în care a fost făcut. Anul următor arată exact la fel și e greșit — iar
            Paștele ortodox, Vinerea Mare și Rusaliile se mută în fiecare an.
          </p>
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Aici zilele se calculează, cu același cod care ține calendarul aplicației. Dacă alegi
            2031, primești sărbătorile lui 2031, nu pe ale lui 2026.
          </p>
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Foaia rămâne o hârtie: nu adună singură orele, nu știe cine a fost în concediu și nu
            poate dovedi peste șase luni cine a modificat-o. Pentru astea e nevoie de un loc în care
            datele să stea, nu de un fișier mai bun.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3" data-tipar="ascunde">
          <Link
            href={RO.hero.ctaPrimar.href}
            data-umami-event="cta-foaie-pontaj"
            className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
          >
            {RO.hero.ctaPrimar.eticheta}
          </Link>
          <Link
            href="/comparatie/excel"
            className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
          >
            Excel sau aplicație
          </Link>
        </div>
      </Banda>
    </Cadru>
  );
}
