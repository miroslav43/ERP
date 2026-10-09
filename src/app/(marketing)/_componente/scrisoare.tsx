import type { Scrisoare } from "@/lib/unelte/scrisoare";

/**
 * Previzualizarea unei `Scrisoare` — același obiect din care se fac PDF-ul și
 * Word-ul, deci aceleași rânduri, în aceeași ordine, cu aceleași semnături.
 *
 * Până pe 8 oct 2026 cererea de odihnă avea un `<article>` scris de mână, iar
 * variantele treceau prin previzualizarea tabelară, fără nicio linie de
 * semnătură: ce tipărea omul din browser nu avea unde să semneze.
 *
 * `[overflow-wrap:anywhere]`: un nume de 120 de litere fără spațiu ar fi
 * împins pagina lateral la 360 px. Clasele `print:` scot rama și umplutura —
 * pe hârtie, foaia e chiar documentul.
 */
export function ScrisoarePrevizualizata({ scrisoare: s }: { scrisoare: Scrisoare }) {
  return (
    <article
      aria-label={s.titluDocument}
      className="border-mk-rigla mx-auto max-w-[46rem] border p-6 text-[0.9375rem] leading-[1.75] [overflow-wrap:anywhere] sm:p-12 print:max-w-none print:border-0 print:p-0 print:text-[11pt]"
    >
      <p className="text-[0.875rem]">{s.inregistrare}</p>
      <p className="mt-2 text-right">{s.catre}</p>
      <h2 className="font-mk-display mt-10 text-center text-[1.5rem] font-semibold tracking-[0.02em]">
        {s.titlu}
      </h2>
      {s.subtitlu !== null && <p className="text-center">{s.subtitlu}</p>}
      <div className="mt-8 space-y-4">
        {s.paragrafe.map((p, i) => (
          <p key={`${String(i)}-${p.slice(0, 24)}`} className="indent-8 sm:text-justify">
            {p}
          </p>
        ))}
      </div>
      <div className="mt-12 flex flex-wrap items-start justify-between gap-6">
        <p>{s.locSiData}</p>
        <div className="ml-auto min-w-[12rem] text-center">
          <p>{s.semnatura}</p>
          <span aria-hidden="true" className="border-mk-text/50 mt-10 block border-b" />
        </div>
      </div>
      {s.rubrica !== null && (
        <section
          aria-label={s.rubrica.titlu}
          className="border-mk-rigla mt-12 border-t pt-6 text-[0.875rem]"
        >
          <p className="font-semibold">{s.rubrica.titlu}</p>
          <ul className="mt-2 space-y-1">
            {s.rubrica.randuri.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {s.rubrica.semnaturi.map((eticheta) => (
              <div key={eticheta}>
                <span aria-hidden="true" className="border-mk-text/50 block border-b" />
                <p className="text-mk-text-slab mt-1 text-[0.8125rem]">{eticheta}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {s.note.map((n) => (
        <p key={n} className="text-mk-text-slab mt-6 text-[0.75rem] leading-[1.5]">
          {n}
        </p>
      ))}
    </article>
  );
}
