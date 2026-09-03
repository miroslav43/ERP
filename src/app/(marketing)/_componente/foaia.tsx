"use client";

import { useEffect, useState } from "react";

import { COD_ZI, FOAIA, LEGENDA, NORMA_LUNARA, formateazaOre } from "@/content/landing/foaia-date";
import type { ContinutLanding } from "@/content/landing/tipuri";

/**
 * FOAIA CARE SE ÎNCHIDE — elementul-semnătură al paginii.
 *
 * Nu e o captură și nu e o ilustrație: e un document care se verifică. Suma pe
 * cele opt rânduri, suma pe cele treizeci de coloane și totalul general sunt
 * același număr, iar vizitatorul poate face adunarea singur, pe ecran.
 *
 * Trei decizii care nu sunt negociabile:
 *
 * 1. FĂRĂ JS, FOAIA E COMPLETĂ. Toate cele 240 de celule și toate totalurile
 *    vin din server, în HTML brut. JavaScript-ul adaugă doar evidențierea și
 *    posibilitatea de a schimba fereastra; pe ecran îngust, fereastra implicită
 *    o dă CSS-ul, prin media query.
 *
 * 2. NICIO DERULARE ORIZONTALĂ ȘI NICIUN `sticky`. Pe ecran mic documentul se
 *    TAIE, exact cum se taie un formular tipărit, iar sub el rămâne
 *    recapitulația pe săptămâni — care se adună înapoi la totalul lunii. Așa
 *    supraviețuiește reconcilierea și pe telefon.
 *
 * 3. MONUMENTUL NU SE MIȘCĂ. Apeși o zi, apeși un om, se aprinde coloana sau
 *    rândul — cifra mare rămâne aceeași. Ăsta e tot argumentul.
 */
export function Foaia({ text }: { text: ContinutLanding["foaie"] }) {
  const [ziActiva, setZiActiva] = useState<number | null>(null);
  const [randActiv, setRandActiv] = useState<string | null>(null);
  const [fereastra, setFereastra] = useState<string | null>(null);
  const [ferestre, setFerestre] = useState<readonly (typeof FOAIA.jumatati)[number][]>([]);
  const [anunt, setAnunt] = useState("");

  /**
   * Fereastra implicită se alege după lățime, o singură dată la montare și apoi
   * la fiecare schimbare de prag. Până atunci — și pentru cine n-are JS —
   * decide CSS-ul din `globals.css`, iar `data-fereastra` lipsește din DOM,
   * ceea ce lasă regulile lui să se aplice.
   */
  useEffect(() => {
    const lat = window.matchMedia("(min-width: 1280px)");
    const mediu = window.matchMedia("(min-width: 768px)");

    function potriveste() {
      if (lat.matches) {
        setFerestre([]);
        setFereastra(null);
        return;
      }
      const set = mediu.matches ? FOAIA.jumatati : FOAIA.saptamani;
      setFerestre(set);
      setFereastra((curenta) =>
        curenta !== null && set.some((f) => f.cheie === curenta)
          ? curenta
          : (set[0]?.cheie ?? null),
      );
    }

    potriveste();
    lat.addEventListener("change", potriveste);
    mediu.addEventListener("change", potriveste);
    return () => {
      lat.removeEventListener("change", potriveste);
      mediu.removeEventListener("change", potriveste);
    };
  }, []);

  /**
   * Baleierea de completare. Se pornește DUPĂ montare și numai dacă omul n-a
   * cerut mișcare redusă: starea implicită din HTML e deja starea finală, deci
   * nu există moment în care conținutul să lipsească.
   */
  const [baleiaza, setBaleiaza] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => setBaleiaza(true), 120);
    return () => window.clearTimeout(id);
  }, []);

  const activa = ferestre.find((f) => f.cheie === fereastra) ?? null;
  const ascunsa = (zi: number) => activa !== null && (zi < activa.prima || zi > activa.ultima);

  function apasaZiua(zi: number) {
    const nou = ziActiva === zi ? null : zi;
    setZiActiva(nou);
    setRandActiv(null);
    if (nou === null) return setAnunt("");
    const ore = FOAIA.totaluriPeZi[zi - 1] ?? 0;
    const persoane = FOAIA.randuri.filter((r) => (r.celule[zi - 1]?.ore ?? 0) > 0).length;
    setAnunt(
      text.anuntColoana
        .replace("{zi}", String(zi))
        .replace("{ore}", formateazaOre(ore))
        .replace("{persoane}", String(persoane)),
    );
  }

  function apasaRandul(nume: string, ore: number) {
    const nou = randActiv === nume ? null : nume;
    setRandActiv(nou);
    setZiActiva(null);
    setAnunt(
      nou === null
        ? ""
        : text.anuntRand.replace("{nume}", nume).replace("{ore}", formateazaOre(ore)),
    );
  }

  const celulaBaza =
    "border-mk-liniatura border-r px-0.5 py-1.5 text-center align-middle font-mk-date text-[0.8125rem] tabular-nums";

  /*
   * Coloanele SUP și NPT dispar sub 640px, și motivul e aritmetic, nu de gust.
   *
   * Tabelul e `table-fixed w-full`: lățimile fixe se iau întâi, iar zilele împart
   * ce rămâne. Numele ia 104px, iar ORE + SUP + NPT iau 3 × 52 = 156px. Pe un
   * ecran de 390px rămân 98px pentru cele cinci zile ale ferestrei implicite,
   * adică 19,6px de coloană — măsurat exact atât. „8:00” are nevoie de vreo 28px,
   * așa că cifrele se suprapuneau peste liniatură.
   *
   * Se taie SUP și NPT, nu zile: sunt „DIN CARE”, nu „în plus” — orele lucrate le
   * includ deja, iar nota care spune asta rămâne sub tabel. O săptămână întreagă
   * cu ORE spune mai mult decât trei zile cu toate trei totalurile. Fără ele,
   * zilele primesc 202/5 ≈ 40px.
   */
  const doarLat = "hidden sm:table-cell";

  return (
    <figure
      className={`mk-foaie mt-12 ${baleiaza ? "mk-anim" : ""}`}
      data-fereastra={activa?.cheie}
    >
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="font-mk-date text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
          {text.eticheta} · {LUNA_ETICHETA}
        </p>
        <p className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.08em] uppercase">
          {text.subtitlu}
        </p>
      </figcaption>

      {ferestre.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
            {text.ferestreEticheta}
          </span>
          {ferestre.map((f) => (
            <button
              key={f.cheie}
              type="button"
              onClick={() => setFereastra(f.cheie)}
              aria-pressed={f.cheie === fereastra}
              aria-label={f.eticheteLunga}
              className={`font-mk-date min-h-11 rounded border px-3 text-[0.75rem] tracking-[0.06em] transition-colors ${
                f.cheie === fereastra
                  ? "border-mk-text bg-mk-cerneala text-mk-text-inv"
                  : "border-mk-rigla hover:bg-mk-activ-hartie"
              }`}
            >
              {f.eticheta}
            </button>
          ))}
        </div>
      )}

      <div className="border-mk-rigla mt-3 overflow-hidden border">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">{text.descriereTabel}</caption>
          <thead>
            <tr className="border-mk-rigla border-b">
              <th
                scope="col"
                data-col="nume"
                /* Numele se strânge pe mobil: cei 28px eliberați se duc în
                   coloana ORE, care trebuie să încapă „1.198:30” pe rândul de
                   total. „Popa I.” intră lejer în 76px. */
                className="border-mk-liniatura font-mk-date text-mk-text-slab w-[76px] border-r px-2 py-1.5 text-left text-[0.6875rem] font-medium tracking-[0.06em] uppercase sm:w-[104px]"
              >
                {text.capAngajat}
              </th>
              {FOAIA.zile.map((zi) => (
                <th
                  key={zi.zi}
                  scope="col"
                  data-zi={zi.zi}
                  data-j1={zi.zi <= 15 ? "1" : undefined}
                  data-s1={zi.zi <= 5 ? "1" : undefined}
                  hidden={ascunsa(zi.zi)}
                  className={`${celulaBaza} px-0 font-medium ${
                    zi.sarbatoare !== null
                      ? "bg-mk-sl-hartie"
                      : zi.nelucratoare
                        ? "bg-mk-weekend-hartie"
                        : ""
                  }`}
                  data-activ={ziActiva === zi.zi ? "" : undefined}
                >
                  <button
                    type="button"
                    onClick={() => apasaZiua(zi.zi)}
                    title={zi.sarbatoare ?? undefined}
                    className="flex w-full flex-col items-center leading-tight hover:underline focus-visible:-outline-offset-2"
                  >
                    <span>{zi.zi}</span>
                    <span className="text-mk-text-slab text-[0.625rem]" aria-hidden="true">
                      {zi.litera}
                    </span>
                  </button>
                </th>
              ))}
              {[text.capOre, text.capSuplimentare, text.capNoapte].map((cap, i) => (
                <th
                  key={cap}
                  scope="col"
                  data-col={["ore", "sup", "npt"][i]}
                  className={`font-mk-date px-1 py-1.5 text-right text-[0.6875rem] font-medium tracking-[0.06em] uppercase ${
                    i === 0
                      ? // 72px la ORICE lățime, nu doar pe mobil: rândul de total
                        // afișează „1.198:30”, care cere 68px. La 52 se tăia
                        // peste 640px — adică exact acolo unde părea că e loc.
                        "border-mk-rigla w-[72px] border-l"
                      : `w-[52px] ${doarLat}`
                  }`}
                >
                  {cap}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {FOAIA.randuri.map((rand) => {
              const randE = randActiv === rand.nume;
              return (
                <tr key={rand.nume} className="border-mk-liniatura border-b last:border-b-0">
                  <th
                    scope="row"
                    data-col="nume"
                    className="border-mk-liniatura border-r px-2 py-1.5 text-left text-[0.8125rem] font-normal"
                    data-activ={randE ? "" : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => apasaRandul(rand.nume, rand.ore)}
                      className="w-full text-left hover:underline focus-visible:-outline-offset-2"
                    >
                      {rand.nume}
                    </button>
                  </th>
                  {rand.celule.map((celula, index) => {
                    const zi = FOAIA.zile[index];
                    const cod = COD_ZI[celula.tip];
                    const fundal =
                      celula.tip === "sarbatoare"
                        ? "bg-mk-sl-hartie"
                        : celula.tip === "weekend"
                          ? "bg-mk-weekend-hartie"
                          : celula.tip === "concediu" || celula.tip === "delegatie"
                            ? "bg-mk-co-hartie"
                            : celula.tip === "medical"
                              ? "bg-mk-co-hartie"
                              : celula.tip === "absenta_nemotivata"
                                ? "bg-mk-an-hartie"
                                : "";
                    return (
                      <td
                        key={celula.zi}
                        data-zi={celula.zi}
                        data-celula=""
                        data-j1={celula.zi <= 15 ? "1" : undefined}
                        data-s1={celula.zi <= 5 ? "1" : undefined}
                        data-activ={ziActiva === celula.zi || randE ? "" : undefined}
                        hidden={ascunsa(celula.zi)}
                        style={{ ["--mk-coloana" as string]: index }}
                        className={`${celulaBaza} ${fundal}`}
                      >
                        {celula.tip === "weekend" ? (
                          <span className="text-mk-text-slab" aria-hidden="true">
                            —
                          </span>
                        ) : cod === null ? (
                          formateazaOre(celula.ore)
                        ) : celula.tip === "sarbatoare" ? (
                          cod
                        ) : (
                          /*
                           * Ora și codul, în două elemente distincte.
                           *
                           * Erau un singur text cu `&nbsp;` între ele, deci
                           * indivizibil: „0:00 CO” cere 58px, iar la fereastra
                           * lunii întregi coloana are 34. Separate, CSS-ul le
                           * poate așeza unul sub altul acolo unde nu încap
                           * alături — vezi `.mk-cod` în `globals.css`. Spațiul
                           * dintre ele vine tot din CSS, ca să dispară odată cu
                           * așezarea pe un rând.
                           */
                          <span className="mk-ore-cod whitespace-nowrap">
                            <span>{formateazaOre(celula.ore)}</span>
                            <span className="mk-cod">{cod}</span>
                          </span>
                        )}
                        {zi !== undefined && zi.nelucratoare && (
                          <span className="sr-only">{zi.sarbatoare ?? "zi nelucrătoare"}</span>
                        )}
                      </td>
                    );
                  })}
                  <td
                    data-col="ore"
                    className="border-mk-rigla font-mk-date border-l px-1 py-1.5 text-right text-[0.875rem] font-medium tabular-nums"
                    data-activ={randE ? "" : undefined}
                  >
                    {formateazaOre(rand.ore)}
                  </td>
                  <td
                    data-col="sup"
                    className={`font-mk-date text-mk-text-slab px-1 py-1.5 text-right text-[0.8125rem] tabular-nums ${doarLat}`}
                  >
                    {rand.suplimentare === 0 ? "—" : formateazaOre(rand.suplimentare)}
                  </td>
                  <td
                    data-col="npt"
                    className={`font-mk-date text-mk-text-slab px-1 py-1.5 text-right text-[0.8125rem] tabular-nums ${doarLat}`}
                  >
                    {rand.noapte === 0 ? "—" : formateazaOre(rand.noapte)}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Linia de total e cea „ștampilată": singurul obiect de cerneală de
              pe hârtie, exact cum arată o foaie închisă. */}
          <tfoot className="mk-cerneala bg-mk-cerneala text-mk-text-inv">
            <tr>
              <th
                scope="row"
                data-col="nume"
                className="font-mk-date px-2 py-2 text-left text-[0.6875rem] font-medium tracking-[0.14em] uppercase"
              >
                {text.randTotal}
              </th>
              {FOAIA.totaluriPeZi.map((ore, index) => {
                const zi = FOAIA.zile[index];
                if (zi === undefined) return null;
                return (
                  <td
                    key={zi.zi}
                    data-zi={zi.zi}
                    data-j1={zi.zi <= 15 ? "1" : undefined}
                    data-s1={zi.zi <= 5 ? "1" : undefined}
                    hidden={ascunsa(zi.zi)}
                    className={`font-mk-date px-0.5 py-2 text-center text-[0.75rem] font-medium tabular-nums ${
                      ziActiva === zi.zi ? "bg-mk-activ-cerneala" : ""
                    }`}
                  >
                    {ore === 0 ? (
                      <span className="text-mk-text-inv-slab">—</span>
                    ) : (
                      formateazaOre(ore)
                    )}
                  </td>
                );
              })}
              <td
                data-col="ore"
                className="font-mk-date border-mk-rigla-inv border-l px-1 py-2 text-right text-[0.875rem] font-medium tabular-nums"
              >
                {formateazaOre(FOAIA.total)}
              </td>
              <td
                data-col="sup"
                className={`font-mk-date px-1 py-2 text-right text-[0.8125rem] tabular-nums ${doarLat}`}
              >
                {formateazaOre(FOAIA.suplimentare)}
              </td>
              <td
                data-col="npt"
                className={`font-mk-date px-1 py-2 text-right text-[0.8125rem] tabular-nums ${doarLat}`}
              >
                {formateazaOre(FOAIA.noapte)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p aria-live="polite" className="sr-only">
        {anunt}
      </p>

      {/* Recapitulația pe săptămâni. Rămâne în DOM la orice lățime și fără JS:
          e proba că, oricum ai tăia luna, totalul e același. */}
      <p className="font-mk-date text-mk-text-slab mt-4 text-[0.75rem] tabular-nums">
        {FOAIA.saptamani.map((s) => `${s.eticheta} ${formateazaOre(s.total)}`).join("  +  ")}
        {"  =  "}
        <span className="text-mk-text font-medium">{formateazaOre(FOAIA.total)}</span>
      </p>

      <div className="mt-10 grid gap-8 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="font-mk-date text-[clamp(2.75rem,7vw,5rem)] leading-[0.9] tracking-[-0.03em] tabular-nums">
            {formateazaOre(FOAIA.total)}
          </p>
          <p className="font-mk-date text-mk-text-slab mt-2 text-[0.6875rem] tracking-[0.14em] uppercase">
            {text.monumentEticheta}
          </p>
          <p className="mt-4 max-w-[38ch] text-[0.9375rem] leading-[1.55]">{text.monumentNota}</p>
          <p className="text-mk-text-slab mt-2 max-w-[38ch] text-[0.8125rem] leading-[1.5]">
            {text.monumentStatic}
          </p>
        </div>

        <div className="md:col-span-7">
          <p className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
            {text.legendaTitlu}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {LEGENDA.map((element) => (
              <li key={element.cod} className="flex items-center gap-2 text-[0.8125rem]">
                <span
                  aria-hidden="true"
                  className={`inline-block h-3 w-6 border ${
                    element.tip === "sarbatoare"
                      ? "bg-mk-sl-hartie border-mk-sl"
                      : element.tip === "absenta_nemotivata"
                        ? "bg-mk-an-hartie border-mk-an"
                        : "bg-mk-co-hartie border-mk-co"
                  }`}
                />
                <span className="font-mk-date font-medium">{element.cod}</span>
                <span className="text-mk-text-slab">{element.text}</span>
              </li>
            ))}
          </ul>
          <div className="text-mk-text-slab mt-5 space-y-3 text-[0.8125rem] leading-[1.5]">
            <p>{text.notaCodConcediu}</p>
            <p>{text.notaSubset}</p>
            <p>
              <span className="text-mk-text font-medium tabular-nums">
                {FOAIA.zileLucratoare} × 8 = {NORMA_LUNARA}
              </span>{" "}
              — {text.notaNorma}
            </p>
          </div>
        </div>
      </div>
    </figure>
  );
}

const LUNA_ETICHETA = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" })
  .format(new Date(Date.UTC(FOAIA.an, FOAIA.luna - 1, 1)))
  .toUpperCase();
