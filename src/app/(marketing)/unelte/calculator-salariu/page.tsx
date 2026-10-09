// src/app/(marketing)/unelte/calculator-salariu/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_CALCULATOR } from "@/content/landing/unelte";
import {
  FACILITATE_SALARIU_MINIM,
  PERIOADE_2026,
  SALARIU_MINIM_BRUT_2026_IULIE,
  VERIFICARE,
} from "@/content/legal/salarizare-publica";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { bazaMinimaContributii, dinBrut, dinNet } from "@/lib/unelte/salariu";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { JsonLd } from "../../_componente/json-ld";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { Desfasurator } from "./desfasurator";
import { Formular } from "./formular";
import { lei } from "./lei";
import { calculeazaDinParametri } from "./parametri";

/**
 * Calculatorul de salariu net și brut.
 *
 * Keyword Planner, 2 oct 2026: „calcul salariu net” și „salariu minim pe
 * economie 2026” au 10.000–100.000 de căutări pe lună — cea mai mare cerere din
 * toată cercetarea. Calculul trece prin motorul modulului de salarizare
 * (`src/lib/unelte/salariu.ts`), cu valorile din `salarizare-publica.ts`,
 * verificate pe textele oficiale și pe vectorii publicați (2.699 / 2.981 lei).
 */
export const metadata: Metadata = metadatePagina({
  // 7 oct 2026: titlul pe forma căutată („calcul salariu net”, 10K–100K pe lună),
  // descrierea sub 160 de caractere (avea 183 și se tăia în rezultate).
  titlu: "Calcul salariu net și brut 2026: calculator",
  descriere:
    "Calcul salariu net din brut și brut din net, cu valorile din iulie 2026: CAS, CASS, impozit, deducerea personală și costul total pentru firmă.",
  cale: "/unelte/calculator-salariu",
});

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
  readonly capete: readonly [string, string, string];
  readonly randuri: readonly Readonly<{
    valori: readonly [number, number, number];
    href: string;
  }>[];
}) {
  return (
    <table className="w-full text-left">
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
                key={capete[i]}
                className="font-mk-date py-2.5 pr-4 text-[0.9375rem] tabular-nums"
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
        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          <TabelUzual
            legenda="Calcul salariu net din brut"
            capete={["Brut", "Net", "Cost firmă"]}
            randuri={[4325, 4500, 5000, 6000, 7000, 8000, 10000, 15000].map((brut) => {
              const r = dinBrut(brut, 0, true);
              return {
                valori: [r.brut, r.net, r.costTotal],
                href: `?suma=${String(brut)}&din=brut#rezultat`,
              };
            })}
          />
          <TabelUzual
            legenda="Calcul salariu brut din net"
            capete={["Net dorit", "Brut necesar", "Cost firmă"]}
            randuri={[3000, 3500, 4000, 5000, 6000, 7000].map((net) => {
              const r = dinNet(net, 0, true);
              return {
                valori: [net, r.brut, r.costTotal],
                href: `?suma=${String(net)}&din=net#rezultat`,
              };
            })}
          />
        </div>
        <p className="text-mk-text-slab mt-5 max-w-[68ch] text-[0.8125rem] leading-[1.55]">
          Normă întreagă, funcția de bază, fără persoane în întreținere, valorile din iulie 2026.
          Pentru alte situații, scrie suma în calculator.
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
            "Scutirile pentru persoanele cu handicap și pentru cercetare-dezvoltare. Facilitățile pe sectoare de activitate nu se mai aplică veniturilor din 2025 (OUG 156/2024).",
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
