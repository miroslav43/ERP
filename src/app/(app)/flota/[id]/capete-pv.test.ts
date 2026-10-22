// src/app/(app)/flota/[id]/capete-pv.test.ts
import { describe, expect, it } from "vitest";

import type { RandPv } from "@/lib/queries/fleet-pv";

import {
  capatDinParametri,
  capeteFaraPv,
  capetePv,
  descriereParti,
  eAlocareDinIstoric,
  hrefPvNou,
  type AlocarePentruPv,
} from "./capete-pv";

const A: AlocarePentruPv = {
  id: "a",
  employee_id: "ana",
  de_la: "2026-09-01T07:00:00.000Z",
  pana_la: "2026-10-01T07:00:00.000Z",
  sofer: "Popescu Ana",
};
// Predarea către Bogdan a închis-o pe a Anei (regula 2): capete lipite.
// PostgREST întoarce `+00:00`, nu `Z`: comparația e pe moment, nu pe text.
const B: AlocarePentruPv = {
  id: "b",
  employee_id: "bogdan",
  de_la: "2026-10-01T07:00:00+00:00",
  pana_la: null,
  sofer: "Ionescu Bogdan",
};

function pv(peste: Partial<RandPv>): RandPv {
  return {
    id: "pv",
    tip: "predare",
    moment: "2026-09-01T07:00:00.000Z",
    stare: "finalizat",
    numar: "PVA-2026-0001",
    numar_registru: null,
    alocare_predata_id: null,
    alocare_primita_id: null,
    anulat_la: null,
    confirmat_predator_la: null,
    confirmat_primitor_la: null,
    ...peste,
  };
}

describe("capetePv", () => {
  it("predarea lui B, lipită de alocarea Anei, se propune ca transfer", () => {
    const capete = capetePv([B, A], []);
    expect(capete.get("b")?.predare).toEqual({
      pv: null,
      nou: { predata: "a", primita: "b" },
      transferCu: "Popescu Ana",
      acelasiSofer: false,
    });
    expect(capete.get("a")?.restituire?.nou).toEqual({ predata: "a", primita: "b" });
    expect(capete.get("b")?.restituire).toBeNull();
  });

  it("PV-ul viu acoperă capătul; cel anulat nu", () => {
    const transfer = pv({
      id: "t",
      tip: "transfer",
      alocare_predata_id: "a",
      alocare_primita_id: "b",
    });
    const capete = capetePv([B, A], [transfer]);
    expect(capete.get("b")?.predare.pv?.id).toBe("t");
    expect(capete.get("a")?.restituire?.pv?.id).toBe("t");

    const anulat = capetePv([B, A], [{ ...transfer, anulat_la: "2026-10-02T00:00:00Z" }]);
    expect(anulat.get("b")?.predare.pv).toBeNull();
    expect(anulat.get("b")?.predare.nou).toEqual({ predata: "a", primita: "b" });
  });

  it("două alocări lipite ale aceluiași om nu sunt o predare: nimic propus", () => {
    const a2: AlocarePentruPv = { ...B, id: "a2", employee_id: "ana", sofer: "Popescu Ana" };
    const capete = capetePv([a2, A], []);
    expect(capete.get("a2")?.predare).toMatchObject({ nou: null, acelasiSofer: true });
    expect(capete.get("a")?.restituire).toMatchObject({ nou: null, acelasiSofer: true });
  });

  it("restituirea fără succesor e o restituire către firmă", () => {
    const capete = capetePv([A], []);
    expect(capete.get("a")?.restituire?.nou).toEqual({ predata: "a", primita: null });
    expect(capete.get("a")?.predare.nou).toEqual({ predata: null, primita: "a" });
  });

  it("capeteFaraPv numără transferul o singură dată", () => {
    expect(capeteFaraPv(capetePv([B, A], []))).toBe(2); // predarea Anei + transferul A → B
    expect(capeteFaraPv(capetePv([A], []))).toBe(2); // predarea + restituirea Anei
  });
});

describe("capatDinParametri", () => {
  const capete = capetePv([B, A], []);

  it("`?pv=nou&primita=b` venit după predare devine transfer", () => {
    expect(capatDinParametri(capete, null, "b")).toEqual({ predata: "a", primita: "b" });
  });

  it("`?pv=nou&predata=a` venit după restituire găsește succesorul", () => {
    expect(capatDinParametri(capete, "a", null)).toEqual({ predata: "a", primita: "b" });
  });

  it("o pereche care nu se potrivește sau o alocare străină nu deschide nimic", () => {
    expect(capatDinParametri(capete, "x", "b")).toBeNull();
    expect(capatDinParametri(capete, null, "necunoscuta")).toBeNull();
    expect(capatDinParametri(capete, null, null)).toBeNull();
  });
});

describe("hrefPvNou", () => {
  it("parametrii în URL", () => {
    expect(hrefPvNou("v", { predata: "a", primita: "b" })).toBe(
      "/flota/v?pv=nou&predata=a&primita=b",
    );
    expect(hrefPvNou("v", { predata: null, primita: "b" })).toBe("/flota/v?pv=nou&primita=b");
  });
});

describe("eAlocareDinIstoric și descriereParti", () => {
  it("recunoaște alocarea din backfill-ul 0173", () => {
    expect(
      eAlocareDinIstoric(
        "Alocare preluată din fișa vehiculului la introducerea istoricului (0173).",
      ),
    ).toBe(true);
    expect(eAlocareDinIstoric(null)).toBe(false);
    expect(eAlocareDinIstoric("Predare obișnuită")).toBe(false);
  });

  it("descrie părțile după capete", () => {
    expect(descriereParti("Popescu Ana", "Ionescu Bogdan")).toBe(
      "Transfer de la Popescu Ana către Ionescu Bogdan",
    );
    expect(descriereParti(null, "Ionescu Bogdan")).toBe("Predare de la firmă către Ionescu Bogdan");
    expect(descriereParti("Popescu Ana", null)).toBe("Restituire de la Popescu Ana către firmă");
  });
});
