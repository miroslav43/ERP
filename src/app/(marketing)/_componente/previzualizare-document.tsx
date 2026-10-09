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
  inalt = false,
}: Readonly<{
  legenda: string;
  coloane: readonly Coloana[];
  randuri: readonly (readonly string[])[];
  umbrite: readonly number[];
  /** Puncte tipografice, ca în PDF (fișa SSM: 28); lipsă = înălțimea implicită a rândului. */
  inaltimeRand?: number | undefined;
  /** Rândurile înalte ale tabelului principal (scris de mână, semnătură): mai mult loc și pe ecran. */
  inalt?: boolean;
}>) {
  const latimeTotala = coloane.reduce((suma, c) => suma + c.latime, 0) || 1;
  return (
    <div className="border-mk-rigla relative mt-4 overflow-x-auto border">
      {/*
       * Lățimile coloanelor vin din model, ca în PDF (`pdf.ts` le scalează la
       * pagină). Lăsat pe auto-layout, browserul le împărțea după conținut:
       * la lățimea A4 a tipăririi, „Nume și prenume” ajungea la ~73 px, orice
       * nume obișnuit se rupea pe două rânduri și condica unei luni sărea pe a
       * treia pagină (testul `tipar: condica de prezență`, 9 oct 2026).
       * Procente, nu puncte: tabelul rămâne `w-full` pe orice ecran.
       */}
      <table className="w-full table-fixed border-collapse text-left text-[0.8125rem]">
        <caption className="sr-only">{legenda}</caption>
        <colgroup>
          {coloane.map((c, j) => (
            <col
              key={`${String(j)}-${c.eticheta}`}
              style={{ width: `${String((c.latime / latimeTotala) * 100)}%` }}
            />
          ))}
        </colgroup>
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
                  className={`${inalt ? "h-10 py-1" : "h-7"} px-2 ${umbrite.includes(j) ? "bg-mk-rigla/20" : ""}`}
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
  // Rândurile înalte din PDF (scris de mână, semnătură) au și pe ecran mai mult loc.
  const inalt = (d.inaltimeRand ?? 0) > 20;
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
        <Tabel
          legenda={d.titlu}
          coloane={d.coloane}
          randuri={d.randuri}
          umbrite={d.umbrite}
          inalt={inalt}
        />
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
      {(d.rubrici ?? []).map((rubrica) => {
        const paragrafe = rubrica.text.split("\n").filter((p) => p.trim() !== "");
        const goale = paragrafe.length > 0 ? 1 : rubrica.randuriGoale;
        return (
          <div key={rubrica.titlu} className="mt-5" data-rubrica="">
            <p className="text-[0.875rem] font-semibold">{rubrica.titlu}</p>
            {paragrafe.map((p) => (
              <p key={p} className="mt-1 max-w-[68ch] text-[0.875rem] leading-[1.6]">
                {p}
              </p>
            ))}
            {Array.from({ length: goale }, (_, k) => (
              <div key={k} aria-hidden="true" className="border-mk-rigla h-7 border-b" />
            ))}
          </div>
        );
      })}
      {/* Semnăturile din fișier, și pe ecran: auditul din 8 oct 2026 a găsit
          previzualizarea oprită la note, deși PDF-ul și Word-ul le aveau. */}
      {d.semnaturi.length > 0 && (
        <div
          className="mt-8 grid gap-6 text-[0.8125rem] sm:auto-cols-fr sm:grid-flow-col"
          data-semnaturi=""
        >
          {d.semnaturi.map((s) => (
            <div key={s}>
              <div aria-hidden="true" className="border-mk-text-slab h-8 border-b" />
              <p className="text-mk-text-slab mt-1">{s}</p>
              {d.dataLaSemnaturi === true && (
                <p className="text-mk-text-slab mt-1">
                  Data:{" "}
                  <span
                    aria-hidden="true"
                    className="border-mk-text-slab inline-block w-24 border-b"
                  />
                </p>
              )}
            </div>
          ))}
        </div>
      )}
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
                  className="border-mk-rigla text-mk-text-slab min-h-16 break-inside-avoid border p-2 text-[0.75rem] sm:flex-1"
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
              <div
                key={i}
                className="border-mk-rigla break-inside-avoid border p-3 text-[0.8125rem]"
              >
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
