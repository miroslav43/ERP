import { describe, expect, it } from "vitest";

import { atribuieOrdinale, bazaCheii, cheieDedup, type DateDedup } from "./dedup";

const rand: DateDedup = {
  idTranzactie: null,
  cifreCard: "1234",
  nrInmatriculare: null,
  moment: "2026-10-05T11:02:30.000Z",
  cantitate: 52.3,
  valoare: 380.15,
  produs: "Motorină",
  statie: "Stația București Nord",
};

describe("cheieDedup", () => {
  it("aceeași tranzacție citită din UTF-8 și din ANSI (sedilă) dă aceeași cheie", () => {
    const ansi = { ...rand, statie: "Staţia Bucureşti Nord", produs: "Motorină" };
    expect(cheieDedup(ansi, "omv_petrom")).toBe(cheieDedup(rand, "omv_petrom"));
  });

  it("secundele nu contează: cheia e pe minut", () => {
    expect(cheieDedup({ ...rand, moment: "2026-10-05T11:02:59.000Z" }, "mol")).toBe(
      cheieDedup(rand, "mol"),
    );
  });

  it("cu ID de tranzacție: `id:` + ID-ul, fără ordinal", () => {
    expect(cheieDedup({ ...rand, idTranzactie: " TX-998877 " }, "dkv")).toBe("id:TX-998877");
  });

  it("emitentul face parte din cheie", () => {
    expect(bazaCheii(rand, "mol")).not.toBe(bazaCheii(rand, "omv_petrom"));
  });

  it("forma cheii hash: `h:` + 64 de hexa + `#n`", () => {
    expect(cheieDedup(rand, "mol")).toMatch(/^h:[0-9a-f]{64}#1$/u);
  });
});

describe("atribuieOrdinale", () => {
  it("două rânduri identice în fișier → #1 și #2; reimportul dă aceleași chei", () => {
    const baza = bazaCheii(rand, "mol");
    const alta = bazaCheii({ ...rand, valoare: 1 }, "mol");
    const chei = atribuieOrdinale([baza, alta, baza]);
    expect(chei).toEqual([`${baza}#1`, `${alta}#1`, `${baza}#2`]);
    expect(atribuieOrdinale([baza, alta, baza])).toEqual(chei);
  });

  it("cheile `id:` rămân neschimbate", () => {
    expect(atribuieOrdinale(["id:1", "id:1"])).toEqual(["id:1", "id:1"]);
  });
});
