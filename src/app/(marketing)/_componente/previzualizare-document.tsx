import {
  curataDocument,
  LINIE_GOALA,
  type Coloana,
  type DocumentTabelar,
} from "@/lib/unelte/document-tabelar";

/**
 * Un tabel derulabil pe orizontală, cu legenda pentru cititorul de ecran. Același
 * marcaj pentru tabelul principal și pentru cele suplimentare (8 oct 2026).
 */
function Tabel({
  legenda,
  coloane,
  randuri,
  umbrite,
}: Readonly<{
  legenda: string;
  coloane: readonly Coloana[];
  randuri: readonly (readonly string[])[];
  umbrite: readonly number[];
}>) {
  return (
    <div className="border-mk-rigla relative mt-4 overflow-x-auto border">
      <table className="w-full border-collapse text-left text-[0.8125rem]">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr className="border-mk-rigla border-b">
            {coloane.map((c, j) => (
              <th
                key={`${String(j)}-${c.eticheta}`}
                scope="col"
                className="px-2 py-1.5 font-medium whitespace-pre-line"
              >
                {c.eticheta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {randuri.map((r, i) => (
            <tr key={`${String(i)}-${r.join("|")}`} className="border-mk-rigla/40 border-b">
              {coloane.map((c, j) => (
                <td
                  key={`${String(j)}-${c.eticheta}`}
                  className={`h-7 px-2 ${umbrite.includes(j) ? "bg-mk-rigla/20" : ""}`}
                >
                  {r[j] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Previzualizarea HTML a unui `DocumentTabelar`, din același obiect ca fișierele
 * descărcate — ce vede omul pe ecran e ce primește în PDF, Word sau Excel.
 *
 * `relative` pe containerul derulabil: fără el, `sr-only` din `<caption>` scapă
 * și târăște pagina lateral (capcana documentată pe `/module/[modul]`).
 */
export function PrevizualizareDocument({ document: brut }: { document: DocumentTabelar }) {
  // Același text ca în fișiere: un U+000B lipit din Word se vede pe ecran ca
  // spațiu, la fel ca în PDF și în Word (vezi `curataText`).
  const d = curataDocument(brut);
  // Documentele late (foaia de parcurs, fișa SSM) se tipăresc pe A4 culcat,
  // ca PDF-ul lor: vezi `@page peisaj` din globals.css.
  return (
    <figure
      className="mk-foaie"
      data-tipar-pagina={d.orientare === "peisaj" ? "peisaj" : undefined}
    >
      <figcaption>
        <p className="font-mk-display text-[1.0625rem] font-semibold">{d.titlu}</p>
        {d.subtitlu !== null && <p className="text-mk-text-slab text-[0.875rem]">{d.subtitlu}</p>}
      </figcaption>
      {d.campuri.length > 0 && (
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-[0.875rem] sm:grid-cols-2">
          {d.campuri.map((c) => (
            <div key={c.eticheta} className="flex gap-2">
              <dt className="text-mk-text-slab">{c.eticheta}:</dt>
              <dd>{c.valoare === "" ? LINIE_GOALA : c.valoare}</dd>
            </div>
          ))}
        </dl>
      )}
      {d.paragrafe.map((p) => (
        <p key={p} className="mt-3 max-w-[68ch] text-[0.9375rem] leading-[1.65]">
          {p}
        </p>
      ))}
      {d.coloane.length > 0 && (
        <Tabel legenda={d.titlu} coloane={d.coloane} randuri={d.randuri} umbrite={d.umbrite} />
      )}
      {(d.tabeleSuplimentare ?? [])
        .filter((t) => t.coloane.length > 0)
        .map((t) => (
          <div key={t.titlu} className="mt-6">
            <p className="text-[0.9375rem] font-semibold">{t.titlu}</p>
            <Tabel legenda={t.titlu} coloane={t.coloane} randuri={t.randuri} umbrite={[]} />
          </div>
        ))}
      {d.note.map((n) => (
        <p key={n} className="text-mk-text-slab mt-3 text-[0.8125rem]">
          {n}
        </p>
      ))}
    </figure>
  );
}
