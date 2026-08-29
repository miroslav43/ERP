// src/app/(app)/pontaj/etichete.test.ts
import { describe, expect, it } from "vitest";

import { oreleZilei, type ConfigZi } from "@/domain/attendance/calcul-ore";

import { rezumatRegulaPontaj } from "./etichete";

/**
 * Ce apără fișierul ăsta: faptul că ecranul angajatului SPUNE după ce regulă a
 * calculat, nu doar cifra care rezultă.
 *
 * Cazul care l-a cerut, luat din baza reală: firma avea două versiuni de setări
 * — una de la 01.01.2026 cu pauza „inclusă în program" (deci nescăzută) și una
 * de la 01.09.2026 cu pauza scăzută. Pe 28.08.2026, un interval 08:30–17:00
 * ieșea cu 8:30 lucrate și 0:30 suplimentare, corect pentru versiunea în
 * vigoare — dar ecranul nu spunea nicăieri care versiune e aia, iar rândul de
 * pauză lipsește tocmai când pauza nu se scade. Aceeași cifră, două cauze
 * complet diferite, imposibil de deosebit privind ecranul.
 */

const BAZA: ConfigZi = {
  orePeZi: 8,
  noapteStart: "22:00",
  noapteSfarsit: "06:00",
  pauzaMinute: 30,
  pauzaInclusaInProgram: true,
  pauzaObligatoriePesteOre: 8,
};

describe("rezumatRegulaPontaj", () => {
  it("spune că pauza NU se scade, acolo unde rezumatul n-are rând de pauză", () => {
    const text = rezumatRegulaPontaj(BAZA, true);
    expect(text).toContain("normă 8:00 h/zi");
    expect(text).toContain("30 min");
    expect(text).toContain("NU se scade");
  });

  it("spune pragul de la care pauza chiar se scade", () => {
    const text = rezumatRegulaPontaj({ ...BAZA, pauzaInclusaInProgram: false }, true);
    expect(text).toContain("se scade peste 8:00 h");
    expect(text).not.toContain("NU se scade");
  });

  it("distinge firma fără setări de una configurată pe aceleași valori", () => {
    // Fără steagul `areSetari`, cele două ar da exact același text, iar prima
    // n-ar afla niciodată că merge pe valorile de rezervă.
    const fara: ConfigZi = { ...BAZA, pauzaMinute: 0, pauzaObligatoriePesteOre: 0 };
    expect(rezumatRegulaPontaj(fara, false)).toContain("n-a configurat");
    expect(rezumatRegulaPontaj(fara, true)).not.toContain("n-a configurat");
    expect(rezumatRegulaPontaj(fara, true)).toContain("fără pauză de masă configurată");
  });

  it("scrie orele pe ceas, nu zecimal", () => {
    const text = rezumatRegulaPontaj({ ...BAZA, orePeZi: 7.5 }, true);
    expect(text).toContain("7:30 h/zi");
    expect(text).not.toContain("7,5");
  });

  it("explică exact cifrele pe care le produce aceeași configurație", () => {
    /*
      Poarta care leagă textul de calcul: dacă rezumatul spune „NU se scade",
      atunci `oreleZilei` chiar nu scade — și invers. Două surse de adevăr
      despre aceeași regulă ar diverge fix pe ecranul unde se vede.
    */
    const inclusa = oreleZilei("08:30", "17:00", BAZA);
    expect(rezumatRegulaPontaj(BAZA, true)).toContain("NU se scade");
    expect(inclusa?.pauza).toBe(0);
    expect(inclusa?.lucrate).toBe(8.5);
    expect(inclusa?.suplimentare).toBe(0.5);

    const scazuta: ConfigZi = { ...BAZA, pauzaInclusaInProgram: false };
    const rezultat = oreleZilei("08:30", "17:00", scazuta);
    expect(rezumatRegulaPontaj(scazuta, true)).toContain("se scade peste 8:00 h");
    expect(rezultat?.pauza).toBe(0.5);
    expect(rezultat?.lucrate).toBe(8);
    expect(rezultat?.suplimentare).toBe(0);
  });
});
