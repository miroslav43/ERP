import type { ContinutLanding } from "@/content/landing/tipuri";

import { Banda } from "../banda";
import { RandRegistru, Registru } from "../registru";
import { VinietaPontaj, VinietaScadente } from "../viniete";

/**
 * Benzile care răspund la „pot avea încredere în voi?”: unde stă bariera dintre
 * firme, ce reguli românești sunt în produs, ce NU facem, cum se lucrează azi
 * față de cum se lucrează cu noi, și ce se schimbă de la un domeniu la altul.
 *
 * Sunt exact secțiunile care nu au ce căuta pe pagina de start: răspund la o
 * întrebare pe care omul și-o pune la a treia vizită, nu la prima. Fiecare
 * merită însă pagina ei — `onestitate` mai ales, fiindcă e conținut pe care
 * motoarele generative nu-l găsesc altundeva.
 *
 * Extragere verbatim din `pagina.tsx`. Vezi nota din `benzi/produs.tsx` pentru
 * de ce fiecare bandă primește întregul `text`.
 */
type ProprietatiBanda = { readonly text: ContinutLanding };

export function BandaIzolare({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="izolare"
      fundal="cerneala"
      inaltime="inalta"
      supratitlu={text.izolare.supratitlu}
      titlu={text.izolare.titlu}
      lead={text.izolare.lead}
    >
      <div className="mt-12 grid gap-12 lg:grid-cols-12">
        <ol className="lg:col-span-7">
          {text.izolare.straturi.map((strat, index) => (
            <li
              key={strat.nume}
              className={`border-mk-rigla-inv flex gap-5 border-t py-5 ${
                strat.bariera ? "border-mk-text-inv border-t-2" : ""
              }`}
            >
              <span className="font-mk-date text-mk-text-inv-slab w-6 shrink-0 pt-1 text-[0.6875rem] tabular-nums">
                {index + 1}
              </span>
              <div>
                <h3 className="font-mk-display flex flex-wrap items-baseline gap-x-3 text-[1.125rem] font-semibold">
                  {strat.nume}
                  <span
                    className={`font-mk-date text-[0.6875rem] tracking-[0.14em] uppercase ${
                      strat.bariera ? "text-mk-co-inv" : "text-mk-text-inv-slab"
                    }`}
                  >
                    {strat.rol}
                  </span>
                </h3>
                <p className="text-mk-text-inv-slab mt-2 max-w-[56ch] text-[0.875rem] leading-[1.6]">
                  {strat.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="lg:col-span-5">
          <VinietaPontaj
            titlu={text.izolare.vinieta.titlu}
            politica={text.izolare.vinieta.politica}
            contor={text.izolare.vinieta.contor}
            nota={text.izolare.vinieta.nota}
            randuri={text.izolare.vinieta.randuri}
            ascunse={text.izolare.vinieta.ascunse}
          />
        </div>
      </div>
    </Banda>
  );
}

export function BandaConformitate({ text }: ProprietatiBanda) {
  const roman = text.limba === "ro";
  return (
    <Banda
      id="conformitate"
      supratitlu={text.conformitate.supratitlu}
      titlu={text.conformitate.titlu}
      lead={text.conformitate.lead}
    >
      <div className="mt-12 grid gap-10 lg:grid-cols-12">
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:col-span-8">
          {text.conformitate.carduri.map((card) => (
            <div key={card.titlu} className="border-mk-rigla/40 border-t pt-5">
              <h3 className="font-mk-display max-w-[26ch] text-[1.125rem] leading-[1.2] font-semibold">
                {card.titlu}
              </h3>
              <p className="text-mk-text-slab mt-2.5 text-[0.875rem] leading-[1.55]">{card.text}</p>
              {card.temei !== "" && (
                <p className="font-mk-date text-mk-text-slab mt-3 text-[0.6875rem] tracking-[0.06em]">
                  {card.temei}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="lg:col-span-4">
          <VinietaScadente
            titlu={roman ? "Scadențe" : "Due dates"}
            nota={
              roman
                ? "Trei module diferite, o singură listă. Fiecare termen are un act normativ notat lângă el."
                : "Three different modules, one list. Every deadline carries the statute it comes from."
            }
          />
          <div className="mt-8">
            <h3 className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
              {text.conformitate.retentieTitlu}
            </h3>
            <dl className="border-mk-rigla/40 mt-3 border-t">
              {text.conformitate.retentie.map((rand) => (
                <div
                  key={rand.ce}
                  className="border-mk-rigla/40 flex flex-wrap justify-between gap-x-6 gap-y-1 border-b py-2.5 text-[0.8125rem]"
                >
                  <dt>{rand.ce}</dt>
                  <dd className="text-mk-text-slab max-w-[30ch] text-right">{rand.regula}</dd>
                </div>
              ))}
            </dl>
            <p className="text-mk-text-slab mt-3 text-[0.8125rem] leading-[1.5]">
              {text.conformitate.retentieNota}
            </p>
          </div>
        </div>
      </div>
    </Banda>
  );
}

export function BandaOnestitate({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="onestitate"
      fundal="cerneala"
      inaltime="inalta"
      supratitlu={text.onestitate.supratitlu}
      titlu={text.onestitate.titlu}
      lead={text.onestitate.lead}
      aliniereTitlu="larg"
    >
      <ul className="mt-12">
        {text.onestitate.randuri.map((rand) => (
          <li key={rand.titlu} className="border-mk-rigla-inv border-t py-6">
            <h3 className="font-mk-display text-[clamp(1.125rem,1.4vw,1.375rem)] leading-[1.18] font-semibold">
              {rand.titlu}
            </h3>
            <p className="text-mk-text-inv-slab mt-2 max-w-[72ch] text-[0.9375rem] leading-[1.6]">
              {rand.text}
            </p>
          </li>
        ))}
      </ul>
      <p className="border-mk-text-inv mt-8 max-w-[52ch] border-t-2 pt-5 text-[1.0625rem] leading-[1.6]">
        {text.onestitate.incheiere}
      </p>
    </Banda>
  );
}

export function BandaVerticale({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="verticale"
      supratitlu={text.verticale.supratitlu}
      titlu={text.verticale.titlu}
      lead={text.verticale.lead}
    >
      <Registru>
        {text.verticale.domenii.map((domeniu) => (
          <RandRegistru
            key={domeniu.titlu}
            titlu={domeniu.titlu}
            text={domeniu.text}
            dreapta={
              <p className="font-mk-date text-mk-text-slab mt-3 text-[0.6875rem] tracking-[0.06em] uppercase">
                {domeniu.module.join(" · ")}
              </p>
            }
          />
        ))}
      </Registru>
      <p className="text-mk-text-slab mt-6 max-w-[62ch] text-[0.8125rem] leading-[1.55]">
        {text.verticale.nota}
      </p>
    </Banda>
  );
}

export function BandaComparatie({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="comparatie"
      supratitlu={text.comparatie.supratitlu}
      titlu={text.comparatie.titlu}
      lead={text.comparatie.lead}
    >
      <div className="border-mk-rigla/40 mt-10 border-t">
        <div className="border-mk-rigla/40 hidden border-b py-3 sm:grid sm:grid-cols-2 sm:gap-10">
          <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
            {text.comparatie.capAzi}
          </p>
          <p className="font-mk-date border-mk-rigla/40 text-[0.6875rem] font-medium tracking-[0.14em] uppercase sm:border-l sm:pl-10">
            {text.comparatie.capNoi}
          </p>
        </div>
        {text.comparatie.perechi.map((pereche) => (
          <div
            key={pereche.azi}
            className="border-mk-rigla/40 grid gap-2 border-b py-4 sm:grid-cols-2 sm:gap-10"
          >
            <p className="text-mk-text-slab text-[0.9375rem] leading-[1.55]">{pereche.azi}</p>
            <p className="border-mk-rigla/40 text-[0.9375rem] leading-[1.55] sm:border-l sm:pl-10">
              {pereche.noi}
            </p>
          </div>
        ))}
      </div>
    </Banda>
  );
}
