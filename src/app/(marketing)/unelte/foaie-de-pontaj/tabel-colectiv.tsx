import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import type { Pontaj } from "./pontaj";

/** Puncte PDF → pixeli: coloana de zi de 15,2 pt iese de 24 px, la fel ca în PDF, proporțional. */
const PX_PE_PUNCT = 1.6;
/** Indicele primei coloane de zi în `document.coloane` (după „Angajat” și „h/zi”). */
const PRIMA_ZI = 2;

/**
 * Foaia colectivă pe ecran, din ACELAȘI `DocumentTabelar` ca PDF-ul și Word-ul
 * — ce vede omul e ce descarcă.
 *
 * `table-fixed` cu `<col>` de lățime fixă: fără ele, browserul lățea coloanele
 * după conținut, iar zilele 1–9 ieșeau mai înguste decât 10–31 (auditul din
 * 8 oct 2026). `relative` pe containerul derulabil: fără el, `sr-only` din
 * `<caption>` scapă și târăște pagina lateral (capcana documentată).
 */
export function TabelColectiv({
  pontaj,
  document: d,
}: Readonly<{ pontaj: Pontaj; document: DocumentTabelar }>) {
  const latimi = d.coloane.map((c) => Math.round(c.latime * PX_PE_PUNCT));
  const total = latimi.reduce((s, w) => s + w, 0);
  const ziua = (j: number) => (j >= PRIMA_ZI ? pontaj.zile[j - PRIMA_ZI] : undefined);
  const fundal = (j: number) => {
    const z = ziua(j);
    if (z === undefined) return "";
    if (z.sarbatoare !== null) return "bg-mk-sl-hartie";
    return z.inProgram ? "" : "bg-mk-weekend-hartie";
  };

  return (
    <div className="border-mk-rigla relative mt-3 overflow-x-auto border">
      <table
        className="table-fixed border-collapse text-left"
        style={{ width: `${String(total)}px` }}
      >
        <caption className="sr-only">{d.titlu}, necompletată.</caption>
        <colgroup>
          {latimi.map((w, j) => (
            <col key={`${String(j)}-${String(w)}`} style={{ width: `${String(w)}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-mk-rigla border-b">
            {d.coloane.map((c, j) => {
              const z = ziua(j);
              return (
                <th
                  key={`${String(j)}-${c.eticheta}`}
                  scope="col"
                  data-zi={z === undefined ? undefined : String(z.zi)}
                  title={z?.sarbatoare ?? undefined}
                  className={`border-mk-liniatura font-mk-date border-r px-0.5 py-1.5 text-center text-[0.6875rem] leading-tight font-medium whitespace-pre-line ${j === 0 ? "text-left" : ""} ${fundal(j)}`}
                >
                  {c.eticheta}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {d.randuri.map((r, i) => (
            <tr
              key={`${String(i)}-${r[0] ?? ""}`}
              className="border-mk-liniatura border-b last:border-b-0"
            >
              {d.coloane.map((c, j) =>
                j === 0 ? (
                  <th
                    key={`${String(j)}-${c.eticheta}`}
                    scope="row"
                    className="border-mk-liniatura h-8 truncate border-r px-2 text-left text-[0.8125rem] font-normal"
                  >
                    {r[0] ?? ""}
                  </th>
                ) : (
                  <td
                    key={`${String(j)}-${c.eticheta}`}
                    className={`border-mk-liniatura font-mk-date border-r text-center text-[0.6875rem] ${fundal(j)}`}
                  >
                    {r[j] ?? ""}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
