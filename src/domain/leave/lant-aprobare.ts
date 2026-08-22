// src/domain/leave/lant-aprobare.ts
// Gruparea sarcinilor de aprobare pe trepte, pentru afișare.
//
// `approval_tasks` conține o sarcină PER APROBATOR POSIBIL, nu per treaptă: un
// pas de tip `permisiune` produce câte un rând pentru fiecare persoană
// îndreptățită să decidă. Randate una câte una, cele patru sarcini ale unei
// singure trepte apăreau ca „Pasul 1” de patru ori.
//
// Treapta e decisă de PRIMA decizie — `internal.approval_tasks_anuleaza_surori`
// anulează restul sarcinilor de la aceeași `ordine`. Deci starea treptei nu e
// „suma” sarcinilor, ci decizia care a contat.

import type { StatusSarcinaAprobare } from "@/schemas/leave";

export type SarcinaDeGrupat = Readonly<{
  id: string;
  ordine: number;
  status: StatusSarcinaAprobare;
  comentariu: string | null;
  decis_la: string | null;
  termen_la: string | null;
}>;

export type TreaptaAprobare = Readonly<{
  ordine: number;
  status: StatusSarcinaAprobare;
  comentariu: string | null;
  decis_la: string | null;
  termen_la: string | null;
  /**
   * Câți aprobatori posibili are treapta, DINTRE CEI VIZIBILI. RLS-ul arată
   * fiecăruia doar sarcinile proprii, dacă nu are `leave:approve = all` — deci
   * un manager vede 1 acolo unde patronul vede 4. Numărul descrie ce se vede,
   * nu adevărul absolut, iar interfața nu trebuie să pretindă altceva.
   */
  candidatiVizibili: number;
}>;

/** Decizia care a contat, dacă există: aprobarea sau respingerea, nu anularea. */
function decizia(sarcini: readonly SarcinaDeGrupat[]): SarcinaDeGrupat | undefined {
  return sarcini.find((s) => s.status === "aprobata" || s.status === "respinsa");
}

export function grupeazaPeTrepte(sarcini: readonly SarcinaDeGrupat[]): readonly TreaptaAprobare[] {
  const peOrdine = new Map<number, SarcinaDeGrupat[]>();
  for (const sarcina of sarcini) {
    const grup = peOrdine.get(sarcina.ordine);
    if (grup === undefined) peOrdine.set(sarcina.ordine, [sarcina]);
    else grup.push(sarcina);
  }

  return [...peOrdine.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ordine, grup]) => {
      const decisa = decizia(grup);
      if (decisa !== undefined) {
        return {
          ordine,
          status: decisa.status,
          comentariu: decisa.comentariu,
          decis_la: decisa.decis_la,
          termen_la: decisa.termen_la,
          candidatiVizibili: grup.length,
        };
      }

      // Nicio decizie: treapta e în așteptare cât timp are măcar o sarcină
      // deschisă. Dacă toate au fost anulate — surori ale unei decizii de pe
      // altă treaptă, sau flux abandonat — treapta e anulată.
      const deschisa = grup.find((s) => s.status === "in_asteptare");
      const reprezentativa = deschisa ?? grup[0];
      return {
        ordine,
        status: reprezentativa?.status ?? "anulata",
        comentariu: null,
        decis_la: reprezentativa?.decis_la ?? null,
        termen_la: reprezentativa?.termen_la ?? null,
        candidatiVizibili: grup.length,
      };
    });
}
