// src/domain/leave/sold.test.ts

import { describe, expect, it } from 'vitest';
import { calculeazaAcumulareProportionala, rotunjesteZileConcediu } from './sold';

function zi(an: number, luna: number, ziua: number): Date {
  return new Date(Date.UTC(an, luna - 1, ziua));
}

describe('calculeazaAcumulareProportionala', () => {
  it('angajat de la 1 ianuarie acumulează dreptul anual integral', () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2025, 1, 1),
      2025,
      20,
      'fara_rotunjire',
      zi(2026, 1, 15), // anul 2025 s-a încheiat deja
    );
    expect(zile).toBe(20);
  });

  it('angajat la 15 iunie acumulează proporțional cele 7 luni rămase din an', () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2025, 6, 15),
      2025,
      21,
      'jumatate_in_sus',
      zi(2026, 1, 15),
    );
    // 21 / 12 = 1,75 pe lună × 7 luni (iunie-decembrie) = 12,25 -> rotunjit la 0,5 în sus = 12,5
    expect(zile).toBe(12.5);
  });

  it('angajat anul trecut are dreptul anual integral pentru anul curent', () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2023, 3, 1),
      2025,
      20,
      'fara_rotunjire',
      zi(2026, 1, 10),
    );
    expect(zile).toBe(20);
  });

  it('angajat în decembrie acumulează doar fracțiunea unei singure luni', () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2025, 12, 10),
      2025,
      24,
      'zi_in_sus',
      zi(2026, 3, 1),
    );
    // 24 / 12 = 2 pe lună × 1 lună (decembrie) = 2
    expect(zile).toBe(2);
  });

  it('nu acumulează nimic dacă angajatul nu era încă încadrat în anul respectiv', () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2026, 3, 1),
      2025,
      20,
      'fara_rotunjire',
      zi(2026, 6, 1),
    );
    expect(zile).toBe(0);
  });

  it('nu acumulează nimic dacă anul de calcul nu a început încă la data de referință', () => {
    const zile = calculeazaAcumulareProportionala(
      zi(2020, 1, 1),
      2027,
      20,
      'fara_rotunjire',
      zi(2026, 6, 1),
    );
    expect(zile).toBe(0);
  });

  it('respinge un drept anual negativ', () => {
    expect(() =>
      calculeazaAcumulareProportionala(zi(2025, 1, 1), 2025, -1, 'fara_rotunjire', zi(2026, 1, 1)),
    ).toThrow(RangeError);
  });
});

describe('rotunjesteZileConcediu', () => {
  it('fara_rotunjire păstrează valoarea la 2 zecimale', () => {
    expect(rotunjesteZileConcediu(12.256, 'fara_rotunjire')).toBe(12.26);
  });

  it('jumatate_in_jos rotunjește în jos la cel mai apropiat 0,5', () => {
    expect(rotunjesteZileConcediu(12.4, 'jumatate_in_jos')).toBe(12);
  });

  it('zi_in_jos rotunjește în jos la ziua întreagă', () => {
    expect(rotunjesteZileConcediu(12.9, 'zi_in_jos')).toBe(12);
  });

  it('matematic rotunjește standard la cea mai apropiată zi', () => {
    expect(rotunjesteZileConcediu(12.5, 'matematic')).toBe(13);
    expect(rotunjesteZileConcediu(12.4, 'matematic')).toBe(12);
  });
});
