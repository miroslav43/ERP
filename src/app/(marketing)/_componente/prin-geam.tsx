import { capturaModulului, INALTIME_CAPTURA, LATIME_CAPTURA } from "./vitrine";

/**
 * Ecranul real al modulului, arătat ca o captură — și mărit la apăsare.
 *
 * ── DE CE O CAPTURĂ, ȘI NU ECRANUL VIU ────────────────────────────────────
 * A existat aici, o zi, un `<iframe>` către o demonstrație interactivă care
 * randa componentele REALE ale aplicației cu date fabricate. Funcționa, e încă
 * live la `/vitrina/leave`, și rămâne linkul pe care îl poți trimite unui
 * prospect. Dar costul ei per modul — extragerea ecranului, fixture-urile,
 * injecția acțiunilor, poarta de rol — a fost o zi de lucru pentru UN modul.
 * Înmulțit cu nouăsprezece, nu e o livrare, e un proiect.
 *
 * O captură dă aproape tot câștigul vizual la câteva procente din cost, și dă
 * ceva ce demonstrația nu dădea: ACELAȘI tratament pentru toate modulele. Un
 * sit cu trei module demonstrate și șaisprezece sărace se vede mai prost decât
 * unul uniform.
 *
 * ── DE CE NU E `"use client"` ─────────────────────────────────────────────
 * Mărirea se face cu atributul nativ `popover`, nu cu `<dialog>` + JavaScript.
 * Browserul dă gratuit închiderea pe `Escape`, închiderea la clic în afară,
 * `::backdrop` și stiva de deasupra oricărui `z-index`. Precedentul e în casă:
 * notificările (`toast.tsx`) folosesc același API, tocmai fiindcă `<dialog>`
 * modal ocupă top layer-ul și le-ar fi ascuns.
 *
 * Consecința care contează: cele nouăsprezece pagini de modul, prerandate
 * static, rămân FĂRĂ nicio linie de JavaScript propriu. Iar clasa de defect
 * care a rupt build-ul ieri — un export al unui fișier `"use client"` apelat
 * din Server Component — devine imposibilă aici, fiindcă fișierul nu mai e
 * de client.
 *
 * ── CE AM ÎNVĂȚAT DESPRE `<figcaption>` ───────────────────────────────────
 * Nota de dedesubt NU stă în același element cu `overflow-hidden`. Când stătea,
 * raportul de aspect fix împingea textul sub marginea vizibilă și îl tăia:
 * 6,5px, măsurați în Chromium headless pe CSS-ul compilat real. Era chiar
 * avertismentul că datele sunt fictive — un avertisment invizibil nu apără pe
 * nimeni.
 */
export function PrinGeam({ cheie, titlu }: { readonly cheie: string; readonly titlu: string }) {
  const captura = capturaModulului(cheie);
  if (captura === undefined) return null;

  const idMarit = `captura-${cheie}`;
  const descriere = `Ecranul „${titlu}" din Administrativo`;

  return (
    <section className="bg-mk-hartie text-mk-text">
      <div className="max-w-mk mx-auto w-full px-[clamp(1rem,4vw,2.5rem)]">
        <div className="border-mk-rigla border-t py-16 sm:py-24">
          <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
            Ecran real
          </p>

          <figure className="mt-6">
            {/*
              Butonul, nu imaginea, e ținta apăsării: o imagine cu `onclick` nu
              se poate atinge cu tastatura. Așa, `Tab` ajunge la el și `Enter`
              deschide, fără nicio linie de JavaScript.
            */}
            <button
              type="button"
              popoverTarget={idMarit}
              className="border-mk-rigla block w-full cursor-zoom-in border p-2 text-left sm:p-3"
              aria-label={`${descriere} — apasă pentru a mări`}
            >
              {/*
                `width` și `height` sunt OBLIGATORII, chiar dacă CSS-ul le
                rescrie: fără ele, browserul nu știe raportul înainte să sosească
                fișierul, iar imaginea leneșă împinge pagina când aterizează.
                Sunt dimensiunile reale ale fișierului WebP, nu o presupunere.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element --
                  `next/image` ar trece fișierele astea prin optimizatorul lui
                  Next la rulare, deși sunt DEJA WebP la două lățimi, generate
                  o dată din PNG-ul de 2880px. Într-un deployment `standalone`
                  asta e cost de server pentru zero câștig. `srcset`-ul de mai
                  jos face singurul lucru pentru care merita: pe telefon se
                  descarcă varianta de 960px, de 28 KB în loc de 71. */}
              <img
                src={captura.sursa}
                srcSet={captura.srcset}
                sizes="(min-width: 1240px) 1180px, 92vw"
                alt={descriere}
                width={LATIME_CAPTURA}
                height={INALTIME_CAPTURA}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full"
              />
            </button>

            {/* În afara oricărui `overflow-hidden` — vezi antetul fișierului. */}
            <figcaption className="text-mk-text-slab mt-3 text-[0.8125rem] leading-[1.5]">
              Captură din aplicația reală. Firma și oamenii din ea sunt inventați.
              {captura.nota === undefined ? null : ` ${captura.nota}`}
            </figcaption>
          </figure>

          {/*
            Foaia browserului dă unui `popover` `inset: 0`, `margin: auto` și
            `width/height: fit-content` — adică exact centrarea de care avem
            nevoie. Nu o combatem, o folosim; punem doar plafoanele, ca o
            imagine de 1920px să nu depășească fereastra.
          */}
          <div
            id={idMarit}
            popover="auto"
            // `backdrop:`, varianta încorporată — nu forma arbitrară
            // `[&::backdrop]:`. Așa o scrie `dialog.tsx:111` de două ori, în
            // producție; iar culoarea e cerneala SITULUI, nu un negru brut,
            // fiindcă fundalul acoperă o pagină de marketing, nu una de
            // aplicație.
            className="backdrop:bg-mk-cerneala/85 max-h-[92dvh] max-w-[96vw] border-0 bg-transparent p-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element --
                Vezi motivul de mai sus. Aici se cere direct varianta mare:
                mărirea are rost doar dacă se citește ce scrie pe ecran. */}
            <img
              src={captura.sursa}
              alt={descriere}
              width={LATIME_CAPTURA}
              height={INALTIME_CAPTURA}
              className="block h-auto max-h-[92dvh] w-auto max-w-full"
            />
            {/*
              `popovertargetaction="hide"` închide fără JavaScript. E redundant
              cu `Escape` și cu clicul în afară, dar niciuna dintre acelea nu e
              vizibilă: cine deschide cu degetul pe telefon are nevoie de un
              buton pe care să-l vadă.
            */}
            <button
              type="button"
              popoverTarget={idMarit}
              popoverTargetAction="hide"
              className="font-mk-date bg-mk-cerneala text-mk-text-inv absolute top-2 right-2 px-3 py-1.5 text-[0.6875rem] tracking-[0.14em] uppercase"
            >
              Închide
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
