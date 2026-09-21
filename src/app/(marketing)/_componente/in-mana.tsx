import { capturaInalta } from "./vitrine";

/**
 * Banda de capturi înalte — ecranul de telefon și afișul tipărit.
 *
 * ── DE CE NU E `PrinGeam` CU ALT CATALOG ──────────────────────────────────
 * `PrinGeam` arată UNA singură, lată, pe toată coloana, și își scrie singură
 * supratitlul „Ecran real". Aici sunt două-trei imagini înalte care trebuie
 * văzute ÎMPREUNĂ: butonul de pontare, ecranul de după scanare și hârtia de pe
 * perete sunt același flux, iar despărțite pe trei benzi ar cere derulare între
 * pașii aceleiași povești.
 *
 * Mecanica de mărire e aceeași și e copiată intenționat, nu abstractizată:
 * `popover` nativ, buton ca țintă a apăsării, `figcaption` în afara oricărui
 * `overflow-hidden`. Factorizarea ar fi cerut un al treilea fișier care
 * primește totul prin props — mai mult cod decât cele douăzeci de rânduri
 * repetate, și un loc în plus în care se poate strecura `"use client"`.
 *
 * ── DE CE TOT FĂRĂ JAVASCRIPT ─────────────────────────────────────────────
 * `/pontaj-pe-telefon` e prerandată static, ca paginile de modul. Fișierul ăsta
 * n-are `"use client"` și nu trebuie să capete: mărirea vine din atributul
 * `popover`, închiderea pe `Escape` și clicul în afară le dă browserul.
 */
export function InMana({
  supratitlu,
  titlu,
  chei,
  susInPagina = false,
}: {
  readonly supratitlu: string;
  readonly titlu: string;
  readonly chei: readonly string[];
  /**
   * Banda stă destul de sus cât PRIMA imagine să fie elementul LCP al paginii.
   *
   * ── DE CE E UN PARAMETRU, NU O REGULĂ ─────────────────────────────────
   * Depinde de pagină, nu de bandă. Măsurat cu Lighthouse pe 18 sept 2026:
   * pe `/module/portal-angajat` banda vine devreme, imaginea ajunge la 617px
   * de sus și DEVINE elementul LCP; pe `/pontaj-pe-telefon` aceeași bandă vine
   * după cinci pași de text, e sub linia de plutire, iar LCP-ul rămâne un
   * paragraf. O regulă unică ar fi greșit una dintre cele două.
   *
   * Când e `true`, prima imagine se încarcă devreme și cu prioritate. Restul
   * rămân leneșe: ele chiar sunt sub linia de plutire în ambele cazuri.
   *
   * Capcana pe care o repară: o imagine care e ELEMENTUL LCP și are în același
   * timp `loading="lazy"` își întârzie singură descoperirea. Browserul nu știe
   * că e importantă — noi știm.
   */
  readonly susInPagina?: boolean;
}) {
  const capturi = chei.map((cheie) => ({ cheie, captura: capturaInalta(cheie) }));
  // O cheie scrisă greșit ar randa o bandă cu un gol în ea. Mai bine nimic:
  // poarta din `vitrine.test.ts` prinde oricum cheia fără fișier.
  const vizibile = capturi.flatMap(({ cheie, captura }) =>
    captura === undefined ? [] : [{ cheie, captura }],
  );
  if (vizibile.length === 0) return null;

  return (
    <section className="bg-mk-hartie text-mk-text">
      <div className="max-w-mk mx-auto w-full px-[clamp(1rem,4vw,2.5rem)]">
        <div className="border-mk-rigla border-t py-16 sm:py-24">
          <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
            {supratitlu}
          </p>
          {/* `font-mk-display`, ca în `banda.tsx` și `antet-secundar.tsx`.
              Scrisesem `font-mk-titlu`, care NU EXISTĂ: în `globals.css` sunt
              definite doar `--font-mk-display` și `--font-mk-date`. O clasă
              Tailwind inventată nu dă nicio eroare — nici la build, nici la
              lint —, se randează pur și simplu cu fontul implicit. */}
          <h2 className="font-mk-display mt-3 text-[clamp(1.5rem,3.4vw,2.125rem)] leading-[1.15] font-semibold tracking-[-0.01em]">
            {titlu}
          </h2>

          {/*
            `items-start`: afișul e 3:4, telefoanele sunt 1:2,16. Fără el, grila
            ar întinde celulele la aceeași înălțime și ar lăsa hârtia plutind în
            mijlocul unei coloane goale.

            ── DE CE NUMĂRUL DE COLOANE URMEAZĂ NUMĂRUL DE IMAGINI ──────────
            Aici a fost `lg:grid-cols-3` fix, scris pentru banda de pe
            `/pontaj-pe-telefon`, care are trei imagini. Pe `/module/portal-angajat`
            sunt două, iar a treia coloană rămânea goală: măsurat în browser pe
            18 sept 2026, `370,656px × 3` cu doar două celule, adică o treime de
            bandă albă în dreapta și o compoziție trasă spre stânga.

            Clasele se aleg întregi, nu se construiesc din bucăți: Tailwind
            citește sursa ca text, iar un `lg:grid-cols-${n}` n-ar exista în
            foaia generată.
          */}
          <div
            className={`mt-8 grid items-start gap-6 sm:grid-cols-2 ${
              vizibile.length > 2 ? "lg:grid-cols-3" : ""
            }`}
          >
            {vizibile.map(({ cheie, captura }, indice) => {
              const idMarit = `inalta-${cheie}`;
              // Doar PRIMA, și doar când banda stă sus. Vezi `susInPagina`.
              const prioritara = susInPagina && indice === 0;
              return (
                <figure key={cheie}>
                  <button
                    type="button"
                    popoverTarget={idMarit}
                    className="border-mk-rigla block w-full cursor-zoom-in border p-2 text-left"
                    aria-label={`${captura.alt} — apasă pentru a mări`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element --
                        Același motiv ca în `prin-geam.tsx`: fișierele sunt deja
                        WebP la două lățimi, iar optimizatorul lui Next ar fi
                        cost de server pentru zero câștig. */}
                    <img
                      src={captura.sursa}
                      srcSet={captura.srcset}
                      sizes="(min-width: 1024px) 380px, (min-width: 640px) 44vw, 90vw"
                      alt={captura.alt}
                      width={captura.latime}
                      height={captura.inaltime}
                      loading={prioritara ? "eager" : "lazy"}
                      fetchPriority={prioritara ? "high" : "auto"}
                      decoding="async"
                      className="block h-auto w-full"
                    />
                  </button>
                  {/*
                    În afara butonului, deci în afara oricărui `overflow-hidden`
                    — vezi antetul lui `prin-geam.tsx`.

                    Avertismentul că datele sunt fictive se repetă pe FIECARE
                    captură, nu o dată pe bandă: capturile astea au nume de om și
                    sume de salariu pe ele, iar cine se uită la a treia imagine
                    n-are de unde să știe ce scria sub prima.
                  */}
                  <figcaption className="text-mk-text-slab mt-3 text-[0.8125rem] leading-[1.5]">
                    Captură din aplicația reală. Firma și oamenii din ea sunt inventați.
                    {captura.nota === undefined ? null : ` ${captura.nota}`}
                  </figcaption>

                  <div
                    id={idMarit}
                    popover="auto"
                    className="backdrop:bg-mk-cerneala/85 max-h-[92dvh] max-w-[96vw] border-0 bg-transparent p-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- vezi mai sus. */}
                    <img
                      src={captura.sursa}
                      alt={captura.alt}
                      width={captura.latime}
                      height={captura.inaltime}
                      className="block h-auto max-h-[92dvh] w-auto max-w-full"
                    />
                    <button
                      type="button"
                      popoverTarget={idMarit}
                      popoverTargetAction="hide"
                      className="font-mk-date bg-mk-cerneala text-mk-text-inv absolute top-2 right-2 px-3 py-1.5 text-[0.6875rem] tracking-[0.14em] uppercase"
                    >
                      Închide
                    </button>
                  </div>
                </figure>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
