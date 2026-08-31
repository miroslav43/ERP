// src/app/(app)/pontaj/calendar-luna.tsx
import { construiesteSaptamani, ziIso } from "@/domain/calendar/grila-lunara";
import { formatOre } from "@/lib/format/ore";

import { CLASE_TIP_ZI, CODURI_TIP_ZI, ETICHETE_TIP_ZI } from "./etichete";
import type { IntrareZiClient } from "./intrare-client";

/**
 * Luna întregii firme, în formă de calendar.
 *
 * ── DE CE PE LÂNGĂ FOAIA COLECTIVĂ, NU ÎN LOCUL EI ────────────────────────
 * Foaia e o matrice: caută bine pe ORIZONTALĂ („cum a arătat luna lui Popescu”).
 * Calendarul caută bine pe VERTICALĂ („cine a lucrat marți”) și arată forma
 * săptămânii — weekendurile aliniate în aceeași coloană, sărbătorile la locul
 * lor. Sunt două întrebări diferite pe exact aceleași date, de aceea nu există
 * nicio citire în plus pentru ecranul ăsta: `page.tsx` transpune rândurile pe
 * care le-a adus oricum pentru foaie.
 *
 * ── SERVER, ZERO JAVASCRIPT ───────────────────────────────────────────────
 * Nicio stare, niciun `onClick`, ca la `(portal)/…/grila-luna.tsx`. Editarea se
 * face în „Săptămână” (pontajul propriu) și în „Listă” (foaia colectivă, unde
 * click pe celulă deschide dialogul, ca înainte). Nu e o scăpare, e prețul
 * pentru care ecranul ăsta nu livrează niciun octet de JS.
 *
 * ── ARITMETICA VINE DIN `domain`, NU DIN COPII LOCALE ──────────────────────
 * `construiesteSaptamani`/`ziIso` sunt cele testate din
 * `domain/calendar/grila-lunara.ts`. `(app)/concedii/calendar/grila-calendar.tsx`
 * are azi copii private ale acelorași funcții, netestate, iar comentariul din
 * `grila-lunara.ts` le numește „primul candidat la înlocuire”. Nu le atingem
 * aici, dar nici nu facem a treia copie.
 */

const ZILE_SAPTAMANA = [
  "Luni",
  "Marți",
  "Miercuri",
  "Joi",
  "Vineri",
  "Sâmbătă",
  "Duminică",
] as const;

/**
 * Câți oameni încap într-o căsuță înainte de „+N alții”.
 *
 * Trei, ca la calendarul de concedii. Cifra nu e estetică: o căsuță de calendar
 * are înălțime fixă, iar al patrulea rând ori o întinde (și atunci luna nu mai
 * încape pe ecran), ori iese din ea tăcut.
 */
const MAXIM_PE_ZI = 3;

export interface OmZi {
  readonly eticheta: string;
  readonly intrare: IntrareZiClient;
}

interface Proprietati {
  readonly an: number;
  readonly luna: number;
  /** Cheia e ziua ISO — serializabil, și aceeași convenție ca peste tot în modul. */
  readonly peZi: Readonly<Record<string, readonly OmZi[]>>;
  readonly sarbatoriNationale: Readonly<Record<string, string>>;
  /** Ziua curentă, calculată pe SERVER cu fusul București. */
  readonly azi: string;
  /** Câți angajați sunt pe pagina curentă — foaia și calendarul se paginează la fel. */
  readonly angajatiAfisati: number;
}

export function CalendarLuna({
  an,
  luna,
  peZi,
  sarbatoriNationale,
  azi,
  angajatiAfisati,
}: Proprietati) {
  const saptamani = construiesteSaptamani(an, luna);
  const legenda = tipuriDinLuna(peZi);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="text-corp w-full min-w-[52rem] table-fixed border-collapse text-left">
          <caption className="sr-only">
            Calendarul lunar de pontaj. Fiecare zi listează angajații cu ore înregistrate.
          </caption>
          <thead>
            <tr>
              {ZILE_SAPTAMANA.map((zi) => (
                <th
                  key={zi}
                  scope="col"
                  className="border-border bg-surface text-muted-foreground text-nota border px-2 py-1.5 font-medium"
                >
                  {zi}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {saptamani.map((saptamana, indexSaptamana) => (
              <tr key={indexSaptamana}>
                {saptamana.map((zi, indexZi) => {
                  if (zi === null) {
                    return (
                      <td
                        key={indexZi}
                        className="border-border bg-surface h-28 border align-top"
                      />
                    );
                  }
                  const data = ziIso(an, luna, zi);
                  return (
                    <CelulaLunii
                      key={data}
                      zi={zi}
                      oameni={peZi[data] ?? []}
                      sarbatoare={sarbatoriNationale[data] ?? null}
                      esteAzi={data === azi}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {legenda.length === 0 ? null : (
        <p className="text-muted-foreground text-nota flex flex-wrap gap-x-4 gap-y-1">
          {legenda.map((tip) => (
            <span key={tip}>
              <code
                className={`${CLASE_TIP_ZI[tip] ?? ""} border-border text-foreground mr-1 rounded border px-1 tabular-nums`}
              >
                {CODURI_TIP_ZI[tip] ?? "?"}
              </code>
              {ETICHETE_TIP_ZI[tip] ?? tip}
            </span>
          ))}
        </p>
      )}

      {/*
        Aceeași onestitate ca `<tfoot>`-ul foii colective: calendarul arată doar
        angajații paginii curente. PostgREST trunchiază tăcut peste `max_rows`,
        iar `limita` e plafonată la 30 tocmai de aceea — o notă lipsă aici ar face
        o pagină parțială să arate ca o lună întreagă.
      */}
      <p className="text-muted-foreground text-nota">
        Se afișează {angajatiAfisati} {angajatiAfisati === 1 ? "angajat" : "angajați"} din pagina
        curentă.
      </p>
    </div>
  );
}

/** Tipurile de zi care apar EFECTIV în lună, în ordinea etichetei. */
function tipuriDinLuna(
  peZi: Readonly<Record<string, readonly OmZi[]>>,
): readonly IntrareZiClient["tipZi"][] {
  const tipuri = new Set<IntrareZiClient["tipZi"]>();
  for (const oameni of Object.values(peZi)) {
    for (const om of oameni) {
      if (om.intrare.tipZi !== "lucratoare") tipuri.add(om.intrare.tipZi);
    }
  }
  return [...tipuri].sort((a, b) => ETICHETE_TIP_ZI[a].localeCompare(ETICHETE_TIP_ZI[b], "ro"));
}

/** Numele fără marcă — în căsuța de calendar nu încape, iar marca e în foaie. */
function numeScurt(eticheta: string): string {
  const paranteza = eticheta.indexOf(" (");
  return paranteza === -1 ? eticheta : eticheta.slice(0, paranteza);
}

/** Ce scrie în dreptul unui om: orele, sau codul zilei când n-a lucrat. */
function cifraZilei(intrare: IntrareZiClient): string {
  if (intrare.oraInceput !== null && intrare.oraSfarsit === null) return "în curs";
  if (intrare.oreLucrate > 0) return formatOre(intrare.oreLucrate);
  return CODURI_TIP_ZI[intrare.tipZi];
}

function CelulaLunii({
  zi,
  oameni,
  sarbatoare,
  esteAzi,
}: {
  readonly zi: number;
  readonly oameni: readonly OmZi[];
  readonly sarbatoare: string | null;
  readonly esteAzi: boolean;
}) {
  const vizibili = oameni.slice(0, MAXIM_PE_ZI);
  const ascunsi = oameni.slice(MAXIM_PE_ZI);

  return (
    <td
      className={`border-border h-28 border align-top ${sarbatoare === null ? "" : CLASE_TIP_ZI.sarbatoare}`}
    >
      <div className="space-y-0.5 p-1.5">
        <span
          className={`text-nota block font-medium ${esteAzi ? "text-primary" : "text-muted-foreground"}`}
        >
          {zi}
          {esteAzi ? <span className="sr-only"> (azi)</span> : null}
        </span>

        {sarbatoare === null ? null : (
          <span className="text-nota text-foreground block truncate">{sarbatoare}</span>
        )}

        {vizibili.map((om) => (
          <span key={om.intrare.id} className="text-nota text-foreground block truncate">
            <span className="tabular-nums">{cifraZilei(om.intrare)}</span> {numeScurt(om.eticheta)}
          </span>
        ))}

        {ascunsi.length === 0 ? null : (
          <>
            <span aria-hidden="true" className="text-nota text-muted-foreground block">
              +{ascunsi.length} {ascunsi.length === 1 ? "altul" : "alții"}
            </span>
            {/*
              Cei tăiați rămân CITIBILI. Un `title` n-ar ajuta: nu apare la
              atingere și nu se citește la tastatură — lecția scrisă în
              `concedii/calendar/grila-calendar.tsx`.
            */}
            <span className="sr-only">
              {ascunsi
                .map((om) => `${numeScurt(om.eticheta)} ${cifraZilei(om.intrare)}`)
                .join(", ")}
            </span>
          </>
        )}
      </div>
    </td>
  );
}
