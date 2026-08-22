// src/domain/per-diem/ore-pe-tara.ts
/**
 * Port pur al `app.per_diem_ore_pe_tara` (0015_per_diem.sql).
 *
 * Cronologia „în ce țară se află angajatul” vine ca o listă de repere
 * (`etape`): fiecare reper spune „de la acest moment, angajatul e în această
 * țară”. Funcția transformă reperele în intervale consecutive (fiecare reper
 * ține până la următorul, sau până la sosire pentru ultimul), apoi calculează
 * câte ore din intervalul [`deLa`, `panaLa`) — de regulă o fereastră de 24 de
 * ore — cad în fiecare țară.
 *
 * Fără repere, întreaga deplasare e în `taraImplicita` — exact ramura
 * `union all ... where not exists (select 1 from puncte)` din SQL.
 */

export interface PunctTara {
  readonly deLa: Date;
  readonly countryId: string;
}

export interface OrePeTara {
  readonly countryId: string;
  /** Ore petrecute în această țară, în intervalul cerut. */
  readonly ore: number;
  /** Cel mai devreme moment din intervalul cerut petrecut în această țară. */
  readonly primulMoment: Date;
  /** Cel mai târziu moment din intervalul cerut petrecut în această țară. */
  readonly ultimulMoment: Date;
}

const MS_PE_ORA = 3_600_000;

interface IntervalTara {
  readonly countryId: string;
  readonly deLa: Date;
  readonly panaLa: Date;
}

function construiesteIntervale(
  etape: readonly PunctTara[],
  plecare: Date,
  sosire: Date,
  taraImplicita: string,
): readonly IntervalTara[] {
  if (etape.length === 0) {
    return [{ countryId: taraImplicita, deLa: plecare, panaLa: sosire }];
  }

  const ordonate = [...etape].sort((a, b) => a.deLa.getTime() - b.deLa.getTime());
  const intervale: IntervalTara[] = [];

  for (let i = 0; i < ordonate.length; i += 1) {
    const punct = ordonate[i];
    if (punct === undefined) continue;
    const urmatorul = ordonate[i + 1];
    // `greatest(de_la, p_plecare)`: reperele dinaintea plecării nu extind
    // intervalul înapoi în timp.
    const deLa = punct.deLa.getTime() > plecare.getTime() ? punct.deLa : plecare;
    const panaLa = urmatorul !== undefined ? urmatorul.deLa : sosire;
    if (panaLa.getTime() > deLa.getTime()) {
      intervale.push({ countryId: punct.countryId, deLa, panaLa });
    }
  }
  return intervale;
}

/**
 * Orele petrecute în fiecare țară, în intervalul [`deLa`, `panaLa`).
 *
 * `etape` nu trebuie să fie pre-sortate — funcția le ordonează după `deLa`,
 * exact ca `lead(...) over (order by de_la)` din SQL.
 */
export function orePeTara(
  etape: readonly PunctTara[],
  plecare: Date,
  sosire: Date,
  deLa: Date,
  panaLa: Date,
  taraImplicita: string,
): readonly OrePeTara[] {
  const intervale = construiesteIntervale(etape, plecare, sosire, taraImplicita);
  const acumulator = new Map<string, { ore: number; primulMoment: Date; ultimulMoment: Date }>();

  for (const interval of intervale) {
    const start = interval.deLa.getTime() > deLa.getTime() ? interval.deLa : deLa;
    const sfarsit = interval.panaLa.getTime() < panaLa.getTime() ? interval.panaLa : panaLa;
    if (sfarsit.getTime() <= start.getTime()) continue;

    const ore = (sfarsit.getTime() - start.getTime()) / MS_PE_ORA;
    const existent = acumulator.get(interval.countryId);
    if (existent === undefined) {
      acumulator.set(interval.countryId, { ore, primulMoment: start, ultimulMoment: sfarsit });
    } else {
      acumulator.set(interval.countryId, {
        ore: existent.ore + ore,
        primulMoment:
          existent.primulMoment.getTime() < start.getTime() ? existent.primulMoment : start,
        ultimulMoment:
          existent.ultimulMoment.getTime() > sfarsit.getTime() ? existent.ultimulMoment : sfarsit,
      });
    }
  }

  // Ordinea nu contează pentru SQL (e un GROUP BY), dar una deterministă face
  // testele stabile.
  return [...acumulator.entries()]
    .map(([countryId, v]) => ({ countryId, ...v }))
    .sort((a, b) => a.countryId.localeCompare(b.countryId));
}
