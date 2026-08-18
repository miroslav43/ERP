```ts
    expect(r.litriTotali).toBe(40);
    expect(r.consumReal).toBe(8);
  });

  it('mai multe alimentări pe aceeaşi foaie: se însumează litrii', () => {
    const r = calculeazaConsum({
      kmParcursi: 1000,
      alimentari: [{ litri: 35.5 }, { litri: 28.25 }, { litri: 12 }],
    });
    expect(r.litriTotali).toBe(75.75);
    expect(r.consumReal).toBe(7.58);
  });

  it('calculează abaterea faţă de consumul declarat şi semnalează depăşirea pragului implicit', () => {
    const r = calculeazaConsum({ kmParcursi: 500, alimentari: [{ litri: 50 }], consumDeclarat: 8 });
    expect(r.consumReal).toBe(10);
    expect(r.abatereProcent).toBe(25);
    expect(r.depasestePrag).toBe(true);
    expect(PRAG_ABATERE_CONSUM_IMPLICIT).toBe(15);
  });

  it('nu semnalează depăşire când abaterea e sub un prag configurat explicit', () => {
    const r = calculeazaConsum({
      kmParcursi: 500,
      alimentari: [{ litri: 42 }],
      consumDeclarat: 8,
      pragAbatereProcent: 10,
    });
    expect(r.abatereProcent).toBe(5);
    expect(r.depasestePrag).toBe(false);
  });

  it('ignoră consumul declarat lipsă sau nevalid (zero)', () => {
    const r = calculeazaConsum({ kmParcursi: 500, alimentari: [{ litri: 40 }], consumDeclarat: 0 });
    expect(r.abatereProcent).toBeNull();
  });

  it('respinge kilometrii negativi', () => {
    expect(() => calculeazaConsum({ kmParcursi: -1, alimentari: [] })).toThrow();
  });

  it('respinge litrii negativi', () => {
    expect(() => calculeazaConsum({ kmParcursi: 100, alimentari: [{ litri: -5 }] })).toThrow();
  });
});
```

```ts
// src/domain/fleet/kilometraj.ts

/**
 * Continuitatea kilometrajului între foi de parcurs succesive, replicată la
 * nivel de aplicaţie din triggerele `internal.foi_parcurs_inainte` /
 * `internal.foi_parcurs_dupa` (0012_fleet.sql), pentru feedback imediat în
 * formular — decizia finală rămâne oricum a bazei de date.
 *
 * Regres = kilometrajul de plecare sau de sosire e mai mic decât ultimul
 * kilometraj cunoscut: fizic imposibil, se blochează. Salt = diferenţa dintre
 * plecare şi ultimul kilometraj cunoscut depăşeşte pragul: posibil, dar
 * suspect (o foaie lipsă) — doar se semnalează.
 */

export const PRAG_SALT_KM_IMPLICIT = 1500;

export type RezultatContinuitateKm = 'ok' | 'regres' | 'salt';

export function verificaContinuitate(
  kmUltim: number,
  kmPlecare: number,
  kmSosire: number | null | undefined,
  pragSalt: number = PRAG_SALT_KM_IMPLICIT
): RezultatContinuitateKm {
  if (kmUltim < 0 || kmPlecare < 0) {
    throw new Error('Kilometrajul nu poate fi negativ.');
  }
  if (kmSosire !== null && kmSosire !== undefined && kmSosire < 0) {
    throw new Error('Kilometrajul nu poate fi negativ.');
  }
  if (pragSalt <= 0) {
    throw new Error('Pragul de salt trebuie să fie un număr pozitiv de kilometri.');
  }

  if (kmPlecare < kmUltim) {
    return 'regres';
  }
  if (kmSosire !== null && kmSosire !== undefined && kmSosire < kmPlecare) {
    return 'regres';
  }
  if (kmPlecare - kmUltim > pragSalt) {
    return 'salt';
  }
  return 'ok';
}
```

```ts
// src/domain/fleet/kilometraj.test.ts
import { describe, expect, it } from 'vitest';
import { verificaContinuitate, PRAG_SALT_KM_IMPLICIT } from './kilometraj';

describe('verificaContinuitate', () => {
  it('este ok când kilometrajul creşte firesc, sub prag', () => {
    expect(verificaContinuitate(10000, 10050, 10200)).toBe('ok');
  });

  it('este ok la egalitate perfectă între ultimul km şi plecare', () => {
    expect(verificaContinuitate(10000, 10000, 10100)).toBe('ok');
  });

  it('semnalează regres când plecarea e sub ultimul kilometraj cunoscut', () => {
    expect(verificaContinuitate(10000, 9900, 10100)).toBe('regres');
  });

  it('semnalează regres când sosirea e sub plecare, chiar dacă plecarea e validă', () => {
    expect(verificaContinuitate(10000, 10050, 10000)).toBe('regres');
  });

  it('tratează regresul cu prioritate faţă de salt', () => {
    expect(verificaContinuitate(10000, 5000, 5100, 100)).toBe('regres');
  });

  it('semnalează salt când diferenţa depăşeşte pragul', () => {
    expect(verificaContinuitate(10000, 12000, 12100, 1500)).toBe('salt');
  });

  it('nu semnalează salt exact la limita pragului', () => {
    expect(verificaContinuitate(10000, 11500, 11600, 1500)).toBe('ok');
  });

  it('foloseşte pragul implicit de 1500 km când nu se specifică altul', () => {
    expect(verificaContinuitate(10000, 12000, 12100)).toBe('salt');
    expect(PRAG_SALT_KM_IMPLICIT).toBe(1500);
  });

  it('acceptă sosire lipsă (foaie neîncheiată încă)', () => {
    expect(verificaContinuitate(10000, 10500, null)).toBe('ok');
    expect(verificaContinuitate(10000, 10500, undefined)).toBe('ok');
  });

  it('respinge un prag de salt invalid', () => {
    expect(() => verificaContinuitate(10000, 10500, null, 0)).toThrow();
  });

  it('respinge un kilometraj negativ', () => {
    expect(() => verificaContinuitate(-1, 100, 200)).toThrow();
  });
});
```

Continui cu `src/lib/queries/fleet.ts` în răspunsul următor.