import { describe, expect, it } from "vitest";

import {
  etichetaSediului,
  seAlegeSediul,
  sediulDeTrimis,
  sursaSediului,
  tipulPermiteSediu,
} from "./sediu";

describe("seAlegeSediul", () => {
  it("nu întreabă la o firmă cu un singur sediu", () => {
    expect(seAlegeSediul(0, "fara")).toBe(false);
    expect(seAlegeSediul(1, "optional")).toBe(false);
  });

  it("întreabă de la două sedii în sus", () => {
    expect(seAlegeSediul(2, "fara")).toBe(true);
    expect(seAlegeSediul(5, "optional")).toBe(true);
  });

  it("nu întreabă când firma cere codul QR — sediul vine din scanare", () => {
    expect(seAlegeSediul(3, "cod_qr")).toBe(false);
  });
});

describe("tipulPermiteSediu", () => {
  it("la birou și nedeclarat permit sediul", () => {
    expect(tipulPermiteSediu("birou")).toBe(true);
    expect(tipulPermiteSediu("")).toBe(true);
    expect(tipulPermiteSediu(null)).toBe(true);
  });

  it("homeoffice, deplasarea și delegația n-au sediu", () => {
    expect(tipulPermiteSediu("homeoffice")).toBe(false);
    expect(tipulPermiteSediu("deplasare")).toBe(false);
    expect(tipulPermiteSediu("delegatie")).toBe(false);
  });
});

describe("sediulDeTrimis", () => {
  it("trimite sediul ales pentru o zi la birou", () => {
    expect(sediulDeTrimis("birou", "s1")).toBe("s1");
  });

  it("șirul gol înseamnă sediul din contract, adică `null`", () => {
    expect(sediulDeTrimis("birou", "")).toBeNull();
  });

  // Purtătorul: un sediu ales înainte de a comuta pe homeoffice nu trebuie să
  // ajungă la bază — CHECK-ul l-ar refuza cu o eroare pe care omul n-a cauzat-o.
  it("stinge sediul rămas ales după comutarea pe homeoffice", () => {
    expect(sediulDeTrimis("homeoffice", "s1")).toBeNull();
  });
});

describe("sursaSediului și etichetaSediului", () => {
  const denumiri = new Map([
    ["s1", "Sediul Cluj"],
    ["s2", "Sediul Iași"],
  ]);

  it("scanatul bate declaratul — dovada are întâietate", () => {
    const zi = { punctLucruId: "s1", punctLucruDeclaratId: "s2" };
    expect(sursaSediului(zi)).toBe("scanat");
    expect(etichetaSediului(zi, denumiri)).toBe("Scanat la Sediul Cluj");
  });

  it("declaratul se scrie ca declarație", () => {
    const zi = { punctLucruId: null, punctLucruDeclaratId: "s2" };
    expect(etichetaSediului(zi, denumiri)).toBe("Declarat: Sediul Iași");
  });

  it("fără niciunul, sediul e cel din contract și nu se scrie nimic", () => {
    const zi = { punctLucruId: null, punctLucruDeclaratId: null };
    expect(sursaSediului(zi)).toBe("contract");
    expect(etichetaSediului(zi, denumiri)).toBeNull();
  });

  it("un sediu dispărut din listă se scrie generic, nu ca id", () => {
    const zi = { punctLucruId: null, punctLucruDeclaratId: "s9" };
    expect(etichetaSediului(zi, denumiri)).toBe("Declarat: un sediu inactiv");
  });
});
