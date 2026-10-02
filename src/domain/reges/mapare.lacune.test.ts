// src/domain/reges/mapare.lacune.test.ts
//
// Lacuna confirmată de audit: `mapeazaReactivare`, folosit de
// `reluare_activitate` și `reluare_nemotivata`, era singurul mapator de acțiune
// fără test. Capcanele din `mesaj.ts`: `$type` obligatoriu pe obiectul imbricat,
// data ca moment la miezul zilei UTC, câmpul opțional OMIS, nu trimis ca "".

import { describe, expect, it } from "vitest";

import { mapeazaReactivare } from "./mapare";

const CTX = {
  messageId: "117f9b03-9efb-4f5a-8ebb-7ab3b0c792ae",
  autorId: "e259e758-e165-41fb-b81f-2be7358dd46d",
  sesiuneId: "117f9b04-9efb-4f5e-8ebb-7ab3b0c792cf",
  utilizator: "Maria Popescu",
  cand: new Date("2026-06-18T14:19:58.917Z"),
};

const CONTRACT = "4f8c2a1e-0b3d-4c5e-9f6a-7b8c9d0e1f2a";

describe("mapeazaReactivare", () => {
  it("fără temei legal: antet de reactivare, referință tipată, acțiune fără cheia temeiLegal", () => {
    const m = mapeazaReactivare(CONTRACT, { data: "2026-03-14", temeiLegal: null }, CTX);
    expect(m.$type).toBe("contract");
    expect(m.header.operation).toBe("ReactivareContract");
    expect(m.header.messageId).toBe(CTX.messageId);
    expect(m.referintaContract).toEqual({ $type: "referinta", id: CONTRACT });
    expect(m.actiune).toEqual({
      $type: "actiuneReactivare",
      dataReactivare: "2026-03-14T12:00:00.000Z",
    });
  });

  it.each([null, "", "   "])("un temei gol (%j) e omis, nu trimis ca șir gol", (temeiLegal) => {
    const m = mapeazaReactivare(CONTRACT, { data: "2026-03-14", temeiLegal }, CTX);
    expect(m.actiune === undefined ? false : "temeiLegal" in m.actiune).toBe(false);
  });

  it("temeiul legal se trimite curățat de spații", () => {
    const m = mapeazaReactivare(CONTRACT, { data: "2026-03-14", temeiLegal: "  Art. 52  " }, CTX);
    expect(m.actiune).toEqual({
      $type: "actiuneReactivare",
      dataReactivare: "2026-03-14T12:00:00.000Z",
      temeiLegal: "Art. 52",
    });
  });
});
