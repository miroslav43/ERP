import Link from "next/link";

import { CONTACT } from "@/content/landing/contact";
import type { ContinutLanding } from "@/content/landing/tipuri";

import { FormularDemo } from "../../cere-demo/formular-demo";
import { Banda } from "../banda";
import { Foaia } from "../foaia";

/**
 * Benzile care poartă vânzarea: eroul cu foaia de pontaj, dovada, situația de
 * luni dimineața, prețul, pașii de pornire, întrebările, referințele, contactul.
 *
 * Astea rămân pe pagina de start — sunt răspunsul la întrebarea de la PRIMA
 * vizită („rezolvă problema mea și cât costă?”), spre deosebire de benzile din
 * `incredere.tsx`, care răspund la întrebarea de la a treia.
 *
 * Extragere verbatim din `pagina.tsx`. Vezi nota din `benzi/produs.tsx` pentru
 * de ce fiecare bandă primește întregul `text`.
 */
type ProprietatiBanda = { readonly text: ContinutLanding };

/**
 * Eroul nu folosește `Banda`: e singura secțiune fără riglă de separare
 * deasupra — n-are ce despărți, e prima — și singura cu propria scară
 * tipografică, `clamp(2.5rem, 5.8vw, 4.5rem)`.
 */
export function BandaHero({ text }: ProprietatiBanda) {
  return (
    <section id="sus" className="bg-mk-hartie text-mk-text">
      <div className="max-w-mk mx-auto w-full px-[clamp(1rem,4vw,2.5rem)] pt-16 pb-20 sm:pt-24 sm:pb-32">
        <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
          {text.hero.supratitlu}
        </p>
        <h1 className="font-mk-display mt-6 max-w-[16ch] text-[clamp(2.5rem,5.8vw,4.5rem)] leading-[0.98] font-semibold tracking-[-0.022em] text-balance">
          {text.hero.titlu}
        </h1>
        <p className="text-mk-text-slab mt-7 max-w-[58ch] text-[1.1875rem] leading-[1.6] text-pretty">
          {text.hero.lead}
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href={text.hero.ctaPrimar.href}
            className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
          >
            {text.hero.ctaPrimar.eticheta}
          </Link>
          <a
            href={text.hero.ctaSecundar.href}
            className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
          >
            {text.hero.ctaSecundar.eticheta}
          </a>
        </div>

        {/*
          Foaia stă ÎN erou, nu într-o bandă proprie. E singurul lucru de pe sit
          pe care concurența nu-l poate copia ieftin: nu o captură de ecran, ci
          produsul care rulează — 240 de celule randate pe server, cu totalurile
          care se închid și pe orizontală, și pe verticală, funcțional fără JS.
        */}
        <Foaia text={text.foaie} />
      </div>
    </section>
  );
}

export function BandaDovada({ text }: ProprietatiBanda) {
  return (
    <Banda id="dovada" inaltime="scurta">
      <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {text.dovada.randuri.map((rand) => (
          <div key={rand.eticheta}>
            <dt className="font-mk-date text-[1.75rem] leading-none tracking-[-0.02em] tabular-nums">
              {rand.valoare}
            </dt>
            <dd className="mt-2">
              <span className="font-mk-date text-mk-text-slab block text-[0.6875rem] tracking-[0.14em] uppercase">
                {rand.eticheta}
              </span>
              <span className="text-mk-text-slab mt-1.5 block max-w-[34ch] text-[0.8125rem] leading-[1.5]">
                {rand.nota}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </Banda>
  );
}

export function BandaRealitatea({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="realitatea"
      supratitlu={text.realitatea.supratitlu}
      titlu={text.realitatea.titlu}
      lead={text.realitatea.lead}
      aliniereTitlu="larg"
    >
      <div className="mt-12 grid gap-10 md:grid-cols-3">
        {text.realitatea.scene.map((scena) => (
          <div key={scena.titlu} className="border-mk-rigla/40 border-t pt-5">
            <h3 className="font-mk-display max-w-[24ch] text-[clamp(1.125rem,1.4vw,1.375rem)] leading-[1.18] font-semibold">
              {scena.titlu}
            </h3>
            <p className="text-mk-text-slab mt-3 text-[0.9375rem] leading-[1.6]">{scena.text}</p>
          </div>
        ))}
      </div>
    </Banda>
  );
}

export function BandaPreturi({ text }: ProprietatiBanda) {
  const numeModul = new Map(
    text.module.grupuri.flatMap((grup) => grup.module).map((modul) => [modul.cheie, modul.titlu]),
  );

  return (
    <Banda
      id="preturi"
      inaltime="inalta"
      supratitlu={text.preturi.supratitlu}
      titlu={text.preturi.titlu}
      lead={text.preturi.lead}
    >
      <div className="mt-12 grid gap-px sm:grid-cols-2 lg:grid-cols-4">
        {text.preturi.planuri.map((plan) => (
          <div
            key={plan.cheie}
            className={`border-mk-rigla flex flex-col border p-6 ${
              plan.recomandat === true ? "border-mk-text border-2" : ""
            }`}
          >
            <h3 className="font-mk-display text-[1.375rem] leading-[1.15] font-semibold">
              {plan.nume}
            </h3>
            <p className="text-mk-text-slab mt-2 min-h-[3rem] text-[0.875rem] leading-[1.5]">
              {plan.pentru}
            </p>
            <p className="font-mk-date text-mk-text-slab mt-4 text-[0.6875rem] tracking-[0.14em] uppercase">
              {plan.pret}
            </p>
            <ul className="border-mk-rigla/40 mt-4 flex-1 space-y-1.5 border-t pt-4">
              {plan.module.map((cheie) => (
                <li key={cheie} className="text-[0.8125rem] leading-[1.4]">
                  {numeModul.get(cheie) ?? cheie}
                </li>
              ))}
            </ul>
            <Link
              href={text.hero.ctaPrimar.href}
              className={`mt-6 inline-flex h-11 items-center justify-center rounded px-4 text-[0.9375rem] font-medium transition-opacity hover:opacity-90 ${
                plan.recomandat === true
                  ? "bg-mk-cerneala text-mk-text-inv"
                  : "border-mk-rigla hover:border-mk-text border"
              }`}
            >
              {text.preturi.cta}
            </Link>
          </div>
        ))}
      </div>
      <p className="text-mk-text-slab mt-6 max-w-[62ch] text-[0.8125rem] leading-[1.55]">
        {text.preturi.nota}
      </p>
      <Link
        href={text.preturi.legaturaPagina.href}
        className="mt-4 inline-block text-[0.9375rem] underline underline-offset-4"
      >
        {text.preturi.legaturaPagina.eticheta}
      </Link>
    </Banda>
  );
}

/** Singurul loc numerotat de pe sit. Numerotarea aici înseamnă ordine obligatorie. */
export function BandaImplementare({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="implementare"
      supratitlu={text.implementare.supratitlu}
      titlu={text.implementare.titlu}
      lead={text.implementare.lead}
    >
      <ol className="mt-12 grid gap-8 md:grid-cols-5">
        {text.implementare.pasi.map((pas, index) => (
          <li key={pas.titlu} className="border-mk-rigla/40 border-t pt-5">
            <p className="font-mk-date flex items-baseline gap-3 text-[0.6875rem] tracking-[0.14em] uppercase">
              <span className="text-mk-text text-[1.25rem] tabular-nums">{index + 1}</span>
              <span className="text-mk-text-slab">{pas.actor}</span>
            </p>
            <h3 className="font-mk-display mt-3 text-[1.0625rem] leading-[1.2] font-semibold">
              {pas.titlu}
            </h3>
            <p className="text-mk-text-slab mt-2 text-[0.875rem] leading-[1.55]">{pas.text}</p>
          </li>
        ))}
      </ol>
    </Banda>
  );
}

/**
 * `<details>` nativ, deschis fără o linie de JavaScript.
 *
 * NU se marchează cu `FAQPage`: rezultatele îmbogățite s-au retras la 7 mai
 * 2026. Ce rămâne valoros e structura însăși — o întrebare urmată imediat de
 * răspunsul ei e unitatea pe care un motor generativ o poate cita întreagă.
 */
export function BandaIntrebari({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="intrebari"
      supratitlu={text.intrebari.supratitlu}
      titlu={text.intrebari.titlu}
      lead={text.intrebari.lead}
    >
      <div className="border-mk-rigla/40 mt-10 border-t">
        {text.intrebari.intrebari.map((intrebare) => (
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
            <p className="text-mk-text-slab max-w-[72ch] pb-5 text-[0.9375rem] leading-[1.6]">
              {intrebare.a}
            </p>
          </details>
        ))}
      </div>
    </Banda>
  );
}

export function BandaClienti({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="clienti"
      inaltime="scurta"
      supratitlu={text.clienti.supratitlu}
      titlu={text.clienti.titlu}
    >
      <p className="text-mk-text-slab mt-5 max-w-[62ch] text-[0.9375rem] leading-[1.6]">
        {text.clienti.text}
      </p>
    </Banda>
  );
}

/**
 * Hârtie OBLIGATORIU: aici stau singurele controale NATIVE de formular de pe
 * sit. Pe cerneală, browserul le desenează cu propria paletă și nu ascultă de
 * tokenii inversați.
 */
export function BandaContact({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="contact"
      inaltime="inalta"
      supratitlu={text.contact.supratitlu}
      titlu={text.contact.titlu}
      lead={text.contact.lead}
    >
      <div className="mt-12 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <dl className="border-mk-rigla/40 border-t">
            <div className="border-mk-rigla/40 border-b py-4">
              <dt className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
                {text.contact.telefonEticheta}
              </dt>
              <dd className="mt-1">
                <a
                  href={CONTACT.telefonLegatura}
                  className="font-mk-date text-[1.25rem] tracking-[0.02em] tabular-nums"
                >
                  {CONTACT.telefon}
                </a>
              </dd>
            </div>
            <div className="border-mk-rigla/40 border-b py-4">
              <dt className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
                {text.contact.emailEticheta}
              </dt>
              <dd className="mt-1">
                <a href={`mailto:${CONTACT.email}`} className="text-[0.9375rem] break-all">
                  {CONTACT.email}
                </a>
              </dd>
            </div>
            <div className="border-mk-rigla/40 border-b py-4">
              <dt className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
                {text.contact.programEticheta}
              </dt>
              <dd className="mt-1 text-[0.9375rem]">{text.contact.program}</dd>
            </div>
          </dl>
          <p className="text-mk-text-slab mt-5 max-w-[42ch] text-[0.8125rem] leading-[1.55]">
            {text.contact.notaReferinte}
          </p>
        </div>

        <div className="lg:col-span-7">
          <h3 className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
            {text.contact.formularTitlu}
          </h3>
          <div className="mt-5 max-w-xl">
            <FormularDemo limba={text.limba} />
          </div>
        </div>
      </div>
    </Banda>
  );
}
