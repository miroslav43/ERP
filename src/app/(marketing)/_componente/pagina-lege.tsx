import Link from "next/link";
import type { ReactNode } from "react";

import { RO } from "@/content/landing/ro";
import { ancoraRand, cuprinsulPaginii, TITLU_NESIGUR } from "@/content/legal/cuprins";
import type { PaginaLege } from "@/content/legal/tipuri";

import { AntetSecundar } from "./antet-secundar";
import { Banda } from "./banda";
import { Cadru } from "./cadru";
import { JsonLd } from "./json-ld";
import { dataModificarii, nodArticol } from "./noduri-json-ld";
import { PeAcelasiSubiect } from "./pe-acelasi-subiect";
import { capturaModulului, INALTIME_CAPTURA, LATIME_CAPTURA } from "./vitrine";

/**
 * Randarea unei pagini care explică o obligație legală.
 *
 * ── DE CE O SINGURĂ COMPONENTĂ PENTRU DOUĂ PAGINI ─────────────────────────
 * `/evidenta-orelor-de-munca` și `/reges-online` au exact aceeași structură:
 * răspuns scurt, reguli cu temei, amenzi, proză, ce nu se poate confirma. Două
 * copii ale aceleiași randări s-ar fi despărțit la prima corectură de stil, iar
 * aici despărțirea înseamnă că una dintre pagini rămâne fără mențiunea „ce nu
 * putem confirma" — adică fix partea care le face credibile.
 *
 * ── DE CE `<dl>` ȘI NU `<table>` ──────────────────────────────────────────
 * Sunt perechi situație-cerință, nu un tabel cu două axe. Un `<table>` cu
 * `border-collapse` are și capcana lui în proiectul ăsta: fundalul pus pe `<tr>`
 * nu se aplică. Lista de definiții se rearanjează singură pe telefon, fără
 * derulare orizontală și fără coloane strivite.
 *
 * ── DE CE „ACTUALIZAT" E VIZIBIL ──────────────────────────────────────────
 * Conținutul juridic de pe internet e vizibil stricat: circulă articole datate
 * anul curent care listează cuantumuri depășite. O dată vizibilă e ce distinge o
 * pagină întreținută de una abandonată — și pentru cititor, și pentru un model
 * care trebuie să aleagă pe care s-o creadă.
 */
/** `2026-10-07` → „7 octombrie 2026”. Data e calendaristică, deci fără fus orar. */
function dataLunga(iso: string): string {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * „Astea trei nu stau” era scris de mână în componenta comună, iar
 * `/evidenta-orelor-de-munca` are doar două întrebări nesigure. Numeralul vine
 * acum din lungimea listei; peste cinci, cifra.
 */
function numeralNesigur(n: number): string {
  if (n === 1) return "Asta nu stă";
  const cuvinte: Readonly<Record<number, string>> = {
    2: "două",
    3: "trei",
    4: "patru",
    5: "cinci",
  };
  return `Astea ${cuvinte[n] ?? String(n)} nu stau`;
}

/**
 * O unealtă interactivă pusă pe pagina-lege, înaintea tabelului (calculatorul de
 * diurnă externă). Conținutul e o componentă; titlul intră și în cuprins.
 */
export type CalculatorPagina = Readonly<{ titlu: string; lead: string; continut: ReactNode }>;

export function RandarePaginaLege({
  text,
  calculator,
}: {
  text: PaginaLege;
  calculator?: CalculatorPagina;
}) {
  const captura = text.captura === undefined ? undefined : capturaModulului(text.captura.cheie);
  // Ancorele și cuprinsul vin din aceeași listă: o bandă fără intrare în cuprins,
  // sau o intrare spre o bandă fără `id`, nu se pot despărți. Calculatorul, când
  // există, stă înaintea tabelului și în pagină, și în cuprins.
  const dinText = cuprinsulPaginii(text);
  // Înaintea tabelului, dacă pagina are unul; altfel înaintea ultimei benzi.
  const loc = dinText.findIndex((c) => c.titlu === text.tabel?.titlu);
  const pozitie = loc >= 0 ? loc : dinText.length - 1;
  const cuprins =
    calculator === undefined
      ? dinText
      : [
          ...dinText.slice(0, pozitie),
          { id: "calculator", titlu: calculator.titlu },
          ...dinText.slice(pozitie),
        ];
  const ancora = (titlu: string) => cuprins.find((c) => c.titlu === titlu)?.id ?? ancoraRand(titlu);
  return (
    <Cadru text={RO}>
      {/* `dateModified` e data verificării textelor de lege — același `actualizatIso`
          care ajunge și în `lastmod` din sitemap. */}
      <JsonLd date={nodArticol(text)} />
      <AntetSecundar
        text={text.antet}
        // Butonul vine după răspunsul scurt, mai jos — vezi comentariul de acolo.
        cta={null}
        // Toate paginile-lege stau sub „Ghiduri", inclusiv `/reges-online` și
        // `/evidenta-orelor-de-munca`, care au adrese la rădăcină: traseul spune
        // ierarhia sitului, iar hub-ul `/ghid` le listează pe amândouă. Până la
        // 7 oct 2026 cele două n-aveau nici traseu vizibil, nici `BreadcrumbList`.
        firimituri={[
          { eticheta: "Acasă", href: "/" },
          { eticheta: "Ghiduri", href: "/ghid" },
          { eticheta: text.antet.titlu.split(":")[0] ?? text.antet.titlu, href: text.cale },
        ]}
      />

      {/* Răspunsul, înaintea oricărei nuanțe. Cine a ajuns aici dintr-o căutare
          are o întrebare, nu curiozitate despre istoricul legislativ. */}
      <Banda inaltime="scurta">
        <div className="border-mk-cerneala max-w-[68ch] border-l-2 pl-5">
          {text.raspunsScurt.map((p, i) => (
            <p
              key={p}
              className={`text-[1.0625rem] leading-[1.65] ${
                i === 0 ? "text-mk-text" : "text-mk-text-slab mt-3"
              }`}
            >
              {p}
            </p>
          ))}
        </div>
        {/* Zi exactă, în `<time>`, din aceleași câmpuri ca `datePublished` și
            `dateModified`: până la 7 oct 2026 pagina arăta doar luna, iar data
            precisă exista numai în JSON-LD. Contează mai ales pe căutările care
            poartă anul, ca „salariu minim pe economie 2026". */}
        <p className="font-mk-date text-mk-text-slab mt-6 text-[0.75rem] tracking-[0.08em] uppercase">
          Publicat pe <time dateTime={text.publicatIso}>{dataLunga(text.publicatIso)}</time> ·
          textele verificate pe{" "}
          <time dateTime={dataModificarii(text)}>{dataLunga(dataModificarii(text))}</time>
        </p>
        {/* Butonul stă aici, nu în antet: acolo rupea pasajul pe care îl citează
            motoarele generative (lead + răspuns). Rămâne aproape de pliu pe
            telefon — răspunsul are 100–150 de cuvinte. */}
        <Link
          href={RO.hero.ctaPrimar.href}
          data-umami-event="cta-dupa-raspuns"
          className="bg-mk-cerneala text-mk-text-inv mt-6 inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
        >
          {RO.hero.ctaPrimar.eticheta}
        </Link>
        {/* Cuprinsul, după buton: răspunsul și butonul rămân lângă pliu, iar
            cine caută o subsecțiune anume sare direct la ea (auditul din 7 oct
            2026). `<a>`, nu `<Link>`: e salt în aceeași pagină. */}
        <nav aria-label="Cuprins" className="mt-10 max-w-[68ch]">
          <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
            Pe pagina asta
          </p>
          <ol className="mt-3 space-y-2">
            {cuprins.map((c) => (
              <li key={c.id}>
                <a
                  href={`#${c.id}`}
                  className="text-[0.9375rem] leading-[1.4] underline underline-offset-4"
                >
                  {c.titlu}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </Banda>

      <Banda id={ancora(text.titluReguli)} inaltime="medie" titlu={text.titluReguli}>
        <dl className="border-mk-rigla/40 mt-8 border-t">
          {text.reguli.map((r) => (
            <div
              key={r.situatie}
              className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
            >
              <dt className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
                {r.situatie}
              </dt>
              <dd className="md:col-span-8">
                <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6]">{r.cerinta}</p>
                {/* Temeiul stă lângă regulă, nu într-o listă de la subsol. E și
                    ce face regula verificabilă, și — potrivit măsurătorilor pe
                    citarea în motoarele generative — ce o face citabilă. */}
                <p className="font-mk-date text-mk-text-slab mt-2 text-[0.75rem] tracking-[0.04em]">
                  {r.temei}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </Banda>

      {/* Captura din aplicație, unde există una care arată exact subiectul. Fără
          ea, banda lipsește cu totul — nu se pune o imagine aproximativă. */}
      {captura !== undefined && text.captura !== undefined && (
        <Banda inaltime="scurta">
          <figure className="max-w-[72rem]">
            {/* eslint-disable-next-line @next/next/no-img-element --
                Aceleași fișiere WebP, deja la două lățimi, ca în `prin-geam.tsx`:
                optimizatorul lui Next ar fi cost de server pentru zero câștig. */}
            <img
              src={captura.sursa}
              srcSet={captura.srcset}
              sizes="(min-width: 1240px) 1180px, 92vw"
              alt={text.captura.alt}
              width={LATIME_CAPTURA}
              height={INALTIME_CAPTURA}
              loading="lazy"
              decoding="async"
              className="border-mk-rigla block h-auto w-full rounded border"
            />
            <figcaption className="text-mk-text-slab mt-3 text-[0.8125rem] leading-[1.5]">
              {text.captura.legenda}
            </figcaption>
          </figure>
        </Banda>
      )}

      <Banda
        id={ancora(text.titluAmenzi)}
        fundal="cerneala"
        inaltime="medie"
        titlu={text.titluAmenzi}
        aliniereTitlu="larg"
      >
        <dl className="border-mk-rigla-inv/40 mt-8 border-t">
          {text.amenzi.map((a) => (
            <div key={a.fapta} className="border-mk-rigla-inv/40 border-b py-5">
              <div className="grid gap-2 md:grid-cols-12 md:gap-8">
                <dt className="text-[0.9375rem] leading-[1.5] md:col-span-7">{a.fapta}</dt>
                <dd className="md:col-span-5">
                  {/* Suma singură, în cifre tabulare, pe rândul ei. Calificativul
                      coboară dedesubt, în font de text: altfel se rup împreună la
                      capătul coloanei și cifra ajunge citită pe două rânduri. */}
                  <p className="font-mk-date text-[1.125rem] leading-[1.2] font-medium tabular-nums">
                    {a.suma}
                  </p>
                  {a.aplicare !== undefined && (
                    <p className="text-mk-text-inv-slab mt-1 text-[0.875rem] leading-[1.45]">
                      {a.aplicare}
                    </p>
                  )}
                  <p className="font-mk-date text-mk-text-inv-slab mt-2 text-[0.75rem] tracking-[0.04em]">
                    {a.temei}
                  </p>
                </dd>
              </div>
              {a.nuConfunda !== undefined && (
                <p className="text-mk-text-inv-slab border-mk-rigla-inv/40 mt-3 max-w-[72ch] border-l pl-4 text-[0.875rem] leading-[1.6]">
                  {a.nuConfunda}
                </p>
              )}
            </div>
          ))}
        </dl>
      </Banda>

      {text.sectiuni.map((s) => (
        <Banda key={s.titlu} id={ancora(s.titlu)} inaltime="medie" titlu={s.titlu}>
          <div className="mt-6 max-w-[68ch] space-y-4">
            {s.paragrafe.map((p) => (
              <p key={p} className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
                {p}
              </p>
            ))}
          </div>
        </Banda>
      ))}

      {calculator !== undefined && (
        <Banda id="calculator" inaltime="medie" titlu={calculator.titlu} lead={calculator.lead}>
          {calculator.continut}
        </Banda>
      )}

      {text.tabel !== undefined && (
        <Banda id={ancora(text.tabel.titlu)} inaltime="medie" titlu={text.tabel.titlu}>
          {text.tabel.saltLa !== undefined && (
            <nav aria-label="Sari la țară" className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
              {text.tabel.saltLa.map((tara) => (
                <a
                  key={tara}
                  href={`#${ancoraRand(tara)}`}
                  className="text-[0.9375rem] underline underline-offset-4"
                >
                  {/* „Anglia (Regatul Unit…)” e prea lungă pentru un rând de legături. */}
                  {tara.split(" (")[0]}
                </a>
              ))}
            </nav>
          )}
          {/* `relative` pe containerul derulabil, ca orice tabel lat din sit. */}
          <div className="relative mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left text-[0.9375rem]">
              <thead>
                <tr className="border-mk-rigla border-b">
                  {text.tabel.coloane.map((c) => (
                    <th key={c} scope="col" className="py-2 pr-4 align-bottom font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {text.tabel.randuri.map((r) => (
                  <tr
                    key={r[0]}
                    id={ancoraRand(r[0] ?? "")}
                    // `scroll-mt`: rândul țintit dintr-o legătură cu ancoră (ex. o țară din
                    // diurna externă) aterizează sub antetul lipit, nu ascuns de el.
                    className="border-mk-rigla/40 scroll-mt-24 border-b"
                  >
                    {r.map((celula, i) => (
                      <td
                        key={`${r[0] ?? ""}-${String(i)}`}
                        className={`py-2 pr-4 ${i === 0 ? "" : "font-mk-date tabular-nums"}`}
                      >
                        {celula}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-mk-text-slab mt-4 max-w-[72ch] text-[0.875rem] leading-[1.6]">
            {text.tabel.nota}
          </p>
        </Banda>
      )}

      {/*
        Secțiunea care lipsește de pe paginile concurente. Nu e modestie: o
        pagină juridică fără margini declarate se citește ca sigură pe tot, iar
        cine verifică una singură și o găsește greșită nu mai crede nimic din
        rest.
      */}
      <Banda
        id={ancora(TITLU_NESIGUR)}
        inaltime="medie"
        supratitlu="Unde se termină certitudinea"
        titlu={TITLU_NESIGUR}
        lead={`Fiecare rând de mai sus stă pe un text de lege citit în forma consolidată. ${numeralNesigur(text.nesigur.length)}, și preferăm s-o spunem noi.`}
      >
        <dl className="border-mk-rigla/40 mt-8 border-t">
          {text.nesigur.map((n) => (
            <div key={n.intrebare} className="border-mk-rigla/40 border-b py-5">
              <dt className="font-mk-display max-w-[52ch] text-[1.0625rem] leading-[1.3] font-semibold">
                {n.intrebare}
              </dt>
              <dd className="text-mk-text-slab mt-2 max-w-[72ch] text-[0.9375rem] leading-[1.7]">
                {n.raspuns}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-mk-text-slab mt-8 max-w-[68ch] text-[0.875rem] leading-[1.7]">
          Pagina e informativă și nu ține loc de consultanță juridică. Textele au fost verificate în{" "}
          {text.actualizat} pe Portalul Legislativ; înainte de o decizie cu miză, verifică forma în
          vigoare la data respectivă.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={RO.hero.ctaPrimar.href}
            data-umami-event="cta-pagina-lege"
            className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
          >
            {RO.hero.ctaPrimar.eticheta}
          </Link>
          <Link
            href={text.legaturaSecundara.href}
            className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
          >
            {text.legaturaSecundara.eticheta}
          </Link>
        </div>
        {text.surse !== undefined && (
          <div className="mt-10">
            <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
              Textele de lege
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              {text.surse.map((s) => (
                <li key={s.href}>
                  {/* Legături în afară, către sursa primară. `noopener` fiindcă se
                      deschid în filă nouă: cine verifică un articol nu vrea să
                      piardă pagina de pe care a plecat. */}
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[0.9375rem] underline underline-offset-4"
                  >
                    {s.eticheta}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <PeAcelasiSubiect legaturi={text.legaturiConexe} />
      </Banda>
    </Cadru>
  );
}
