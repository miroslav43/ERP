import Link from "next/link";

import { RO } from "@/content/landing/ro";
import type { PaginaLege } from "@/content/legal/tipuri";

import { AntetSecundar } from "./antet-secundar";
import { Banda } from "./banda";
import { Cadru } from "./cadru";

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
export function RandarePaginaLege({ text }: { text: PaginaLege }) {
  return (
    <Cadru text={RO}>
      <AntetSecundar text={text.antet} />

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
        <p className="font-mk-date text-mk-text-slab mt-6 text-[0.75rem] tracking-[0.08em] uppercase">
          Textele verificate în {text.actualizat}
        </p>
      </Banda>

      <Banda inaltime="medie" titlu={text.titluReguli}>
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

      <Banda fundal="cerneala" inaltime="medie" titlu="Amenzile" aliniereTitlu="larg">
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
        <Banda key={s.titlu} inaltime="medie" titlu={s.titlu}>
          <div className="mt-6 max-w-[68ch] space-y-4">
            {s.paragrafe.map((p) => (
              <p key={p} className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
                {p}
              </p>
            ))}
          </div>
        </Banda>
      ))}

      {/*
        Secțiunea care lipsește de pe paginile concurente. Nu e modestie: o
        pagină juridică fără margini declarate se citește ca sigură pe tot, iar
        cine verifică una singură și o găsește greșită nu mai crede nimic din
        rest.
      */}
      <Banda
        inaltime="medie"
        supratitlu="Unde se termină certitudinea"
        titlu="Ce nu putem afirma cu siguranță"
        lead="Fiecare rând de mai sus stă pe un text de lege citit în forma consolidată. Astea trei nu stau, și preferăm s-o spunem noi."
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
      </Banda>
    </Cadru>
  );
}
