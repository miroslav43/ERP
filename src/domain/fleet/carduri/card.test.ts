import { describe, expect, it } from "vitest";

import {
  cifreDeSalvat,
  cifreFinaleCard,
  cifreSePotrivesc,
  mascheaza,
  mascheazaSecvente,
  ultimaZiALunii,
  valabilitateScurta,
} from "./card";

describe("cifreFinaleCard", () => {
  it("„7002 5100 0000 1234” → număr întreg de 16 cifre", () => {
    expect(cifreFinaleCard("7002 5100 0000 1234")).toEqual({
      finale: "001234",
      intreg: "7002510000001234",
    });
  });

  it("„**** **** **** 1234” → doar „1234”, fără număr întreg", () => {
    expect(cifreFinaleCard("**** **** **** 1234")).toEqual({ finale: "1234", intreg: null });
  });

  it("„1234” → 4 cifre", () => {
    expect(cifreFinaleCard("1234")).toEqual({ finale: "1234", intreg: null });
  });

  it("cratimele și spațiile se ignoră", () => {
    expect(cifreFinaleCard("7002-5100-0000-1234")?.intreg).toBe("7002510000001234");
  });

  it.each(["", "fără cifre", "123", "CARD"])("„%s” → null", (text) => {
    expect(cifreFinaleCard(text)).toBeNull();
  });
});

describe("cifreDeSalvat", () => {
  it("din numărul întreg rămân ultimele 4; altfel toate (4–6)", () => {
    expect(cifreDeSalvat({ finale: "001234", intreg: "7002510000001234" })).toBe("1234");
    expect(cifreDeSalvat({ finale: "561234", intreg: null })).toBe("561234");
  });
});

describe("mascheaza", () => {
  it("afișează doar cifrele salvate", () => {
    expect(mascheaza("1234")).toBe("•••• 1234");
  });

  it("orice secvență de ≥ 12 cifre din eșantion devine „•••• 1234”", () => {
    const text = "Card 7002 5100 0000 1234, bon 12345, PAN 7002510000005678";
    const mascat = mascheazaSecvente(text);
    expect(mascat).toBe("Card •••• 1234, bon 12345, PAN •••• 5678");
    expect(/\d{12,}/u.test(mascat.replace(/[\s-]/gu, ""))).toBe(false);
  });
});

describe("cifreSePotrivesc", () => {
  it("pe sufix: card cu 4 cifre, extras cu 6, și invers", () => {
    expect(cifreSePotrivesc("1234", "561234")).toBe(true);
    expect(cifreSePotrivesc("561234", "1234")).toBe(true);
    expect(cifreSePotrivesc("1234", "561235")).toBe(false);
  });

  it("sub 4 cifre nu se potrivește nimic", () => {
    expect(cifreSePotrivesc("234", "1234")).toBe(false);
  });
});

describe("valabilitate", () => {
  it("ultima zi a lunii, inclusiv februarie bisect", () => {
    expect(ultimaZiALunii(2027, 9)).toBe("2027-09-30");
    expect(ultimaZiALunii(2028, 2)).toBe("2028-02-29");
    expect(ultimaZiALunii(2027, 2)).toBe("2027-02-28");
  });

  it("forma scurtă LL/AAAA", () => {
    expect(valabilitateScurta("2027-09-30")).toBe("09/2027");
    expect(valabilitateScurta(null)).toBeNull();
  });
});
