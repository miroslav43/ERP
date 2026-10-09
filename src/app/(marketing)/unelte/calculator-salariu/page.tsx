// src/app/(marketing)/unelte/calculator-salariu/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_CALCULATOR } from "@/content/landing/unelte";
import {
  FACILITATE_SALARIU_MINIM,
  PERIOADE_2026,
  SALARIU_MINIM_BRUT_2026_IULIE,
  VERIFICARE,
} from "@/content/legal/salarizare-publica";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { bazaMinimaContributii, dinBrut, type RezultatSalariu } from "@/lib/unelte/salariu";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { JsonLd } from "../../_componente/json-ld";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { CopiazaLegatura } from "./copiaza-legatura";
import { Desfasurator } from "./desfasurator";
import { Formular } from "./formular";
import { deLei, lei } from "./lei";
import { adresaPartajabila, calculeazaDinParametri, legaturaWhatsApp } from "./parametri";
import { impartireaCostului } from "./randuri";
import { grilaBrutNet, grilaNetBrut, salariulMinim2026, type ColoanaSalariuMinim } from "./tabele";

/**
 * Calculatorul de salariu net și brut.
 *
 * Keyword Planner, 2 oct 2026: „calcul salariu net” și „salariu minim pe
 * economie 2026” au 10.000–100.000 de căutări pe lună — cea mai mare cerere din
 * toată cercetarea. Calculul trece prin motorul modulului de salarizare
 * (`src/lib/unelte/salariu.ts`), cu valorile din `salarizare-publica.ts`,
 * verificate pe textele oficiale și pe vectorii publicați (2.699 / 2.981 lei).
 */
// 7 oct 2026: titlul pe forma căutată („calcul salariu net”, 10K–100K pe lună),
// descrierea sub 160 de caractere (avea 183 și se tăia în rezultate).
export const metadata: Metadata = metadatePagina(metaUnealta("/unelte/calculator-salariu"));

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const unul = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/** Un tabel de calcule uzuale; fiecare rând duce la calculul complet. */
function TabelUzual({
  legenda,
  capete,
  randuri,
}: {
  readonly legenda: string;
  readonly capete: readonly string[];
  readonly randuri: readonly Readonly<{ valori: readonly number[]; href: string }>[];
}) {
  return (
    // `relative`: un `sr-only` dintr-un container derulabil fără el târa pagina lateral.
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[20rem] text-left">
        <caption className="font-mk-display mb-3 text-left text-[1.125rem] font-semibold">
          {legenda}
        </caption>
        <thead>
          <tr className="border-mk-rigla border-b">
            {capete.map((cap) => (
              <th
                key={cap}
                scope="col"
                className="font-mk-date text-mk-text-slab py-2 pr-4 text-[0.6875rem] font-medium tracking-[0.1em] uppercase"
              >
                {cap}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {randuri.map((rand) => (
            <tr key={rand.href} className="border-mk-rigla/40 border-b">
              {rand.valori.map((v, i) => (
                <td
                  key={String(i)}
                  className="font-mk-date py-2.5 pr-4 text-[0.9375rem] whitespace-nowrap tabular-nums"
                >
                  {i === 0 ? (
                    // `<a>`, nu `<Link>`: navigarea tare face un document nou, iar
                    // poarta GA se decide din nou pe adresa cu `?suma=`. Cu `<Link>`,
                    // adresa cu valori intra într-un document deja măsurat.
                    <a href={rand.href} className="underline underline-offset-4">
                      {lei(v)}
                    </a>
                  ) : (
                    lei(v)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RANDURI_SALARIU_MINIM: readonly (readonly [string, (c: ColoanaSalariuMinim) => string])[] = [
  ["Brut pe lună", (c) => lei(c.brut)],
  ["Ore pe lună, în medie", (c) => c.oreLuna],
  ["Brut pe oră", (c) => `${c.leiPeOra} lei`],
  ["Actul normativ", (c) => c.act],
  ["Neimpozabil (OUG 89/2025 art. III)", (c) => lei(c.neimpozabil)],
  ["Net, normă întreagă, fără persoane", (c) => lei(c.net)],
  ["Cost total pentru firmă", (c) => lei(c.costTotal)],
];

/** Salariul minim pe cele două perioade ale lui 2026, cu netul și costul din același motor. */
function TabelSalariuMinim() {
  const coloane = salariulMinim2026();
  return (
    <div className="relative mt-8 overflow-x-auto">
      <table className="w-full min-w-[20rem] text-left text-[0.9375rem]">
        <caption className="font-mk-display mb-3 text-left text-[1.125rem] font-semibold">
          Salariul minim în 2026, pe cele două perioade
        </caption>
        <thead>
          <tr className="border-mk-rigla border-b">
            <td className="py-2 pr-4" />
            {coloane.map((c) => (
              <th
                key={c.perioada}
                scope="col"
                className="font-mk-date text-mk-text-slab py-2 pr-4 text-[0.6875rem] font-medium tracking-[0.1em] uppercase"
              >
                {/* `<a>`, nu `<Link>`: adresa cu `?suma=` cere navigare tare (vezi `TabelUzual`). */}
                <a
                  href={`?suma=${String(c.brut)}&perioada=${c.perioada}#rezultat`}
                  className="underline underline-offset-4"
                >
                  {c.eticheta}
                </a>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RANDURI_SALARIU_MINIM.map(([eticheta, valoare]) => (
            <tr key={eticheta} className="border-mk-rigla/40 border-b">
              <th scope="row" className="py-2.5 pr-4 font-normal">
                {eticheta}
              </th>
              {coloane.map((c) => (
                <td
                  key={c.perioada}
                  className="font-mk-date py-2.5 pr-4 whitespace-nowrap tabular-nums"
                >
                  {valoare(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Fraza care se citește și se trimite mai departe: cât din costul firmei ajunge la om. */
function ImpartireaCostului({ r }: { readonly r: RezultatSalariu }) {
  const i = impartireaCostului(r);
  return (
    <p className="mt-6 max-w-[68ch] text-[1.0625rem] leading-[1.6]">
      Din fiecare 100 de lei plătiți de firmă, {deLei(i.net)} ajung la angajat în cont
      {i.tichete > 0 ? `, ${deLei(i.tichete)} pe cardul de tichete` : ""}, iar {deLei(i.stat)} merg
      la stat, ca impozit și contribuții.
    </p>
  );
}

export default async function PaginaCalculatorSalariu({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  // Toate cheile: `parametri.ts` le citește doar pe cele pe care le cunoaște.
  for (const [cheie, valoare] of Object.entries(p)) {
    const v = unul(valoare);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  // Ziua din România alege perioada implicită și spune când valorile au expirat.
  // Pagina e oricum dinamică (citește `searchParams`), deci ceasul nu se îngheață la build.
  const {
    parametri,
    rezultat,
    eroare,
    minimLegal,
    subMinim,
    ridicatLaMinim,
    avertismente,
    expirat,
  } = calculeazaDinParametri(q, todayInBucharest());
  const laMinim = dinBrut(SALARIU_MINIM_BRUT_2026_IULIE, 0, true);

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: "/unelte/calculator-salariu",
          nume: ANTET_CALCULATOR.titlu,
          descriere: ANTET_CALCULATOR.lead,
        })}
      />
      <AntetSecundar
        text={ANTET_CALCULATOR}
        firimituri={[
          { eticheta: "Acasă", href: "/" },
          { eticheta: "Unelte", href: "/unelte" },
          { eticheta: "Calculator salariu", href: "/unelte/calculator-salariu" },
        ]}
      />

      <Banda inaltime="scurta">
        {/*
          `#rezultat`: după trimitere, pagina se deschide la rezultat, nu sus, pe
          formularul gol — pe telefon rezultatul cădea sub pliu (auditul din 7 oct).
        */}
        <Formular p={parametri} />
      </Banda>

      <Banda
        id="rezultat"
        inaltime="scurta"
        supratitlu="Rezultatul"
        titlu={
          rezultat === null
            ? "Suma nu a putut fi calculată"
            : `Net ${lei(rezultat.net)} din brut ${lei(rezultat.brut)}`
        }
      >
        {expirat && (
          <p
            role="note"
            className="border-mk-cerneala mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]"
          >
            Valorile sunt cele verificate pentru 2026. Pentru 2027, calculatorul nu are încă valori
            verificate: salariul minim, suma scutită și deducerea se pot schimba.
          </p>
        )}
        {rezultat === null ? (
          <p
            id="eroare-suma"
            role="alert"
            className="border-mk-cerneala mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]"
          >
            {eroare}
          </p>
        ) : (
          <>
            {parametri.rotunjita && parametri.suma !== null && (
              <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.875rem] leading-[1.6]">
                Suma avea bani; calculatorul lucrează în lei întregi, deci am calculat pentru{" "}
                {lei(parametri.suma)}.
              </p>
            )}
            {ridicatLaMinim && (
              <p className="border-mk-cerneala mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]">
                Netul cerut e mai mic decât cel de la brutul minim legal. Brutul nu poate coborî sub{" "}
                {lei(minimLegal)}, deci acesta e brutul, iar netul real iese {lei(rezultat.net)}.
              </p>
            )}
            {avertismente.map((a) => (
              <p
                key={a}
                className="border-mk-cerneala mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]"
              >
                {a}
              </p>
            ))}
            <div className="mt-6">
              <Desfasurator r={rezultat} />
            </div>
            <ImpartireaCostului r={rezultat} />
            <CopiazaLegatura adresa={adresaPartajabila(parametri)} />
            <a
              href={legaturaWhatsApp(rezultat, adresaPartajabila(parametri))}
              target="_blank"
              rel="noopener noreferrer"
              data-umami-event="calculator-salariu-whatsapp"
              className="mt-1 inline-block text-[0.9375rem] underline underline-offset-4"
            >
              Trimite calculul pe WhatsApp
            </a>
            {subMinim && (
              <p className="border-mk-rigla mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]">
                Brutul e sub minimul legal de {lei(minimLegal)} pentru{" "}
                {parametri.optiuni.oreZi === 8
                  ? "normă întreagă"
                  : `${String(parametri.optiuni.oreZi)} ${parametri.optiuni.oreZi === 1 ? "oră" : "ore"} pe zi`}
                : salariul minim orar e {PERIOADE_2026[parametri.optiuni.perioada].leiPeOra} lei (
                {PERIOADE_2026[parametri.optiuni.perioada].actSalariuMinim}).
              </p>
            )}
            {parametri.optiuni.oreZi < 8 && parametri.optiuni.contributieMinima && (
              <p className="border-mk-rigla mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]">
                La timp parțial, CAS și CASS se datorează cel puțin la baza minimă de{" "}
                {lei(bazaMinimaContributii(parametri.optiuni))} — salariul minim diminuat cu{" "}
                {PERIOADE_2026[parametri.optiuni.perioada].reducereBazaMinima} de lei (OUG 89/2025
                art. III alin. (5)). Diferența o plătește firma, nu angajatul (Codul fiscal art. 146
                alin. (5^9)), iar calculul de mai sus o include în cost. Excepțiile din alin. (5^7)
                se aleg în „Mai multe opțiuni”.
              </p>
            )}
          </>
        )}
      </Banda>

      <Banda
        inaltime="medie"
        supratitlu="Netul la salariul minim"
        titlu={`${lei(SALARIU_MINIM_BRUT_2026_IULIE)} brut, ${lei(laMinim.net)} net`}
      >
        <div className="mt-6 max-w-[68ch] space-y-3 text-[0.9375rem] leading-[1.7]">
          <p>
            De la 1 iulie 2026, salariul de bază minim brut pe țară e de 4.325 de lei, pentru un
            program normal de în medie 166,667 ore pe lună — HG 146/2026. Până la 30 iunie a fost de
            4.050 de lei.
          </p>
          <p>
            Pentru cine are salariul de bază egal cu minimul, normă întreagă, la funcția de bază, și
            un venit brut de cel mult {lei(FACILITATE_SALARIU_MINIM.plafonVenitBrut)},{" "}
            {lei(FACILITATE_SALARIU_MINIM.suma)} pe lună nu intră la impozit și contribuții, până la
            31 decembrie 2026 — OUG 89/2025, art. III. De aici netul de {lei(laMinim.net)}.
          </p>
          <p>
            Istoricul, minimul din construcții, amenda și ce se întâmplă cu un leu peste minim sunt
            în{" "}
            <Link href="/ghid/salariu-minim-pe-economie" className="underline underline-offset-4">
              ghidul salariului minim pe economie
            </Link>
            .
          </p>
        </div>
        <TabelSalariuMinim />
      </Banda>

      {/*
        Calculele uzuale, făcute la randare de același motor. Răspund direct la
        căutările „5000 net brut”, „calcul salariu brut din net”, fiecare cu
        legătura spre calculul complet. Canonicalul rămâne pagina fără parametri.
      */}
      <Banda
        inaltime="medie"
        supratitlu="Calcule uzuale"
        titlu="Din brut în net și din net în brut"
      >
        <div className="mt-6 grid gap-10 lg:grid-cols-[3fr_2fr]">
          <TabelUzual
            legenda="Calcul salariu net din brut"
            capete={["Brut", "Net", "Net, 2 persoane", "Cost firmă"]}
            randuri={grilaBrutNet().map((r) => ({
              valori: [r.brut, r.net, r.netDouaPersoane, r.costTotal],
              href: `?suma=${String(r.brut)}&din=brut&perioada=2026-2#rezultat`,
            }))}
          />
          <TabelUzual
            legenda="Calcul salariu brut din net"
            capete={["Net dorit", "Brut necesar", "Cost firmă"]}
            randuri={grilaNetBrut().map((r) => ({
              valori: [r.net, r.brut, r.costTotal],
              href: `?suma=${String(r.net)}&din=net&perioada=2026-2#rezultat`,
            }))}
          />
        </div>
        <p className="text-mk-text-slab mt-5 max-w-[68ch] text-[0.8125rem] leading-[1.55]">
          Normă întreagă, funcția de bază, fără tichete, valorile din iulie–decembrie 2026. Peste
          6.325 de lei brut, deducerea personală nu se mai acordă, deci persoanele în întreținere nu
          mai schimbă netul. Pentru alte situații, scrie suma în calculator.
        </p>
      </Banda>

      <Banda
        inaltime="medie"
        supratitlu="Pașii, în ordinea din lege"
        titlu="Cum se calculează salariul net din brut"
      >
        <ol className="mt-6 max-w-[68ch] list-decimal space-y-2 pl-5 text-[0.9375rem] leading-[1.65]">
          <li>CAS 25% și CASS 10% se calculează din brut — Codul fiscal art. 138 și 156.</li>
          <li>
            Deducerea personală se acordă doar la funcția de bază, pentru un brut de cel mult
            salariul minim + 2.000 de lei: între 20% și 45% din minim, după numărul de persoane în
            întreținere, cu 0,5 puncte mai puțin la fiecare 50 de lei peste minim — art. 77.
          </li>
          <li>Impozitul e 10% din brut minus CAS, CASS și deducerea personală — art. 64 și 78.</li>
          <li>Netul e brutul minus CAS, CASS și impozit. Toate sumele se rotunjesc la leu.</li>
          <li>Angajatorul plătește în plus CAM, 2,25% din brut — art. 220^3.</li>
        </ol>
      </Banda>

      <Banda inaltime="medie" supratitlu="Limitele" titlu="Ce nu calculează">
        <ul className="mt-6 max-w-[72ch] space-y-3">
          {[
            "Scutirea pentru cercetare-dezvoltare (art. 60 pct. 3), care cere proiect și stat de plată separate. Facilitățile pe sectoare de activitate (construcții, agricultură, industria alimentară, IT) nu se mai aplică veniturilor din 2025 (OUG 156/2024).",
            "Sporurile, orele suplimentare și concediile din lună.",
          ].map((t) => (
            <li
              key={t}
              className="border-mk-rigla/40 text-mk-text-slab border-l pl-4 text-[0.9375rem] leading-[1.65]"
            >
              {t}
            </li>
          ))}
        </ul>
        {/* Nota pe care o au toate ghidurile și care lipsea tocmai aici, pe pagina cu
            cifre de salariu (reauditul din 5 oct 2026). Fereastra de valabilitate
            vine din `VERIFICARE`: facilitatea expiră la 1 ianuarie 2027. */}
        <p className="border-mk-cerneala text-mk-text mt-8 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.6]">
          Calculul e informativ, pentru o lună întreagă lucrată, fără sporuri și fără cazurile din
          lista de mai sus; suma neimpozabilă de la salariul minim (OUG 89/2025) e inclusă. Valorile
          sunt cele din perioada aleasă a lui 2026; pentru statul de plată, confirmă cu contabilul
          firmei.
        </p>
        <p className="text-mk-text-slab mt-8 text-[0.875rem]">
          Valorile verificate pe {formatDate(VERIFICARE.la)}, pe textele oficiale:{" "}
          {VERIFICARE.surse.map((s, i) => (
            <span key={s.href}>
              {i > 0 ? " · " : ""}
              <a href={s.href} className="underline underline-offset-4" rel="noopener">
                {s.eticheta}
              </a>
            </span>
          ))}
          .
        </p>
      </Banda>

      <Banda
        inaltime="scurta"
        supratitlu="Pentru toată firma"
        titlu="Același calcul, din pontajul închis"
      >
        <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
          Calculatorul folosește același motor ca modulul de salarizare, care pornește din luna de
          pontaj închisă, cu sporuri, concedii și diurne, și scoate statul de plată, fluturașii și
          D112.{" "}
          <Link href="/module/salarizare" className="underline underline-offset-4">
            Programul de salarizare
          </Link>
          .
        </p>
        <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/calculator-salariu"]} />
      </Banda>
    </Cadru>
  );
}
