// src/app/(app)/pontaj/filtre-pontaj.tsx
// Server Component: fără stare, fără handler, fără JavaScript trimis în browser.
// Trimiterea și pastilele stau în `BaraFiltre`.
import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { todayInBucharest } from "@/lib/format/date";

interface Departament {
  readonly id: string;
  readonly denumire: string;
}

interface Proprietati {
  readonly an: number;
  /**
   * Luna EFECTIV afișată, calculată server-side (`filtrePontajSchema`, cu
   * implicitul ei pe luna curentă) — nu citită brut din adresă: la o intrare
   * proaspătă pe `/pontaj`, fără `?luna=`, query string-ul e gol, iar
   * selectul ar cădea pe prima opțiune („ianuarie”) deși foaia afișată e a
   * lunii curente. Primind valoarea reală ca proprietate, selectul o arată
   * corect din primul randare, indiferent dacă a venit din URL sau din
   * implicitul schemei.
   */
  readonly luna: number;
  readonly departament: string | null;
  readonly cauta: string | null;
  readonly departamente: readonly Departament[];
}

const LUNI_ETICHETE = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
] as const;

/**
 * Cheile pe care le administrează bara. `limita` și `cursor` NU sunt aici: nu
 * sunt filtre, iar bara nu are voie să le atingă. Înainte, `aplica()` pornea
 * dintr-un `URLSearchParams` gol, deci fiecare apăsare pe „Filtrează” arunca
 * mărimea de pagină aleasă din paginare.
 */
const CHEI_PROPRII = ["an", "luna", "departament", "cauta"] as const;

const CLASA_CONTROL = "border-foreground/60 rounded-control text-corp border px-3 py-2";

/**
 * Filtrele foii colective: an, lună, departament, căutare după nume.
 *
 * `departamente` goală (rolul curent nu are `departments:read`, sau
 * organizația nu are niciunul activ) ⇒ selectul de departament nu se
 * randează deloc — un filtru care nu ar întoarce niciodată o alegere e mai
 * rău decât lipsa lui.
 */
export function FiltrePontaj({ an, luna, departament, cauta, departamente }: Proprietati) {
  const azi = todayInBucharest();
  const anImplicit = Number(azi.slice(0, 4));
  const lunaImplicita = Number(azi.slice(5, 7));

  /*
   * `an` și `luna` au ÎNTOTDEAUNA o valoare efectivă, deci ar apărea ca filtru
   * activ pe orice ecran. Devin pastile numai când se abat de la implicitul
   * schemei — luna curentă —, adică exact atunci când „Șterge toate filtrele”
   * ar muta omul înapoi în luna curentă fără să-l anunțe.
   */
  const active: FiltruActiv[] = [];
  if (an !== anImplicit) active.push({ cheie: "an", eticheta: `An: ${String(an)}` });
  if (luna !== lunaImplicita) {
    active.push({ cheie: "luna", eticheta: `Luna: ${LUNI_ETICHETE[luna - 1] ?? String(luna)}` });
  }
  if (departament !== null) {
    // Pastila poartă DENUMIREA, nu identificatorul: un UUID nu ajută pe nimeni.
    const ales = departamente.find((d) => d.id === departament);
    active.push({
      cheie: "departament",
      eticheta: `Departament: ${ales?.denumire ?? "necunoscut"}`,
    });
  }
  if (cauta !== null) active.push({ cheie: "cauta", eticheta: `Angajat: ${cauta}` });

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII}>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-pontaj-an" className="text-corp font-medium">
          An
        </label>
        <input
          // `key` legat de valoarea din adresă: un control NECONTROLAT își ia
          // `defaultValue` doar la montare, deci după „Șterge filtrul” ar fi rămas
          // cu valoarea veche în câmp — și ar fi reaplicat-o la următoarea apăsare
          // pe „Filtrează”.
          key={an}
          id="filtru-pontaj-an"
          name="an"
          type="number"
          min={2000}
          max={2100}
          defaultValue={an}
          className={`${CLASA_CONTROL} w-24`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-pontaj-luna" className="text-corp font-medium">
          Luna
        </label>
        <select
          key={luna}
          id="filtru-pontaj-luna"
          name="luna"
          defaultValue={luna}
          className={CLASA_CONTROL}
        >
          {LUNI_ETICHETE.map((eticheta, index) => (
            <option key={eticheta} value={index + 1}>
              {eticheta}
            </option>
          ))}
        </select>
      </div>

      {departamente.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <label htmlFor="filtru-pontaj-departament" className="text-corp font-medium">
            Departament
          </label>
          <select
            key={departament ?? ""}
            id="filtru-pontaj-departament"
            name="departament"
            defaultValue={departament ?? ""}
            className={CLASA_CONTROL}
          >
            <option value="">Toate</option>
            {departamente.map((d) => (
              <option key={d.id} value={d.id}>
                {d.denumire}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-pontaj-cauta" className="text-corp font-medium">
          Angajat
        </label>
        <input
          key={cauta ?? ""}
          id="filtru-pontaj-cauta"
          name="cauta"
          type="search"
          defaultValue={cauta ?? ""}
          placeholder="Nume angajat"
          className={CLASA_CONTROL}
        />
      </div>
    </BaraFiltre>
  );
}
