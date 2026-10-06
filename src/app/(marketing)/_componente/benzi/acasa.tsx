import Link from "next/link";

import { slugModul } from "@/content/landing/slug-module";
import type { ContinutLanding } from "@/content/landing/tipuri";

import { Banda } from "../banda";
import { capturaInalta, capturaModulului, INALTIME_CAPTURA, LATIME_CAPTURA } from "../vitrine";

/**
 * Benzile pe care pagina de start le-a primit la refacerea din 6 oct 2026:
 * produsul pe ecranele lui reale, pentru cine e, uneltele gratuite, siguranța
 * datelor în cuvintele cumpărătorului, pașii de pornire și întrebările scurte.
 *
 * Analiza care le-a cerut e în `docs/comercial/refacere-site-2026-10-06.md`.
 * Pe scurt: pagina spunea ce e produsul, dar nu-l arăta; vorbea despre straturi
 * de securitate și operații idempotente unui patron care voia să afle dacă scapă
 * de Excel; iar uneltele gratuite — singurul lucru pe care îl caută lumea cu
 * zecile de mii pe lună — apăreau doar în subsol.
 *
 * Fără `"use client"`, ca restul stratului de marketing: mărirea capturilor vine
 * din atributul nativ `popover`, deschiderea întrebărilor din `<details>`.
 */
type ProprietatiBanda = { readonly text: ContinutLanding };
type Rand = ContinutLanding["produs"]["randuri"][number];

/** Eticheta mono de deasupra unui titlu de rând — aceeași scară ca supratitlul benzii. */
const ETICHETA =
  "font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase";

export function BandaProdus({ text }: ProprietatiBanda) {
  const { produs } = text;

  return (
    <Banda id="produs" supratitlu={produs.supratitlu} titlu={produs.titlu} lead={produs.lead}>
      <div className="mt-14 space-y-16 sm:space-y-24">
        {produs.randuri.map((rand, index) => (
          <article key={rand.titlu} className="grid items-center gap-8 lg:grid-cols-12 lg:gap-14">
            {/*
              Rândurile alternează partea, ca ochiul să nu alunece pe o singură
              coloană de text. Ordinea din DOM rămâne text, apoi imagine — e
              ordinea de citire și pe telefon, unde coloanele se stivuiesc.
            */}
            <div className={`lg:col-span-5 ${index % 2 === 1 ? "lg:order-2" : ""}`}>
              <p className={ETICHETA}>{rand.eticheta}</p>
              <h3 className="font-mk-display mt-3 text-[clamp(1.375rem,2.2vw,1.875rem)] leading-[1.12] font-semibold tracking-[-0.01em] text-balance">
                {rand.titlu}
              </h3>
              <p className="text-mk-text-slab mt-4 text-[1rem] leading-[1.6] text-pretty">
                {rand.text}
              </p>
              <ul className="border-mk-rigla/40 mt-6 border-t">
                {rand.puncte.map((punct) => (
                  <li
                    key={punct}
                    className="border-mk-rigla/40 border-b py-2.5 text-[0.9375rem] leading-[1.45]"
                  >
                    {punct}
                  </li>
                ))}
              </ul>
              <p className="mt-6 flex flex-wrap gap-x-6 gap-y-1">
                <Link
                  href={rand.legatura.href}
                  data-umami-event={`produs-${rand.legatura.href.replace(/^\//, "").replaceAll("/", "-")}`}
                  className="inline-block py-1 text-[0.9375rem] font-medium underline underline-offset-4"
                >
                  {rand.legatura.eticheta}
                </Link>
                {/*
                  Ecranul viu, fără cont. `<a>`, nu `<Link>`: vitrina e o pagină
                  fără antetul sitului, gândită să fie deschisă singură.
                */}
                {rand.demo !== undefined && (
                  <a
                    href={rand.demo.href}
                    data-umami-event={`demo-${rand.demo.href.split("/").pop() ?? ""}`}
                    className="text-mk-text-slab hover:text-mk-text inline-block py-1 text-[0.9375rem] underline underline-offset-4"
                  >
                    {rand.demo.eticheta}
                  </a>
                )}
              </p>
            </div>
            <div className={`lg:col-span-7 ${index % 2 === 1 ? "lg:order-1" : ""}`}>
              <VizualRand rand={rand} text={text} />
            </div>
          </article>
        ))}
      </div>

      {/*
        Catalogul, generat din `text.module` — NU scris de mână în `produs`.
        Așa pagina de start trimite la fiecare pagină de modul și nu poate rămâne
        în urmă când apare un modul nou (poarta din `continut.test.ts`).
      */}
      <div className="border-mk-rigla mt-20 border-t pt-10 sm:mt-28">
        <h3 className="font-mk-display text-[clamp(1.25rem,1.8vw,1.5rem)] leading-[1.15] font-semibold">
          {produs.restTitlu}
        </h3>
        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-10 lg:grid-cols-3">
          {text.module.grupuri.map((grup) => (
            <div key={grup.cheie}>
              <p className={ETICHETA}>{grup.titlu}</p>
              <ul className="mt-2">
                {grup.module.map((modul) => (
                  <li key={modul.cheie}>
                    <Link
                      href={`/module/${slugModul(modul.cheie)}`}
                      className="inline-block py-1.5 text-[0.9375rem] underline-offset-4 hover:underline"
                    >
                      {modul.titlu}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <Link
          href={produs.legaturaModule.href}
          className="mt-8 inline-block py-1 text-[0.9375rem] font-medium underline underline-offset-4"
        >
          {produs.legaturaModule.eticheta}
        </Link>
      </div>
    </Banda>
  );
}

/** Ce stă lângă textul unui rând: ecranul modulului, telefonul, sau panoul. */
function VizualRand({ rand, text }: { readonly rand: Rand; readonly text: ContinutLanding }) {
  if (rand.captura === "telefon") return <Telefon descriere={rand.descriereCaptura} />;
  if (rand.captura !== null) {
    return <Ecran cheie={rand.captura} descriere={rand.descriereCaptura} text={text} />;
  }
  if (rand.panou === undefined) return null;

  return (
    <div className="border-mk-rigla border">
      <p className={`${ETICHETA} px-5 pt-5`}>{rand.panou.titlu}</p>
      <table className="mt-3 w-full text-left">
        <tbody>
          {rand.panou.randuri.map((r) => (
            <tr key={r.ce} className="border-mk-rigla/40 border-t align-baseline">
              <th scope="row" className="px-5 py-3.5 text-[0.9375rem] leading-[1.4] font-medium">
                {r.ce}
              </th>
              <td className="font-mk-date text-mk-text-slab px-5 py-3.5 text-[0.8125rem] leading-[1.45]">
                {r.termen}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-mk-text-slab border-mk-rigla/40 border-t px-5 py-3 text-[0.75rem] leading-[1.5]">
        {rand.panou.sursa}
      </p>
    </div>
  );
}

/**
 * Ecranul unui modul, mărit la apăsare.
 *
 * Mecanica e copiată din `prin-geam.tsx`, intenționat, nu abstractizată — vezi
 * nota din `in-mana.tsx`. Diferența: aici textele vin din conținut, nu sunt
 * scrise în română în componentă, fiindcă banda se randează și pe `/en`.
 */
function Ecran({
  cheie,
  descriere,
  text,
}: {
  readonly cheie: string;
  readonly descriere: string;
  readonly text: ContinutLanding;
}) {
  const captura = capturaModulului(cheie);
  if (captura === undefined) return null;
  const idMarit = `ecran-${cheie}`;

  return (
    <figure>
      <button
        type="button"
        popoverTarget={idMarit}
        className="border-mk-rigla bg-mk-hartie block w-full cursor-zoom-in border p-2 text-left"
        aria-label={`${descriere} — ${text.produs.mareste}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element --
            Fișierele sunt deja WebP în două lățimi; motivul complet e în
            `prin-geam.tsx`. */}
        <img
          src={captura.sursa}
          srcSet={captura.srcset}
          sizes="(min-width: 1240px) 680px, (min-width: 1024px) 55vw, 92vw"
          alt={descriere}
          width={LATIME_CAPTURA}
          height={INALTIME_CAPTURA}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      </button>
      <figcaption className="text-mk-text-slab mt-3 text-[0.8125rem] leading-[1.5]">
        {text.produs.notaCaptura}
      </figcaption>
      <div
        id={idMarit}
        popover="auto"
        className="backdrop:bg-mk-cerneala/85 max-h-[92dvh] max-w-[96vw] border-0 bg-transparent p-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- vezi mai sus. */}
        <img
          src={captura.sursa}
          alt={descriere}
          width={LATIME_CAPTURA}
          height={INALTIME_CAPTURA}
          className="block h-auto max-h-[92dvh] w-auto max-w-full"
        />
        <button
          type="button"
          popoverTarget={idMarit}
          popoverTargetAction="hide"
          className="font-mk-date bg-mk-cerneala text-mk-text-inv absolute top-2 right-2 px-3 py-1.5 text-[0.6875rem] tracking-[0.14em] uppercase"
        >
          {text.produs.inchide}
        </button>
      </div>
    </figure>
  );
}

/**
 * Ecranul de pontare din portal, pe un telefon real de 390px.
 *
 * Nu se mărește: e deja la scara la care îl vede omul în mână. Lățimea e
 * plafonată ca imaginea înaltă să nu întindă rândul pe două ecrane.
 */
function Telefon({ descriere }: { readonly descriere: string }) {
  const captura = capturaInalta("portal-pontare");
  if (captura === undefined) return null;

  return (
    <div className="flex justify-center lg:justify-start">
      <div className="border-mk-rigla bg-mk-hartie w-full max-w-[14rem] border p-2 lg:max-w-[18rem]">
        {/* eslint-disable-next-line @next/next/no-img-element -- vezi `Ecran`. */}
        <img
          src={captura.sursa}
          srcSet={captura.srcset}
          sizes="(min-width: 1024px) 18rem, 14rem"
          alt={descriere}
          width={captura.latime}
          height={captura.inaltime}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      </div>
    </div>
  );
}

export function BandaPentruCine({ text }: ProprietatiBanda) {
  const { pentruCine } = text;

  return (
    <Banda
      id="pentru-cine"
      supratitlu={pentruCine.supratitlu}
      titlu={pentruCine.titlu}
      lead={pentruCine.lead}
    >
      <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {pentruCine.roluri.map((rol) => (
          <div key={rol.cine} className="border-mk-rigla/40 flex flex-col border-t pt-5">
            <h3 className="font-mk-display text-[clamp(1.125rem,1.4vw,1.375rem)] leading-[1.18] font-semibold">
              {rol.cine}
            </h3>
            <p className="text-mk-text-slab mt-3 flex-1 text-[0.9375rem] leading-[1.6]">
              {rol.text}
            </p>
            <Link
              href={rol.legatura.href}
              className="mt-4 inline-block py-1 text-[0.9375rem] underline underline-offset-4"
            >
              {rol.legatura.eticheta}
            </Link>
          </div>
        ))}
      </div>
    </Banda>
  );
}

/**
 * Uneltele gratuite. Prima — calculatorul — ia două coloane: e unealta cu cea
 * mai mare cerere din toată cercetarea de cuvinte cheie.
 */
export function BandaUnelte({ text }: ProprietatiBanda) {
  const { unelteGratuite } = text;

  return (
    <Banda
      id="unelte"
      supratitlu={unelteGratuite.supratitlu}
      titlu={unelteGratuite.titlu}
      lead={unelteGratuite.lead}
    >
      <ul className="mt-12 grid gap-px sm:grid-cols-2 lg:grid-cols-4">
        {unelteGratuite.unelte.map((unealta, index) => (
          <li key={unealta.href} className={index === 0 ? "sm:col-span-2" : ""}>
            <Link
              href={unealta.href}
              data-umami-event={`unealta-${unealta.href.split("/").pop() ?? ""}`}
              className={`border-mk-rigla hover:border-mk-text flex h-full flex-col border p-4 transition-colors sm:p-5 ${
                index === 0 ? "bg-mk-activ-hartie" : ""
              }`}
            >
              <span
                className={`font-mk-display leading-[1.2] font-semibold ${
                  index === 0 ? "text-[1.375rem]" : "text-[1.125rem]"
                }`}
              >
                {unealta.titlu}
              </span>
              {/*
                Pe telefon, șapte carduri cu descriere luau aproape două ecrane.
                Acolo rămân titlul și formatele — exact ce decide clicul.
              */}
              <span className="text-mk-text-slab mt-2 hidden flex-1 text-[0.875rem] leading-[1.55] sm:block">
                {unealta.text}
              </span>
              <span className={`${ETICHETA} mt-2 sm:mt-4`}>{unealta.formate}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 grid gap-4 lg:grid-cols-12">
        <p className={`${ETICHETA} lg:col-span-3 lg:pt-1.5`}>{unelteGratuite.ghiduriTitlu}</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 lg:col-span-9">
          {unelteGratuite.ghiduri.map((ghid) => (
            <li key={ghid.href}>
              <Link
                href={ghid.href}
                className="inline-block py-1 text-[0.9375rem] underline underline-offset-4"
              >
                {ghid.eticheta}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Link
        href={unelteGratuite.legaturaToate.href}
        className="mt-6 inline-block py-1 text-[0.9375rem] font-medium underline underline-offset-4"
      >
        {unelteGratuite.legaturaToate.eticheta}
      </Link>
    </Banda>
  );
}

/**
 * Promisiunile, în locul recomandărilor pe care nu le avem încă. Două coloane
 * de rânduri numerotate cu liniuță, nu carduri: se citesc ca o listă de
 * angajamente, nu ca o grilă de funcții.
 */
export function BandaPromisiuni({ text }: ProprietatiBanda) {
  const { promisiuni } = text;

  return (
    <Banda
      id="promisiuni"
      supratitlu={promisiuni.supratitlu}
      titlu={promisiuni.titlu}
      lead={promisiuni.lead}
    >
      <ul className="mt-12 grid gap-x-12 md:grid-cols-2">
        {promisiuni.puncte.map((punct) => (
          <li
            key={punct.titlu}
            className="border-mk-rigla/40 grid grid-cols-[2rem_1fr] border-t py-5"
          >
            <span aria-hidden="true" className="font-mk-date text-mk-text-slab text-[0.9375rem]">
              —
            </span>
            <span>
              <span className="font-mk-display block text-[1.1875rem] leading-[1.25] font-semibold">
                {punct.titlu}
              </span>
              <span className="text-mk-text-slab mt-1.5 block text-[0.9375rem] leading-[1.6]">
                {punct.text}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Banda>
  );
}

/** Pe cerneală: singura bandă întunecată din mijlocul paginii, cum era și încrederea. */
export function BandaSiguranta({ text }: ProprietatiBanda) {
  const { siguranta } = text;

  return (
    <Banda
      id="siguranta"
      fundal="cerneala"
      supratitlu={siguranta.supratitlu}
      titlu={siguranta.titlu}
      lead={siguranta.lead}
    >
      <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {siguranta.puncte.map((punct) => (
          <div key={punct.titlu} className="border-mk-rigla-inv border-t pt-5">
            <h3 className="font-mk-display text-[1.1875rem] leading-[1.2] font-semibold">
              {punct.titlu}
            </h3>
            <p className="text-mk-text-inv-slab mt-3 text-[0.9375rem] leading-[1.6]">
              {punct.text}
            </p>
          </div>
        ))}
      </div>
      <Link
        href={siguranta.legatura.href}
        className="bg-mk-hartie text-mk-cerneala mt-12 inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
      >
        {siguranta.legatura.eticheta}
      </Link>
    </Banda>
  );
}

/** Singurul loc numerotat de pe pagină: aici ordinea chiar e obligatorie. */
export function BandaIncepe({ text }: ProprietatiBanda) {
  const { incepe } = text;

  return (
    <Banda id="incepe" supratitlu={incepe.supratitlu} titlu={incepe.titlu} lead={incepe.lead}>
      <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {incepe.pasi.map((pas, index) => (
          <li key={pas.titlu} className="border-mk-rigla/40 border-t pt-5">
            <p className="font-mk-date text-[1.5rem] leading-none tabular-nums">{index + 1}</p>
            <h3 className="font-mk-display mt-4 text-[1.1875rem] leading-[1.2] font-semibold">
              {pas.titlu}
            </h3>
            <p className="text-mk-text-slab mt-2 text-[0.9375rem] leading-[1.55]">{pas.text}</p>
          </li>
        ))}
      </ol>
      <div className="border-mk-rigla/40 mt-12 flex flex-col items-start gap-5 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[58ch] text-[1rem] leading-[1.6]">{incepe.alternativa.text}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={text.hero.ctaPrimar.href}
            data-umami-event="cta-incepe"
            className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
          >
            {text.hero.ctaPrimar.eticheta}
          </Link>
          <Link
            href={incepe.alternativa.legatura.href}
            data-umami-event="cta-incepe-demo"
            className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
          >
            {incepe.alternativa.legatura.eticheta}
          </Link>
        </div>
      </div>
    </Banda>
  );
}

/**
 * Întrebările scurte, pe `<details>` nativ. Fără `FAQPage` — motivul e în
 * `BandaIntrebari` din `comercial.tsx`.
 */
export function BandaIntrebariScurte({ text }: ProprietatiBanda) {
  const { intrebariScurte } = text;

  return (
    <Banda
      id="intrebari-scurte"
      supratitlu={intrebariScurte.supratitlu}
      titlu={intrebariScurte.titlu}
    >
      <div className="border-mk-rigla/40 mt-10 border-t">
        {intrebariScurte.intrebari.map((intrebare) => (
          <details key={intrebare.q} className="border-mk-rigla/40 group border-b">
            <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-4 text-[1.0625rem] leading-[1.4] font-medium [&::-webkit-details-marker]:hidden">
              {intrebare.q}
              <span
                aria-hidden="true"
                className="font-mk-date text-mk-text-slab shrink-0 text-[0.875rem] group-open:hidden"
              >
                +
              </span>
              <span
                aria-hidden="true"
                className="font-mk-date text-mk-text-slab hidden shrink-0 text-[0.875rem] group-open:inline"
              >
                −
              </span>
            </summary>
            <div className="max-w-[72ch] pb-5">
              <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6]">{intrebare.a}</p>
              {intrebare.legatura !== undefined && (
                <Link
                  href={intrebare.legatura.href}
                  className="mt-2 inline-block py-1 text-[0.9375rem] underline underline-offset-4"
                >
                  {intrebare.legatura.eticheta}
                </Link>
              )}
            </div>
          </details>
        ))}
      </div>
      <Link
        href={intrebariScurte.legatura.href}
        className="mt-6 inline-block py-1 text-[0.9375rem] font-medium underline underline-offset-4"
      >
        {intrebariScurte.legatura.eticheta}
      </Link>
    </Banda>
  );
}
