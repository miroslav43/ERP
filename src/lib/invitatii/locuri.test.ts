// src/lib/invitatii/locuri.test.ts
//
// Aritmetica locurilor din contract (ONB-027): ecranul de membri și refuzul din
// `creeazaInvitatie` numără din același loc — membri activi + invitații în
// așteptare — ca să nu spună ecranul „4 locuri libere" când refuzul vine la a
// patra invitație.

import { describe, expect, it } from "vitest";

import { numaraLocuri } from "./locuri";

describe("numaraLocuri", () => {
  it("5 membri + 1 invitație din 10: 6 folosite, 4 rămase, nu e plin", () => {
    expect(numaraLocuri({ membriActivi: 5, invitatiiPendinte: 1, limita: 10 })).toEqual({
      folosite: 6,
      limita: 10,
      ramase: 4,
      plin: false,
    });
  });

  it("9 membri + 1 invitație din 10: plin, zero rămase", () => {
    expect(numaraLocuri({ membriActivi: 9, invitatiiPendinte: 1, limita: 10 })).toMatchObject({
      folosite: 10,
      ramase: 0,
      plin: true,
    });
  });

  it("peste plafon (plafon coborât după): plin, iar rămase nu coboară sub zero", () => {
    expect(numaraLocuri({ membriActivi: 12, invitatiiPendinte: 0, limita: 10 })).toMatchObject({
      ramase: 0,
      plin: true,
    });
  });

  it("fără plafon: niciodată plin, rămase null", () => {
    expect(numaraLocuri({ membriActivi: 50, invitatiiPendinte: 3, limita: null })).toEqual({
      folosite: 53,
      limita: null,
      ramase: null,
      plin: false,
    });
  });
});
