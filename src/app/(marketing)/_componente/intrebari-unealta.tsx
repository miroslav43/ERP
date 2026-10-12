import type { IntrebareUnealta } from "@/content/landing/intrebari-pontaj";

import { Banda } from "./banda";

/**
 * Lista „întrebare, apoi răspuns” a unei unelte. FĂRĂ marcaj `FAQPage`: vezi
 * `intrebari/page.tsx` — rezultatele îmbogățite s-au retras la 7 mai 2026, iar
 * valoarea rămâne în structură: o întrebare urmată imediat de răspunsul ei.
 *
 * Legăturile sunt `<a>`, nu `Link`: cele mai multe sunt doar parametri pe
 * aceeași pagină („?varianta=individuala#documentul”), adică o nouă randare de
 * server, la fel ca formularul GET.
 */
export function IntrebariUnealta({
  titlu,
  intrebari,
}: Readonly<{ titlu: string; intrebari: readonly IntrebareUnealta[] }>) {
  return (
    <Banda inaltime="medie" supratitlu="Întrebări" titlu={titlu}>
      <div className="border-mk-rigla/40 mt-8 border-t">
        {intrebari.map((r) => (
          <div
            key={r.q}
            className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
          >
            <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
              {r.q}
            </h3>
            <div className="md:col-span-8">
              <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6]">{r.a}</p>
              {r.temei !== undefined && (
                <p className="font-mk-date text-mk-text-slab mt-2 text-[0.75rem] tracking-[0.04em]">
                  {r.temei}
                </p>
              )}
              {r.legatura !== undefined && (
                <a
                  href={r.legatura.href}
                  className="mt-2 inline-block text-[0.9375rem] underline underline-offset-4"
                >
                  {r.legatura.eticheta}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </Banda>
  );
}
