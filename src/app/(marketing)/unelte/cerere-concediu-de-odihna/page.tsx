// src/app/(marketing)/unelte/cerere-concediu-de-odihna/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { adresaInregistrare } from "@/content/landing/cta-unelte";
import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { metaUnealta } from "@/content/landing/seo-unelte";
import { ANTET_CERERE_CONCEDIU } from "@/content/landing/unelte";
import { pasteGregorian } from "@/domain/calendar/paste-gregorian";
import { pasteOrtodox } from "@/domain/calendar/paste-ortodox";
import { formatDate } from "@/lib/format/date";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { ContinuaInAplicatie, aGenerat } from "../../_componente/continua-in-aplicatie";
import { Descarcari } from "../../_componente/descarcari";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { ScrisoarePrevizualizata } from "../../_componente/scrisoare";
import { AN_MAX, AN_MIN } from "./cerere";
import { adresaVariantei, citesteCererea, PAGINA_CERERE, scrisoareaCererii } from "./cerere-model";
import { sarbatoriText, weekendText, zileLucratoareText, zileText } from "./text-zile";
import { EVENIMENTE, EVENIMENTE_ORDINE, TIPURI_CERERE, VARIANTE } from "./variante";

/**
 * Cererea de concediu, gratuită, fără cont — opt variante, un singur model.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * „Model cerere concediu de odihnă" e o căutare cu intenție limpede și cu o
 * concurență formată aproape numai din fișiere Word de pe bloguri. Toate au
 * același gol: un spațiu în care omul scrie singur numărul de zile. Numărul ăla
 * e greșit des, fiindcă art. 145 alin. (3) din Codul muncii scoate sărbătorile
 * legale din durata concediului, iar cine numără pe calendar le numără.
 *
 * ── CE S-A SCHIMBAT PE 8 OCT 2026 ─────────────────────────────────────────
 * Auditul live a găsit pagina bună ca numărător și săracă ca formular de HR:
 * fără anul concediului, fără departament, fără număr de înregistrare, fără
 * „Se aprobă / Nu se aprobă”, cu variantele fără loc de semnătură pe ecran și
 * cu PDF-ul arătând altfel decât previzualizarea. Acum pagina, PDF-ul și
 * Word-ul citesc aceeași `Scrisoare` (`cerere-model.ts`), iar variantele sunt
 * opt, fiecare cu temeiul ei.
 *
 * ── DE CE FORMULAR GET, FĂRĂ JAVASCRIPT ───────────────────────────────────
 * Parametrii stau în adresă: cererea se poate trimite pe e-mail gata
 * completată, merge cu JavaScript oprit și se tipărește din browser. Varianta
 * se alege din bara de sus (legături), nu dintr-un `<select>`: fără JavaScript,
 * un `<select>` n-ar putea arăta câmpurile variantei alese până la trimitere.
 *
 * ── CE NU FACE ────────────────────────────────────────────────────────────
 * Nu scade zilele libere plătite stabilite prin contractul colectiv sau prin
 * regulamentul intern, deși art. 145 alin. (3) le exclude și pe acelea. Nu le
 * putem cunoaște — sunt ale fiecărei firme. Pagina o spune.
 */
export function generateMetadata(): Metadata {
  return metadatePagina(metaUnealta("/unelte/cerere-concediu-de-odihna"));
}

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

function Camp({
  eticheta,
  ajutor,
  children,
}: Readonly<{ eticheta: string; ajutor?: string; children: ReactNode }>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.875rem] font-medium">{eticheta}</span>
      {children}
      {ajutor !== undefined && (
        <span className="text-mk-text-slab text-[0.8125rem] leading-[1.5]">{ajutor}</span>
      )}
    </label>
  );
}

function CampText({
  nume,
  eticheta,
  valoare,
  maxim,
  exemplu,
}: Readonly<{ nume: string; eticheta: string; valoare: string; maxim: number; exemplu: string }>) {
  return (
    <Camp eticheta={eticheta}>
      <input
        type="text"
        name={nume}
        defaultValue={valoare}
        maxLength={maxim}
        placeholder={exemplu}
        className={CLASA_CAMP}
      />
    </Camp>
  );
}

function CampData({
  nume,
  eticheta,
  valoare,
}: Readonly<{ nume: string; eticheta: string; valoare: string }>) {
  return (
    <Camp eticheta={eticheta}>
      <input
        type="date"
        name={nume}
        defaultValue={valoare}
        min={`${String(AN_MIN)}-01-01`}
        max={`${String(AN_MAX)}-12-31`}
        className={CLASA_CAMP}
      />
    </Camp>
  );
}

export default async function PaginaCerereConcediu({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(p)) {
    const v = Array.isArray(valoare) ? valoare[0] : valoare;
    if (v !== undefined) q.set(cheie, v);
  }

  const citita = citesteCererea(q);
  const o = citita.optiuni;
  const v = VARIANTE[o.tip];
  const scrisoare = citita.probleme.length === 0 ? scrisoareaCererii(citita) : null;
  const [prima] = o.perioade;
  // Valoarea din adresă, așa cum a scris-o omul; altfel cea citită de model.
  const valoare = (cheie: string, implicit: string) => q.get(cheie) ?? implicit;

  const anInceput = Number(prima.deLa.slice(0, 4));
  const pasteIulian = pasteOrtodox(anInceput).toISOString().slice(0, 10);
  const pasteGregorianIso = pasteGregorian(anInceput).toISOString().slice(0, 10);
  const total = citita.calcule.reduce((s, c) => s + c.zileLucratoare, 0);
  const weekend = citita.calcule.reduce((s, c) => s + c.zileWeekend, 0);
  const sarbatori = citita.calcule.reduce((s, c) => s + c.excluse.length, 0);
  const calendaristice = citita.calcule.reduce((s, c) => s + c.zileCalendaristice, 0);
  const cuFractiuni = valoare("de_la_2", "") !== "" || valoare("de_la_3", "") !== "";
  const zileBugetar = EVENIMENTE[o.eveniment].zileBugetar;

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: PAGINA_CERERE,
          nume: ANTET_CERERE_CONCEDIU.titlu,
          descriere: ANTET_CERERE_CONCEDIU.lead,
        })}
      />
      {/* `data-tipar="ascunde"` e convenția proiectului: la tipărire rămâne doar
          cererea, fără antet, formular și subsol. */}
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_CERERE_CONCEDIU}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Cerere de concediu", href: PAGINA_CERERE },
          ]}
        />
      </div>

      {/* Toată banda formularului rămâne pe ecran: altfel umplutura și rigla ei
          se tipăreau goale deasupra documentului (secțiunea B, 8 oct 2026). */}
      <Banda inaltime="scurta" data-tipar="ascunde">
        <div data-tipar="ascunde">
          <nav aria-label="Tipul cererii" className="flex flex-wrap gap-2">
            {TIPURI_CERERE.map((t) => (
              <a
                key={t}
                href={adresaVariantei(q, t)}
                aria-current={t === o.tip ? "page" : undefined}
                className={`rounded border px-3 py-1.5 text-[0.875rem] ${
                  t === o.tip
                    ? "bg-mk-cerneala text-mk-text-inv border-mk-cerneala"
                    : "border-mk-rigla hover:border-mk-text"
                }`}
              >
                {VARIANTE[t].eticheta}
              </a>
            ))}
          </nav>

          <form action="#documentul" method="get" className="mt-6 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="tip" value={o.tip} />
            <CampText
              nume="angajator"
              eticheta="Angajatorul"
              valoare={o.angajator}
              maxim={120}
              exemplu="Firma Exemplu SRL"
            />
            <CampText
              nume="departament"
              eticheta="Departamentul (opțional)"
              valoare={o.departament}
              maxim={80}
              exemplu="Contabilitate"
            />
            <CampText
              nume="salariat"
              eticheta="Numele salariatului"
              valoare={o.salariat}
              maxim={120}
              exemplu="Popescu Ion"
            />
            <CampText
              nume="functie"
              eticheta="Funcția"
              valoare={o.functie}
              maxim={80}
              exemplu="operator"
            />
            <CampText
              nume="localitate"
              eticheta="Localitatea"
              valoare={o.localitate}
              maxim={60}
              exemplu="Timișoara"
            />
            <CampData
              nume="data"
              eticheta="Data cererii"
              valoare={valoare("data", o.dataCererii)}
            />

            {(o.tip === "odihna" || o.tip === "reprogramare") && (
              <Camp eticheta="Concediul aferent anului">
                <select name="an" defaultValue={String(o.anAferent)} className={CLASA_CAMP}>
                  {[anInceput, anInceput - 1, anInceput - 2].map((a) => (
                    <option key={a} value={String(a)}>
                      {a}
                    </option>
                  ))}
                </select>
              </Camp>
            )}

            {(o.tip === "reprogramare" || o.tip === "intrerupere") && (
              <>
                <CampData
                  nume="prog_de_la"
                  eticheta="Concediul programat: de la"
                  valoare={valoare("prog_de_la", "")}
                />
                <CampData
                  nume="prog_pana_la"
                  eticheta="Concediul programat: până la, inclusiv"
                  valoare={valoare("prog_pana_la", "")}
                />
              </>
            )}

            {o.tip === "intrerupere" ? (
              <CampData
                nume="de_la"
                eticheta="Întrerup concediul începând cu"
                valoare={valoare("de_la", prima.deLa)}
              />
            ) : (
              <>
                <CampData
                  nume="de_la"
                  eticheta={o.tip === "reprogramare" ? "Perioada nouă: de la" : "De la"}
                  valoare={valoare("de_la", prima.deLa)}
                />
                <CampData
                  nume="pana_la"
                  eticheta={
                    o.tip === "reprogramare"
                      ? "Perioada nouă: până la, inclusiv"
                      : "Până la, inclusiv"
                  }
                  valoare={valoare("pana_la", prima.panaLa)}
                />
              </>
            )}

            {o.tip === "odihna" && (
              <details className="col-span-full" open={cuFractiuni}>
                <summary className="cursor-pointer text-[0.9375rem] underline underline-offset-4">
                  Concediu împărțit în fracțiuni
                </summary>
                <p className="text-mk-text-slab mt-2 text-[0.875rem] leading-[1.6]">
                  Până la trei perioade în aceeași cerere. Când concediul se împarte, cel puțin o
                  fracțiune din an trebuie să aibă 10 zile lucrătoare neîntrerupte — art. 148 alin.
                  (5) din Codul muncii.
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {[2, 3].map((k) => (
                    <Fragment key={k}>
                      <CampData
                        nume={`de_la_${String(k)}`}
                        eticheta={`Fracțiunea ${String(k)}: de la`}
                        valoare={valoare(`de_la_${String(k)}`, "")}
                      />
                      <CampData
                        nume={`pana_la_${String(k)}`}
                        eticheta={`Fracțiunea ${String(k)}: până la`}
                        valoare={valoare(`pana_la_${String(k)}`, "")}
                      />
                    </Fragment>
                  ))}
                </div>
              </details>
            )}

            {o.tip === "eveniment" && (
              <>
                <Camp
                  eticheta="Evenimentul"
                  ajutor={
                    zileBugetar === null
                      ? "Numărul de zile îl dau contractul colectiv sau regulamentul intern."
                      : `La bugetari: ${zileText(zileBugetar)} (HG 250/1992, art. 24). Într-o firmă privată, numărul îl dau contractul colectiv sau regulamentul intern.`
                  }
                >
                  <select name="eveniment" defaultValue={o.eveniment} className={CLASA_CAMP}>
                    {EVENIMENTE_ORDINE.map((e) => (
                      <option key={e} value={e}>
                        {EVENIMENTE[e].eticheta}
                      </option>
                    ))}
                  </select>
                </Camp>
                <Camp eticheta="Zile libere din contract sau regulament (opțional)">
                  <input
                    type="number"
                    name="zile_ccm"
                    min={1}
                    max={30}
                    defaultValue={valoare("zile_ccm", "")}
                    className={CLASA_CAMP}
                  />
                </Camp>
              </>
            )}

            {o.tip === "paternal" && (
              <>
                <CampData
                  nume="nastere"
                  eticheta="Data nașterii copilului"
                  valoare={valoare("nastere", "")}
                />
                <label className="flex items-center gap-2 self-end text-[0.9375rem]">
                  <input
                    type="checkbox"
                    name="puericultura"
                    value="da"
                    defaultChecked={o.puericultura}
                  />
                  Am atestatul de absolvire a cursului de puericultură (+5 zile)
                </label>
              </>
            )}

            {o.tip === "ingrijitor" && (
              <CampText
                nume="persoana"
                eticheta="Cui îi acordați îngrijire"
                valoare={o.persoana}
                maxim={120}
                exemplu="mamei mele, Popescu Maria"
              />
            )}

            {o.tip === "formare" && (
              <>
                <Camp eticheta="Concediul">
                  <select
                    name="plata"
                    defaultValue={o.cuPlata ? "da" : "nu"}
                    className={CLASA_CAMP}
                  >
                    <option value="nu">Fără plată, la inițiativa mea (art. 155–156)</option>
                    <option value="da">Plătit, formare neasigurată de angajator (art. 157)</option>
                  </select>
                </Camp>
                <CampText
                  nume="domeniu"
                  eticheta="Domeniul formării"
                  valoare={o.domeniu}
                  maxim={80}
                  exemplu="contabilitate"
                />
                <CampText
                  nume="institutie"
                  eticheta="Instituția de formare"
                  valoare={o.institutie}
                  maxim={120}
                  exemplu="Universitatea de Vest din Timișoara"
                />
              </>
            )}

            {(o.tip === "fara-plata" ||
              o.tip === "eveniment" ||
              o.tip === "reprogramare" ||
              o.tip === "intrerupere") && (
              <CampText
                nume="motiv"
                eticheta={
                  o.tip === "fara-plata"
                    ? "Motivul (opțional)"
                    : o.tip === "eveniment"
                      ? "Detalii despre eveniment (opțional)"
                      : "Motivele obiective"
                }
                valoare={o.motiv}
                maxim={160}
                exemplu={o.tip === "eveniment" ? "decesul tatălui meu" : "internare în spital"}
              />
            )}

            <Camp
              eticheta="Paștele și Rusaliile, după calendarul"
              ajutor="Art. 139 alin. (2¹): salariații unui cult creștin primesc Vinerea Mare, Paștele și Rusaliile la data cultului lor. Romano-catolicii și reformații le serbează după calendarul gregorian."
            >
              <select name="cult" defaultValue={o.calendar} className={CLASA_CAMP}>
                <option value="ortodox">{`iulian, ortodox (Paștele pe ${formatDate(pasteIulian)})`}</option>
                <option value="gregorian">{`gregorian (Paștele pe ${formatDate(pasteGregorianIso)})`}</option>
              </select>
            </Camp>

            <div className="flex items-end">
              <button
                type="submit"
                className="bg-mk-cerneala text-mk-text-inv font-mk-date w-full px-4 py-2.5 text-[0.8125rem] tracking-[0.08em] uppercase"
              >
                Recalculează
              </button>
            </div>
            <Descarcari
              actiune="/api/unelte/cerere-concediu"
              eveniment="cerere"
              formate={["docx", "pdf"]}
            />
          </form>
        </div>
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        {scrisoare === null ? (
          <div role="alert" className="border-mk-rigla text-mk-text border p-4 text-[0.9375rem]">
            <p className="font-medium">Cererea nu se poate face așa:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {citita.probleme.map((problema) => (
                <li key={problema}>{problema}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <ScrisoarePrevizualizata scrisoare={scrisoare} />
            <div className="mt-6 max-w-[46rem] space-y-3" data-tipar="ascunde">
              {v.numaraZile && (
                <p className="text-mk-text-slab text-[0.875rem] leading-[1.6]">
                  Pe calendar: {zileText(calendaristice)}. Nu se numără {weekendText(weekend)} și{" "}
                  {sarbatoriText(sarbatori)}.{" "}
                  <strong className="text-mk-text">Rămân {zileLucratoareText(total)}.</strong>
                </p>
              )}
              {citita.avertismente.length > 0 && (
                <ul className="border-mk-rigla space-y-2 border-l-2 pl-4 text-[0.875rem] leading-[1.6]">
                  {citita.avertismente.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
              <p className="text-mk-text-slab text-[0.875rem] leading-[1.6]">
                Tipăriți pagina din browser — rămâne doar cererea, fără formular și fără meniuri.
                Sau descărcați-o în Word, ca s-o mai modificați înainte de semnare.
              </p>
            </div>
          </>
        )}
      </Banda>

      <ContinuaInAplicatie unealta="cerere-concediu-de-odihna" generat={aGenerat(p)} />

      {/* `Banda` nu primește atribute libere, deci marcajul de tipărire stă pe
          învelișul ei — la fel ca la antet, mai sus. */}
      <div data-tipar="ascunde">
        <Banda
          inaltime="medie"
          supratitlu="Ce spune legea"
          titlu="Cinci reguli care schimbă cererea"
          lead="Codul muncii nu impune un model de cerere. Impune însă lucruri care se văd în ea: numărul de zile, momentul depunerii, fracționarea, plata și zilele cultului."
        >
          <div className="border-mk-rigla/40 mt-8 border-t">
            {[
              {
                titlu: "Sărbătorile legale nu intră în concediu",
                text: "Art. 145 alin. (3) scoate din durata concediului de odihnă atât sărbătorile legale în care nu se lucrează, cât și zilele libere plătite stabilite prin contractul colectiv aplicabil. Pe primele le calculează unealta asta; pe celelalte nu le putem ști, fiindcă sunt ale fiecărei firme — dacă firma ta are așa ceva, scade-le tu din numărul de mai sus.",
              },
              {
                titlu: "Cererea se depune cu 60 de zile înainte",
                text: "Art. 148 alin. (4): în cadrul perioadelor stabilite prin programarea colectivă sau individuală, salariatul poate solicita efectuarea concediului cu cel puțin 60 de zile anterioare efectuării acestuia. Termenul presupune că există o programare — ea se face, potrivit alin. (1), până la sfârșitul anului calendaristic, pentru anul următor.",
              },
              {
                titlu: "Fracțiunile: una de cel puțin 10 zile",
                text: "Art. 148 alin. (5): când concediul se programează fracționat, angajatorul trebuie să-l stabilească astfel încât fiecare salariat să efectueze într-un an cel puțin 10 zile lucrătoare de concediu neîntrerupt. Unealta avertizează când nicio fracțiune din cerere nu le are.",
              },
              {
                titlu: "Alt cult creștin: Paștele cultului",
                text: "Art. 139 alin. (2¹): pentru salariații unui cult creștin, Vinerea Mare, Paștele și Rusaliile se dau la data la care le celebrează cultul. Alegeți calendarul în formular: unealta scade datele cultului, iar cele ortodoxe devin zile lucrătoare pentru dumneavoastră. Cine primește liber la ambele recuperează zilele în plus — alin. (3¹).",
              },
              {
                titlu: "Banii vin înainte de plecare, nu după",
                text: "Art. 150 alin. (3) cere ca indemnizația de concediu să fie plătită cu cel puțin 5 zile lucrătoare înainte de plecare, iar obligația e a angajatorului, fără condiție de cerere din partea salariatului. În practică e ratată aproape peste tot, fiindcă plata se face din același stat de salarii ca restul lunii.",
              },
            ].map((r) => (
              <div
                key={r.titlu}
                className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
              >
                <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
                  {r.titlu}
                </h3>
                <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6] md:col-span-8">
                  {r.text}
                </p>
              </div>
            ))}
          </div>
        </Banda>

        {/* Celelalte șapte variante, cu temeiul fiecăreia. `id` rămâne cel de
            dinainte de 8 oct 2026, ca legăturile vechi spre secțiune să meargă. */}
        <Banda
          id="alte-cereri"
          inaltime="medie"
          supratitlu="Aceeași unealtă"
          titlu="Fără plată, paternal, îngrijitor, eveniment, formare, reprogramare"
        >
          <div className="border-mk-rigla/40 mt-8 border-t">
            {TIPURI_CERERE.filter((t) => t !== "odihna").map((t) => (
              <div
                key={t}
                className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
              >
                <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
                  {VARIANTE[t].titlu}
                </h3>
                <div className="md:col-span-8">
                  <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6]">
                    {VARIANTE[t].temei}
                  </p>
                  <a
                    href={adresaVariantei(new URLSearchParams(), t)}
                    className="mt-2 inline-block text-[0.9375rem] underline underline-offset-4"
                  >
                    {`Fă o ${VARIANTE[t].titlu.charAt(0).toLowerCase()}${VARIANTE[t].titlu.slice(1)}`}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Banda>

        <Banda
          inaltime="medie"
          supratitlu="Fără hârtie"
          titlu="Cererea, aprobarea și soldul, în aplicație"
          lead="În Administrativo, omul cere concediul de pe telefon, șeful îl aprobă dintr-o apăsare, iar zilele se scad singure din sold, fără sărbători și fără weekenduri."
        >
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={adresaInregistrare("cerere-concediu-de-odihna", "banda")}
              data-umami-event="cta-cerere-concediu"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              {RO.hero.ctaPrimar.eticheta}
            </Link>
            <Link
              href="/vitrina/leave"
              data-umami-event="vitrina-din-cerere"
              className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
            >
              Încearcă ecranul de concedii, fără cont
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            <Link
              href="/unelte/calculator-zile-concediu"
              className="text-[0.9375rem] underline underline-offset-4"
            >
              Câte zile de concediu ți se cuvin pe an
            </Link>
            <Link href="/module/concedii" className="text-[0.9375rem] underline underline-offset-4">
              Cum funcționează modulul Concedii
            </Link>
          </div>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/cerere-concediu-de-odihna"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
