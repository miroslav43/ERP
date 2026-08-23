// src/app/(app)/onboarding/filtre-instante.tsx
// Server Component: fără stare, fără handler, fără JavaScript trimis în browser.
// Trimiterea și pastilele stau în `BaraFiltre`.
import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { formatDate } from "@/lib/format/date";
import {
  CHECKLIST_INSTANTA_STATUS,
  CHECKLIST_TIP,
  type FiltreInstante as ValoriFiltre,
} from "@/schemas/checklist";

import { ETICHETE_STATUS_INSTANTA, ETICHETE_TIP } from "./etichete";

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

interface Proprietati {
  /**
   * `null` = viewerul nu are `employees:read ≥ team`: filtrul pe angajat nu
   * se afișează deloc, în loc de un `<select>` gol și inutilizabil.
   */
  readonly angajati: readonly AngajatOptiune[] | null;
  /**
   * Filtrele deja trecute prin `filtreDinUrl` — exact valorile pe care le-a
   * folosit lista. Citite brut din adresă, un `?tip=zzz` ar fi arătat în
   * formular altceva decât ce s-a filtrat de fapt.
   */
  readonly filtre: ValoriFiltre;
}

/**
 * Cheile pe care le administrează bara. `sort`, `limita` și `cursor` NU sunt
 * aici: nu sunt filtre, iar bara nu are voie să le atingă. Înainte, `aplica()`
 * pornea dintr-un `URLSearchParams` gol, deci fiecare apăsare pe „Filtrează”
 * arunca sortarea aleasă din tabel și mărimea de pagină aleasă din paginare.
 */
const CHEI_PROPRII = ["tip", "status", "angajat", "de_la", "pana_la"] as const;

const CLASA_CONTROL = "border-foreground/60 rounded-control text-corp border px-3 py-2";

/** „Ion Popescu (0042)” — aceeași formă ca în lista de opțiuni. */
function numeAngajat(angajat: AngajatOptiune): string {
  return `${angajat.full_name ?? angajat.marca} (${angajat.marca})`;
}

export function FiltreInstante({ angajati, filtre }: Proprietati) {
  // `status` e o listă în adresă („in_curs,finalizata”), dar selectul are o
  // singură valoare: îl deschidem doar când adresa poartă exact una.
  const statusAles = filtre.status?.length === 1 ? (filtre.status[0] ?? "") : "";

  // Pastilele poartă DENUMIREA, nu identificatorul: „Angajat: Ion Popescu (0042)”,
  // nu un UUID.
  const active: FiltruActiv[] = [];
  if (filtre.tip !== null)
    active.push({ cheie: "tip", eticheta: `Tip: ${ETICHETE_TIP[filtre.tip]}` });
  if (filtre.status !== null && filtre.status.length > 0) {
    active.push({
      cheie: "status",
      eticheta: `Stare: ${filtre.status.map((s) => ETICHETE_STATUS_INSTANTA[s]).join(", ")}`,
    });
  }
  if (filtre.angajat !== null && angajati !== null) {
    const ales = angajati.find((a) => a.id === filtre.angajat);
    active.push({
      cheie: "angajat",
      eticheta: `Angajat: ${ales === undefined ? "necunoscut" : numeAngajat(ales)}`,
    });
  }
  if (filtre.de_la !== null) {
    active.push({ cheie: "de_la", eticheta: `De la: ${formatDate(filtre.de_la)}` });
  }
  if (filtre.pana_la !== null) {
    active.push({ cheie: "pana_la", eticheta: `Până la: ${formatDate(filtre.pana_la)}` });
  }

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII}>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-instante-tip" className="text-corp font-medium">
          Tip
        </label>
        <select
          // `key` legat de valoarea din adresă: un control NECONTROLAT își ia
          // `defaultValue` doar la montare, deci după „Șterge filtrul” ar fi rămas
          // cu valoarea veche în câmp — și ar fi reaplicat-o la următoarea apăsare
          // pe „Filtrează”.
          key={filtre.tip ?? ""}
          id="filtru-instante-tip"
          name="tip"
          defaultValue={filtre.tip ?? ""}
          className={CLASA_CONTROL}
        >
          <option value="">Toate</option>
          {CHECKLIST_TIP.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-instante-status" className="text-corp font-medium">
          Stare
        </label>
        <select
          key={statusAles}
          id="filtru-instante-status"
          name="status"
          defaultValue={statusAles}
          className={CLASA_CONTROL}
        >
          <option value="">Toate</option>
          {CHECKLIST_INSTANTA_STATUS.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_STATUS_INSTANTA[s]}
            </option>
          ))}
        </select>
      </div>

      {angajati === null ? null : (
        <div className="flex flex-col gap-1">
          <label htmlFor="filtru-instante-angajat" className="text-corp font-medium">
            Angajat
          </label>
          <select
            key={filtre.angajat ?? ""}
            id="filtru-instante-angajat"
            name="angajat"
            defaultValue={filtre.angajat ?? ""}
            className={CLASA_CONTROL}
          >
            <option value="">Toți</option>
            {angajati.map((a) => (
              <option key={a.id} value={a.id}>
                {numeAngajat(a)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-instante-de-la" className="text-corp font-medium">
          De la
        </label>
        <input
          key={filtre.de_la ?? ""}
          id="filtru-instante-de-la"
          name="de_la"
          type="date"
          defaultValue={filtre.de_la ?? ""}
          className={CLASA_CONTROL}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-instante-pana-la" className="text-corp font-medium">
          Până la
        </label>
        <input
          key={filtre.pana_la ?? ""}
          id="filtru-instante-pana-la"
          name="pana_la"
          type="date"
          defaultValue={filtre.pana_la ?? ""}
          className={CLASA_CONTROL}
        />
      </div>
    </BaraFiltre>
  );
}
