// src/app/(app)/mentenanta/durata.ts

const MINUTE_PE_ORA = 60;
const MINUTE_PE_ZI = 24 * MINUTE_PE_ORA;

/**
 * Durata unei opriri, în cuvinte: „45 min”, „3 h 20 min”, „2 zile 4 h”.
 * Sub un minut spune „sub un minut”, ca o oprire abia deschisă să nu arate „0 min”.
 */
export function formatDurataMinute(minute: number): string {
  const total = Math.max(0, Math.round(minute));
  if (total < 1) return "sub un minut";
  const zile = Math.floor(total / MINUTE_PE_ZI);
  const ore = Math.floor((total % MINUTE_PE_ZI) / MINUTE_PE_ORA);
  const min = total % MINUTE_PE_ORA;
  if (zile > 0) {
    const z = zile === 1 ? "1 zi" : `${String(zile)} zile`;
    return ore > 0 ? `${z} ${String(ore)} h` : z;
  }
  if (ore > 0) return min > 0 ? `${String(ore)} h ${String(min)} min` : `${String(ore)} h`;
  return `${String(min)} min`;
}

/** Minutele dintre două momente ISO; `pana` lipsă = acum (`acum` injectat, pentru teste). */
export function minuteIntre(deLa: string, pana: string | null, acum: string): number {
  const start = new Date(deLa).getTime();
  const sfarsit = new Date(pana ?? acum).getTime();
  if (Number.isNaN(start) || Number.isNaN(sfarsit)) return 0;
  return (sfarsit - start) / 60_000;
}
