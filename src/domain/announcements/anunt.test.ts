// src/domain/announcements/anunt.test.ts
import { describe, expect, it } from "vitest";

import { toBucharestDateString } from "@/lib/format/date";

import {
  extrasAnunt,
  filtruDinAdresa,
  numaraPeStari,
  potrivesteFiltru,
  sfarsitulZileiRomania,
  stareAnunt,
  type StareAnunt,
} from "./anunt";

const ACUM = new Date("2026-08-30T12:00:00.000Z");

describe("stareAnunt", () => {
  it("fără dată de publicare e ciornă, indiferent de expirare", () => {
    expect(stareAnunt({ publicat_la: null, expira_la: null }, ACUM)).toBe("ciorna");
    expect(stareAnunt({ publicat_la: null, expira_la: "2020-01-01T00:00:00Z" }, ACUM)).toBe(
      "ciorna",
    );
  });

  it("publicat în viitor e programat, nu activ", () => {
    expect(stareAnunt({ publicat_la: "2026-09-01T08:00:00Z", expira_la: null }, ACUM)).toBe(
      "programat",
    );
  });

  it("publicat în trecut, fără expirare, e activ", () => {
    expect(stareAnunt({ publicat_la: "2026-08-01T08:00:00Z", expira_la: null }, ACUM)).toBe(
      "activ",
    );
  });

  it("expirat cât timp expira_la a trecut", () => {
    expect(
      stareAnunt({ publicat_la: "2026-08-01T08:00:00Z", expira_la: "2026-08-29T23:59:59Z" }, ACUM),
    ).toBe("expirat");
  });

  /**
   * Pragul e cel din politica RLS: `announcements_select` arată rândul cât timp
   * `expira_la > now()`. Ecranul folosea `<` pentru „expirat", deci în chiar
   * momentul expirării spunea „valabil" despre un anunț pe care baza tocmai îl
   * ascunsese. Testul fixează granița, nu comportamentul din jurul ei.
   */
  it("la secunda exactă a expirării e deja expirat", () => {
    const laFix = { publicat_la: "2026-08-01T08:00:00Z", expira_la: ACUM.toISOString() };
    expect(stareAnunt(laFix, ACUM)).toBe("expirat");
  });

  it("cu o milisecundă înainte de expirare e încă activ", () => {
    const aproape = {
      publicat_la: "2026-08-01T08:00:00Z",
      expira_la: new Date(ACUM.getTime() + 1).toISOString(),
    };
    expect(stareAnunt(aproape, ACUM)).toBe("activ");
  });
});

describe("extrasAnunt", () => {
  it("lasă neatins un conținut mai scurt decât limita", () => {
    expect(extrasAnunt("Ședință vineri la ora 9.", 180)).toBe("Ședință vineri la ora 9.");
  });

  it("turtește rândurile goale dintre paragrafe", () => {
    expect(extrasAnunt("Primul paragraf.\n\n\nAl doilea.", 180)).toBe(
      "Primul paragraf. Al doilea.",
    );
  });

  it("taie pe cuvânt și pune puncte de suspensie", () => {
    const extras = extrasAnunt("unu doi trei patru cinci șase", 14);
    expect(extras).toBe("unu doi trei…");
    expect(extras.length).toBeLessThanOrEqual(15);
  });

  it("taie pe caracter când un singur cuvânt ar goli extrasul", () => {
    expect(extrasAnunt("a bbbbbbbbbbbbbbbbbbbbbbbbb", 10)).toBe("a bbbbbbbb…");
  });
});

describe("sfarsitulZileiRomania", () => {
  it("pune ora de vară pentru o zi din septembrie", () => {
    expect(sfarsitulZileiRomania("2026-09-30")).toBe("2026-09-30T23:59:59+03:00");
  });

  it("pune ora de iarnă pentru o zi din decembrie", () => {
    expect(sfarsitulZileiRomania("2026-12-31")).toBe("2026-12-31T23:59:59+02:00");
  });

  /**
   * Proba care contează de fapt: momentul întors trebuie să cadă în CHIAR ziua
   * aleasă, citită în ora României. Cu `T23:59:59Z` (fără decalaj) ar cădea a
   * doua zi la 02:59, iar lista ar scrie „expiră 01.10" pentru cine a ales 30.09.
   */
  it("momentul rămâne în ziua aleasă, citit în ora României", () => {
    for (const zi of ["2026-01-15", "2026-03-29", "2026-06-01", "2026-10-25", "2026-12-31"]) {
      expect(toBucharestDateString(new Date(sfarsitulZileiRomania(zi)))).toBe(zi);
    }
  });

  it("respinge o zi care nu e o dată", () => {
    expect(() => sfarsitulZileiRomania("nu-i o zi")).toThrow(TypeError);
  });
});

describe("filtruDinAdresa", () => {
  it("acceptă doar segmentele cunoscute", () => {
    expect(filtruDinAdresa("ciorne")).toBe("ciorne");
    expect(filtruDinAdresa("expirate")).toBe("expirate");
  });

  it("cade pe „toate” pentru orice altceva", () => {
    expect(filtruDinAdresa(undefined)).toBe("toate");
    expect(filtruDinAdresa("")).toBe("toate");
    expect(filtruDinAdresa("ștergeTot")).toBe("toate");
    // Next dă `string[]` pentru `?stare=a&stare=b`; nu e un segment valid.
    expect(filtruDinAdresa(["ciorne", "active"])).toBe("toate");
  });
});

describe("potrivesteFiltru", () => {
  it("„ciorne” cuprinde și programatele — amândouă sunt „firma nu le vede încă”", () => {
    expect(potrivesteFiltru("ciorna", "ciorne")).toBe(true);
    expect(potrivesteFiltru("programat", "ciorne")).toBe(true);
    expect(potrivesteFiltru("activ", "ciorne")).toBe(false);
  });

  it("„active” nu cuprinde programatele", () => {
    expect(potrivesteFiltru("programat", "active")).toBe(false);
    expect(potrivesteFiltru("activ", "active")).toBe(true);
  });

  it("„toate” lasă să treacă orice stare", () => {
    const stari: readonly StareAnunt[] = ["ciorna", "programat", "activ", "expirat"];
    expect(stari.every((s) => potrivesteFiltru(s, "toate"))).toBe(true);
  });
});

describe("numaraPeStari", () => {
  it("numără fiecare segment, cu programatele la ciorne", () => {
    expect(numaraPeStari(["activ", "activ", "ciorna", "programat", "expirat"])).toStrictEqual({
      toate: 5,
      active: 2,
      ciorne: 2,
      expirate: 1,
    });
  });

  it("lista goală dă zero peste tot", () => {
    expect(numaraPeStari([])).toStrictEqual({ toate: 0, active: 0, ciorne: 0, expirate: 0 });
  });
});
