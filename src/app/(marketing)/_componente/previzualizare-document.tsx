import {
  curataDocument,
  LINIE_GOALA,
  type Coloana,
  type DocumentTabelar,
  type Sectiune,
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
  inaltimeRand,
}: Readonly<{
  legenda: string;
  coloane: readonly Coloana[];
  randuri: readonly (readonly string[])[];
  umbrite: readonly number[];
  /** Puncte tipografice, ca în PDF (fișa SSM: 28); lipsă = înălțimea implicită a rândului. */
  inaltimeRand?: number | undefined;
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
                  style={
                    inaltimeRand === undefined ? undefined : { height: `${String(inaltimeRand)}pt` }
                  }
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
      {(d.sectiuni ?? []).map((s, i) => (
        <SectiuneHtml key={`${String(i)}-${s.tip}`} sectiune={s} />
      ))}
      {d.note.map((n) => (
        <p key={n} className="text-mk-text-slab mt-3 text-[0.8125rem]">
          {n}
        </p>
      ))}
    </figure>
  );
}

/** O secțiune a documentului (fișa SSM), cu aceleași rubrici ca fișierele. */
function SectiuneHtml({ sectiune: s }: Readonly<{ sectiune: Sectiune }>) {
  switch (s.tip) {
    case "text":
      return (
        <div className="mt-5">
          {s.titlu !== null && <h3 className="text-[0.9375rem] font-semibold">{s.titlu}</h3>}
          {s.paragrafe.map((p, i) => (
            <p
              key={`${String(i)}-${p}`}
              className="mt-2 max-w-[68ch] text-[0.875rem] leading-[1.65]"
            >
              {p}
            </p>
          ))}
          {s.semnaturi.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {s.semnaturi.map((e) => (
                <div
                  key={e}
                  className="border-mk-rigla text-mk-text-slab min-h-16 border p-2 text-[0.75rem] sm:flex-1"
                >
                  {e}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    case "tabel":
      if (s.coloane.length === 0) return null;
      return (
        <div className="mt-5">
          <h3 className="text-[0.9375rem] font-semibold">{s.titlu}</h3>
          <Tabel
            legenda={s.titlu}
            coloane={s.coloane}
            randuri={s.randuri}
            umbrite={[]}
            inaltimeRand={s.inaltimeRand}
          />
        </div>
      );
    case "casete":
      return (
        <div className="mt-5">
          <h3 className="text-[0.9375rem] font-semibold">{s.titlu}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: s.numar }, (_, i) => (
              <div key={i} className="border-mk-rigla border p-3 text-[0.8125rem]">
                <p>{s.rubrica}</p>
                <div className="border-mk-rigla/60 mt-5 border-b" />
                <div className="border-mk-rigla/60 mt-5 border-b" />
                <div className="border-mk-rigla/60 mt-5 border-b" />
                <p className="text-mk-text-slab mt-3 flex justify-between gap-4 text-[0.75rem]">
                  {s.semnaturi.map((e) => (
                    <span key={e}>{e}</span>
                  ))}
                </p>
              </div>
            ))}
          </div>
          {s.nota !== null && <p className="text-mk-text-slab mt-2 text-[0.75rem]">{s.nota}</p>}
        </div>
      );
  }
}
