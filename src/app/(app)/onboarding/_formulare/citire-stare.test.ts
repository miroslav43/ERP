// src/app/(app)/onboarding/_formulare/citire-stare.test.ts
//
// Drumul invers al asistentului: ce e în bază → starea ecranului, plus
// implicitele unui pas și ale unui șablon nou. Completează `citire.test.ts`,
// care acoperă drumul ecran → încărcătură.

import { describe, expect, it } from "vitest";

import { salveazaSablonSchema } from "@/schemas/checklist";

import {
  etapeImplicite,
  intrareSablon,
  numarPasi,
  pasNou,
  stareDinSablon,
  type EtapaCitita,
  type PasCitit,
  type SablonCitit,
} from "./citire";

const ETAPA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ETAPA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CURS = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MATERIAL = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ANGAJAT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const sablon: SablonCitit = {
  id: "11111111-1111-4111-8111-111111111111",
  denumire: "Integrare IT",
  tip: "onboarding",
  descriere: null,
  department_id: null,
  cod_cor: null,
  activ: true,
  valabil_de_la: "2026-01-01",
  valabil_pana_la: null,
};

const etape: readonly EtapaCitita[] = [
  { id: ETAPA_A, titlu: "Înainte de prima zi", descriere: null, termen_zile_relativ: -5 },
  { id: ETAPA_B, titlu: "Prima zi", descriere: "Primirea", termen_zile_relativ: 0 },
];

function pas(id: string, camp: Partial<PasCitit> = {}): PasCitit {
  return {
    id,
    titlu: `Pas ${id.slice(0, 4)}`,
    descriere: null,
    responsabil_tip: "subiect",
    responsabil_rol: null,
    responsabil_employee_id: null,
    termen_zile_relativ: 0,
    obligatoriu: true,
    tip_dovada: "bifa",
    verificare_automata: null,
    curs_id: null,
    material_id: null,
    etapa_id: null,
    ...camp,
  };
}

const P1 = "10000000-0000-4000-8000-000000000001";
const P2 = "10000000-0000-4000-8000-000000000002";
const P3 = "10000000-0000-4000-8000-000000000003";
const P4 = "10000000-0000-4000-8000-000000000004";

describe("stareDinSablon", () => {
  it("împarte pașii pe etapele lor și îi păstrează pe cei fără etapă separat", () => {
    const stare = stareDinSablon(sablon, etape, [
      pas(P1, { etapa_id: ETAPA_B }),
      pas(P2, { etapa_id: null }),
      pas(P3, { etapa_id: ETAPA_A }),
      pas(P4, { etapa_id: ETAPA_B }),
    ]);
    expect(stare.etape.map((e) => e.pasi.map((p) => p.id))).toEqual([[P3], [P1, P4]]);
    expect(stare.pasi_fara_etapa.map((p) => p.id)).toEqual([P2]);
    expect(numarPasi(stare)).toBe(4);
  });

  it("un șablon dinainte de etape (0089) ajunge întreg în „Fără etapă”", () => {
    const stare = stareDinSablon(sablon, [], [pas(P1), pas(P2)]);
    expect(stare.etape).toEqual([]);
    expect(stare.pasi_fara_etapa.map((p) => p.id)).toEqual([P1, P2]);
  });

  it("NULL-urile din bază devin șiruri goale, numerele devin text — forma unui formular", () => {
    const stare = stareDinSablon(sablon, etape, [pas(P1, { termen_zile_relativ: -3 })]);
    expect(stare).toMatchObject({
      descriere: "",
      department_id: "",
      cod_cor: "",
      valabil_pana_la: "",
    });
    expect(stare.etape[0]).toMatchObject({ descriere: "", termen_zile_relativ: "-5" });
    expect(stare.pasi_fara_etapa[0]).toMatchObject({
      descriere: "",
      responsabil_rol: "",
      responsabil_employee_id: "",
      curs_id: "",
      material_id: "",
      termen_zile_relativ: "-3",
    });
  });

  it.each([
    ["curs", { verificare_automata: "curs_finalizat", curs_id: CURS }],
    ["automat", { verificare_automata: "inventar_returnat" }],
    ["citire", { material_id: MATERIAL }],
    ["fisier", { tip_dovada: "document" }],
    ["semnatura", { tip_dovada: "semnatura" }],
    ["bifa", {}],
  ] as const)("coloanele pasului ⇒ cardul `%s`", (fel, camp) => {
    const stare = stareDinSablon(sablon, [], [pas(P1, camp)]);
    expect(stare.pasi_fara_etapa[0]?.fel).toBe(fel);
  });

  it("dus-întors: starea citită, retrimisă, trece de schema acțiunii cu aceleași id-uri", () => {
    const stare = stareDinSablon(
      { ...sablon, valabil_pana_la: "2027-01-01", cod_cor: null },
      etape,
      [
        pas(P1, { etapa_id: ETAPA_A, responsabil_tip: "rol", responsabil_rol: "hr" }),
        pas(P2, {
          etapa_id: ETAPA_B,
          responsabil_tip: "angajat",
          responsabil_employee_id: ANGAJAT,
          verificare_automata: "curs_finalizat",
          curs_id: CURS,
        }),
        pas(P3, { material_id: MATERIAL }),
      ],
    );

    const rezultat = salveazaSablonSchema.safeParse(intrareSablon(stare));
    expect(rezultat.success).toBe(true);
    if (!rezultat.success) return;
    expect(rezultat.data.id).toBe(sablon.id);
    expect(rezultat.data.etape.map((e) => e.id)).toEqual([ETAPA_A, ETAPA_B]);
    expect(rezultat.data.etape[0]?.pasi[0]).toMatchObject({
      id: P1,
      responsabil_tip: "rol",
      responsabil_rol: "hr",
      responsabil_employee_id: null,
    });
    expect(rezultat.data.etape[1]?.pasi[0]).toMatchObject({
      id: P2,
      responsabil_employee_id: ANGAJAT,
      verificare_automata: "curs_finalizat",
      curs_id: CURS,
    });
    expect(rezultat.data.pasi_fara_etapa[0]).toMatchObject({ id: P3, material_id: MATERIAL });
  });
});

describe("pasNou", () => {
  it("un pas nou e făcut de angajatul integrat, obligatoriu, bifă simplă, termen 0", () => {
    expect(pasNou()).toEqual({
      titlu: "",
      descriere: "",
      fel: "bifa",
      responsabil_tip: "subiect",
      responsabil_rol: "",
      responsabil_employee_id: "",
      termen_zile_relativ: "0",
      obligatoriu: true,
      curs_id: "",
      material_id: "",
    });
  });

  it("întoarce de fiecare dată un obiect nou, fără `id`", () => {
    const a = pasNou();
    expect(a).not.toBe(pasNou());
    expect(a).not.toHaveProperty("id");
  });
});

describe("etapeImplicite", () => {
  it("propune patru etape goale, cu termenul de dinainte de prima zi negativ", () => {
    const lista = etapeImplicite();
    expect(lista.map((e) => [e.titlu, e.termen_zile_relativ])).toEqual([
      ["Înainte de prima zi", "-5"],
      ["Prima zi", "0"],
      ["Prima săptămână", "7"],
      ["Prima lună", "30"],
    ]);
    for (const etapa of lista) {
      expect(etapa.pasi).toEqual([]);
      expect(etapa).not.toHaveProperty("id");
    }
  });

  it("un șablon doar cu etapele implicite nu trece de schemă: zero pași (D10)", () => {
    const stare = {
      ...stareDinSablon(sablon, [], []),
      etape: etapeImplicite(),
    };
    const { id: _id, ...faraId } = stare;
    const rezultat = salveazaSablonSchema.safeParse(intrareSablon(faraId));
    expect(rezultat.success).toBe(false);
  });
});
