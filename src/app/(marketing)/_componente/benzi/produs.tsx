import Link from "next/link";

import type { ContinutLanding } from "@/content/landing/tipuri";

import { Banda } from "../banda";
import { DiagramaPlatforma } from "../diagrama-platforma";
import { MatriceRoluri } from "../matrice";
import { ModuriPontaj, ViitorPontaj } from "../moduri-pontaj";
import { RandRegistru, Registru } from "../registru";
import { VinietaFluturas } from "../viniete";

/**
 * Benzile care descriu PRODUSUL: cum se leagă modulele, ce module există, ce
 * ecrane mai sunt, cum ajung orele în sistem, cum arată o lună și cine ce vede.
 *
 * ── DE CE SUNT COMPONENTE, NU BLOCURI ÎN ORCHESTRATOR ─────────────────────
 * Toate nouăsprezece benzile stăteau înșirate în `pagina.tsx`, 624 de linii.
 * Consecința nu era estetică: o bandă nu putea fi mutată pe o pagină proprie
 * fără să fie rescrisă, deci tot conținutul era condamnat să rămână pe `/`.
 * Fiecare cluster de căutare — module, roluri, conformitate — trăia ca fragment
 * într-o pagină de 415 KB, unde nu poate ieși pe nimic.
 *
 * Extragerea e VERBATIM: același marcaj, aceleași clase, aceeași ordine. Ce se
 * schimbă e doar cine le poate compune.
 *
 * Fiecare bandă primește întregul `text`, nu felia ei. Sună risipitor, dar
 * jumătate dintre ele au nevoie de mai mult de o felie — `preturi` citește
 * numele modulelor din `module`, `fluxuri` citește `limba` — iar o semnătură
 * uniformă înseamnă că o pagină le poate compune fără să știe de ce are nevoie
 * fiecare.
 */
type ProprietatiBanda = { readonly text: ContinutLanding };

/** Numele afișat al unui nod din diagrama platformei. */
function nume(text: ContinutLanding, cheie: string): string {
  return text.platforma.noduri.find((nod) => nod.cheie === cheie)?.eticheta ?? cheie;
}

export function BandaPlatforma({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="platforma"
      supratitlu={text.platforma.supratitlu}
      titlu={text.platforma.titlu}
      lead={text.platforma.lead}
    >
      <DiagramaPlatforma notaAudit={text.platforma.legaturi[5]?.text ?? text.platforma.nota} />
      <Registru>
        {text.platforma.legaturi.map((legatura) => (
          <RandRegistru
            key={legatura.eticheta}
            cod={legatura.eticheta}
            titlu={`${nume(text, legatura.de)} → ${nume(text, legatura.la)}`}
            text={legatura.text}
          />
        ))}
      </Registru>
      <p className="text-mk-text-slab mt-6 max-w-[62ch] text-[0.8125rem] leading-[1.55]">
        {text.platforma.nota}
      </p>
    </Banda>
  );
}

export function BandaModule({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="module"
      inaltime="inalta"
      supratitlu={text.module.supratitlu}
      titlu={text.module.titlu}
      lead={text.module.lead}
    >
      {text.module.grupuri.map((grup) => (
        <section key={grup.cheie} className="mt-12 first:mt-10">
          <h3 className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
            {grup.titlu}
          </h3>
          <Registru>
            {grup.module.map((modul) => (
              <RandRegistru
                key={modul.cheie}
                cod={modul.cheie}
                titlu={modul.titlu}
                text={modul.text}
                puncte={modul.puncte}
              />
            ))}
          </Registru>
        </section>
      ))}
    </Banda>
  );
}

export function BandaEcrane({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="ecrane"
      inaltime="scurta"
      supratitlu={text.ecrane.supratitlu}
      titlu={text.ecrane.titlu}
      lead={text.ecrane.lead}
    >
      <Registru>
        {text.ecrane.randuri.map((rand) => (
          <RandRegistru key={rand.cod} cod={rand.cod} titlu={rand.titlu} text={rand.text} />
        ))}
      </Registru>
    </Banda>
  );
}

/** Cele patru moduri livrate. Pe hârtie: ce există. */
export function BandaPontajLivrat({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="pontaj"
      inaltime="inalta"
      supratitlu={text.pontaj.supratitlu}
      titlu={text.pontaj.titlu}
      lead={text.pontaj.lead}
    >
      <ModuriPontaj text={text.pontaj} />
      <p className="border-mk-text mt-16 max-w-[52ch] border-t-2 pt-5 text-[1.0625rem] leading-[1.6]">
        {text.pontaj.granita}
      </p>
    </Banda>
  );
}

/**
 * Cele patru moduri de pe foaia de parcurs. Pe cerneală, hașurate: cerneala
 * înseamnă în tot produsul același lucru — ce nu se vede și ce nu există încă.
 */
export function BandaPontajViitor({ text }: ProprietatiBanda) {
  return (
    <Banda fundal="cerneala" inaltime="inalta">
      <ViitorPontaj text={text.pontaj} />
      <Link
        href={text.pontaj.buton.href}
        className="bg-mk-hartie text-mk-cerneala mt-8 inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
      >
        {text.pontaj.buton.eticheta}
      </Link>
    </Banda>
  );
}

export function BandaFluxuri({ text }: ProprietatiBanda) {
  const roman = text.limba === "ro";
  return (
    <Banda
      id="fluxuri"
      supratitlu={text.fluxuri.supratitlu}
      titlu={text.fluxuri.titlu}
      lead={text.fluxuri.lead}
    >
      <div className="mt-12 grid gap-10 lg:grid-cols-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
          {text.fluxuri.fluxuri.map((flux) => (
            <div key={flux.titlu} className="border-mk-rigla/40 border-t pt-5">
              <h3 className="font-mk-display max-w-[22ch] text-[1.125rem] leading-[1.2] font-semibold">
                {flux.titlu}
              </h3>
              <ol className="mt-4 space-y-3">
                {flux.pasi.map((pas) => (
                  <li key={pas.text} className="text-[0.875rem] leading-[1.5]">
                    <span className="font-mk-date text-mk-text-slab block text-[0.6875rem] tracking-[0.06em]">
                      {pas.actor}
                    </span>
                    {pas.text}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <div className="lg:col-span-4">
          <VinietaFluturas
            titlu={roman ? "Fluturaș de salariu" : "Payslip"}
            unitate={roman ? "Lei" : "RON"}
            antetCategorie={roman ? "Categorie" : "Category"}
            etichete={
              roman
                ? { net: "Net de plată", impozit: "Impozit" }
                : { net: "Net pay", impozit: "Income tax" }
            }
            avertisment={
              roman
                ? "Calcul intern, neverificat de un contabil. Cotele sunt cele configurate pentru firma din exemplu."
                : "Internal calculation, not verified by an accountant. The rates are those configured for the sample company."
            }
          />
        </div>
      </div>
    </Banda>
  );
}

/**
 * Hârtie OBLIGATORIU, și motivul nu e estetic: cărămida `--color-mk-refuz`
 * (#A8443A) a semnului „—” trece AA doar pe hârtie (5,10:1). Pe cerneală,
 * singurul text colorat de pe tot situl ar cădea sub prag.
 */
export function BandaRoluri({ text }: ProprietatiBanda) {
  return (
    <Banda
      id="roluri"
      inaltime="inalta"
      supratitlu={text.roluri.supratitlu}
      titlu={text.roluri.titlu}
      lead={text.roluri.lead}
    >
      <MatriceRoluri text={text.roluri} />
    </Banda>
  );
}
