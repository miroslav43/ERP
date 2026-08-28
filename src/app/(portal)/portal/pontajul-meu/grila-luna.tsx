// src/app/(portal)/portal/pontajul-meu/grila-luna.tsx
import Link from "next/link";

import { CLASE_TIP_ZI, CODURI_TIP_ZI, ETICHETE_TIP_ZI } from "@/app/(app)/pontaj/etichete";
import { construiesteSaptamani, ziIso } from "@/domain/calendar/grila-lunara";
import type { ZiPontaj } from "@/lib/queries/portal";

/**
 * Luna proprie de pontaj, ca grilă de calendar.
 *
 * ── DE CE ARATĂ CA FOAIA COLECTIVĂ ────────────────────────────────────────
 * Codurile (`CO`, `CM`, `SL`, `AN`, `D`, `L`, `0`) și fundalurile vin din
 * `(app)/pontaj/etichete.ts`, nu dintr-o paletă proprie: angajatul care își vede
 * luna aici și responsabilul care se uită la aceeași lună în foaia colectivă
 * trebuie să vadă ACELEAȘI semne. Un „CO” în portal și un galben fără literă în
 * aplicația mare ar fi două limbi pentru același concediu.
 *
 * Importul peste grupul de rute e tiparul portalului, nu o excepție:
 * `concediile-mele` importă deja `ETICHETE_PORTIUNE` din `(app)/concedii`.
 *
 * ── CULOAREA NU E SINGURUL PURTĂTOR ───────────────────────────────────────
 * Regula scrisă în `(app)/pontaj/etichete.ts` §CLASE_TIP_ZI: fundalul colorează
 * doar sărbătoarea și absența nemotivată, iar înțelesul stă în codul din celulă.
 * Grila se tipărește alb-negru și se citește la fel.
 *
 * ── SERVER, NU CLIENT ─────────────────────────────────────────────────────
 * Nicio stare, niciun `onClick`: comutarea listă/calendar se face prin adresă,
 * în `ComutatorVizualizare`. Grila nu livrează niciun octet de JavaScript.
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
 * `tip_zi` vine din bază ca `string`, nu ca uniunea `TipZi` — exact motivul
 * pentru care `ETICHETE_TIP_ZI` al portalului e indexat pe `string`. Lărgirea se
 * face o dată, aici, ca o valoare nouă venită printr-o migrare viitoare să cadă
 * pe ramura de rezervă în loc să scoată `undefined` pe ecranul unui om.
 */
const CODURI: Readonly<Record<string, string | undefined>> = CODURI_TIP_ZI;
const CLASE: Readonly<Record<string, string | undefined>> = CLASE_TIP_ZI;
const ETICHETE: Readonly<Record<string, string | undefined>> = ETICHETE_TIP_ZI;

/**
 * Tipurile care apar EFECTIV în luna afișată, în ordinea etichetei.
 *
 * Legenda se construiește din zile, nu din nomenclator: o lună obișnuită are
 * două-trei tipuri, iar o legendă cu șapte rânduri din care patru nu sunt pe
 * ecran e zgomot.
 */
export function tipuriDinLuna(zile: readonly ZiPontaj[]): readonly string[] {
  const tipuri = new Set(zile.map((z) => z.tip_zi));
  return [...tipuri].sort((a, b) => (ETICHETE[a] ?? a).localeCompare(ETICHETE[b] ?? b, "ro"));
}

interface Proprietati {
  readonly an: number;
  readonly luna: number;
  readonly zile: readonly ZiPontaj[];
  /** Ziua devine link către formularul ei doar când chiar se poate edita. */
  readonly poateEdita: boolean;
}

export function GrilaLuna({ an, luna, zile, poateEdita }: Proprietati) {
  const saptamani = construiesteSaptamani(an, luna);
  const peZi = new Map(zile.map((z) => [z.data, z]));
  const legenda = tipuriDinLuna(zile);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="text-corp w-full min-w-[44rem] table-fixed border-collapse text-left">
          <caption className="sr-only">
            Grila lunară a propriului pontaj. Zilele lucrătoare editabile sunt legături către
            formularul zilei.
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
                        className="border-border bg-surface h-20 border align-top"
                      />
                    );
                  }
                  const iso = ziIso(an, luna, zi);
                  const intrare = peZi.get(iso);
                  return (
                    <CelulaLunii
                      key={iso}
                      zi={zi}
                      data={iso}
                      intrare={intrare}
                      editabila={poateEdita && intrare?.tip_zi === "lucratoare"}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {legenda.length === 0 ? null : (
        // Aceleași semne ca în celulă: codul, pe fundalul tipului. Culoarea
        // singură se pierde la tipărire alb-negru și la daltonism.
        <p className="text-muted-foreground text-nota flex flex-wrap gap-x-4 gap-y-1">
          {legenda.map((tip) => (
            <span key={tip}>
              <code
                className={`${CLASE[tip] ?? ""} border-border text-foreground mr-1 rounded border px-1 tabular-nums`}
              >
                {CODURI[tip] ?? "?"}
              </code>
              {ETICHETE[tip] ?? tip}
            </span>
          ))}
          <span>
            <code className="border-border text-foreground mr-1 rounded border px-1 tabular-nums">
              —
            </code>
            Zi fără înregistrare
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * O zi din grilă.
 *
 * Un singur element interactiv per celulă, niciodată un link într-un link — de
 * aceea decizia „link sau nu” se ia aici, ca la `ZiRand` din listă, nu prin
 * înfășurarea condiționată a conținutului.
 *
 * Numele accesibil poartă și tipul zilei: „9 · 8 ore” singur, într-un tabel de
 * legături, nu spune la cititorul de ecran dacă ziua e lucrată sau de concediu.
 */
function CelulaLunii({
  zi,
  data,
  intrare,
  editabila,
}: {
  readonly zi: number;
  readonly data: string;
  readonly intrare: ZiPontaj | undefined;
  readonly editabila: boolean;
}) {
  const ore = intrare?.ore_lucrate ?? 0;
  const suplimentare = intrare?.ore_suplimentare ?? 0;
  const fundal = intrare === undefined ? "" : (CLASE[intrare.tip_zi] ?? "");
  // Zi deschisă cu ceasul și neînchisă: `ore_lucrate` e 0, deci celula ar arăta
  // codul tipului de zi ca și cum n-ar fi fost nimic pontat.
  const inCurs =
    intrare !== undefined && intrare.ora_inceput !== null && intrare.ora_sfarsit === null;

  const corp = (
    <>
      <span className="text-muted-foreground text-nota font-medium">{zi}</span>
      <span className="text-corp mt-1 block">
        {intrare === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : inCurs ? (
          <span className="text-warning font-medium">în curs</span>
        ) : (
          <span className="text-foreground tabular-nums">
            {ore > 0
              ? `${ore.toLocaleString("ro-RO")} ore`
              : (CODURI[intrare.tip_zi] ?? intrare.tip_zi)}
          </span>
        )}
      </span>
      {suplimentare > 0 ? (
        <span className="text-muted-foreground text-nota block tabular-nums">
          +{suplimentare.toLocaleString("ro-RO")} supl.
        </span>
      ) : null}
      {intrare === undefined ? null : (
        <span className="sr-only"> · {ETICHETE[intrare.tip_zi] ?? intrare.tip_zi}</span>
      )}
    </>
  );

  if (!editabila) {
    return (
      <td className={`border-border h-20 border align-top ${fundal}`}>
        <div className="p-1.5">{corp}</div>
      </td>
    );
  }

  return (
    <td className={`border-border h-20 border align-top ${fundal}`}>
      <Link
        href={`/portal/pontajul-meu/zi/${data}`}
        className="hover:bg-surface block h-full p-1.5 transition-colors"
      >
        {corp}
      </Link>
    </td>
  );
}
