import { describe, expect, it } from "vitest";

import { CHECKLIST_FEL_PAS } from "@/schemas/checklist";

import {
  campuriDinFel,
  etapeImplicite,
  felDinCampuri,
  intrareSablon,
  muta,
  numarPasi,
  pasNou,
  type StareSablon,
} from "./citire";

function sablon(partial: Partial<StareSablon> = {}): StareSablon {
  return {
    denumire: "Integrare dezvoltator",
    tip: "onboarding",
    descriere: "",
    department_id: "",
    cod_cor: "",
    activ: true,
    valabil_de_la: "2026-01-01",
    valabil_pana_la: "",
    etape: [],
    pasi_fara_etapa: [],
    ...partial,
  };
}

describe("campuriDinFel / felDinCampuri", () => {
  it("acoperă fiecare fel din enum, fără să cadă pe implicit", () => {
    // Dacă cineva adaugă o valoare în `checklist_fel_pas` fără s-o trateze
    // aici, dus-întorsul de mai jos o prinde: ar ateriza pe „bifa".
    expect(CHECKLIST_FEL_PAS.length).toBe(6);
  });

  it.each(CHECKLIST_FEL_PAS)("dus-întors pentru „%s”", (fel) => {
    const campuri = campuriDinFel(fel);
    // `citire` nu se poate reconstitui din `tip_dovada`/`verificare_automata`:
    // e distins de PREZENȚA materialului, exact ca în `app.checklist_fel_derivat`
    // după 0093. Al treilea argument nu e un ocol al testului, e contractul.
    const material = fel === "citire" ? "44444444-4444-4444-4444-444444444444" : null;
    expect(felDinCampuri(campuri.tip_dovada, campuri.verificare_automata || null, material)).toBe(
      fel,
    );
  });

  it("un material impune `obligatoriu`, ca `_material_ck`", () => {
    expect(campuriDinFel("citire")).toMatchObject({
      tip_dovada: "bifa",
      verificare_automata: "",
      obligatoriuImpus: true,
    });
  });

  it("oglindește app.checklist_fel_derivat, caz cu caz", () => {
    expect(campuriDinFel("bifa")).toMatchObject({ tip_dovada: "bifa", verificare_automata: "" });
    expect(campuriDinFel("fisier")).toMatchObject({ tip_dovada: "document" });
    expect(campuriDinFel("semnatura")).toMatchObject({ tip_dovada: "semnatura" });
    expect(campuriDinFel("curs")).toMatchObject({
      tip_dovada: "bifa",
      verificare_automata: "curs_finalizat",
    });
    expect(campuriDinFel("automat")).toMatchObject({
      tip_dovada: "bifa",
      verificare_automata: "inventar_returnat",
    });
  });

  it("impune `obligatoriu` exact acolo unde o cere `_automat_ck`", () => {
    expect(campuriDinFel("curs").obligatoriuImpus).toBe(true);
    expect(campuriDinFel("automat").obligatoriuImpus).toBe(true);
    expect(campuriDinFel("bifa").obligatoriuImpus).toBe(false);
    expect(campuriDinFel("fisier").obligatoriuImpus).toBe(false);
    expect(campuriDinFel("semnatura").obligatoriuImpus).toBe(false);
  });
});

describe("intrareSablon", () => {
  it("trimite doar câmpul responsabilului ales, nu și pe celălalt", () => {
    const stare = sablon({
      etape: [
        {
          titlu: "Prima zi",
          descriere: "",
          termen_zile_relativ: "0",
          pasi: [
            {
              ...pasNou(),
              titlu: "Semnează contractul",
              responsabil_tip: "rol",
              responsabil_rol: "hr",
              // A rămas scris dintr-o alegere anterioară; nu are voie să plece.
              responsabil_employee_id: "11111111-1111-1111-1111-111111111111",
            },
          ],
        },
      ],
    });
    const pas = intrareSablon(stare).etape?.[0]?.pasi?.[0];
    expect(pas?.responsabil_rol).toBe("hr");
    expect(pas?.responsabil_employee_id).toBe("");
  });

  it("forțează `obligatoriu` pentru pașii cu verificare automată", () => {
    const stare = sablon({
      etape: [
        {
          titlu: "Prima săptămână",
          descriere: "",
          termen_zile_relativ: "7",
          pasi: [{ ...pasNou(), titlu: "Curs SSM", fel: "curs", obligatoriu: false, curs_id: "c" }],
        },
      ],
    });
    expect(intrareSablon(stare).etape?.[0]?.pasi?.[0]?.obligatoriu).toBe(true);
  });

  it("nu trimite `material_id` decât pentru pașii de citire — oglinda lui `_material_ck`", () => {
    const stare = sablon({
      pasi_fara_etapa: [{ ...pasNou(), titlu: "Bifă simplă", material_id: "ramas" }],
    });
    expect(intrareSablon(stare).pasi_fara_etapa?.[0]?.material_id).toBe("");
  });

  it("nu trimite `curs_id` decât pentru pașii de tip curs — oglinda lui `_curs_ck`", () => {
    const stare = sablon({
      pasi_fara_etapa: [{ ...pasNou(), titlu: "Bifă simplă", curs_id: "ramas-din-alta-alegere" }],
    });
    expect(intrareSablon(stare).pasi_fara_etapa?.[0]?.curs_id).toBe("");
  });

  it("păstrează etapele goale: ștergerea lor tăcută ar arunca munca omului", () => {
    const stare = sablon({ etape: [...etapeImplicite()] });
    expect(intrareSablon(stare).etape).toHaveLength(4);
  });

  it("omite `id` la creare și îl trimite la editare", () => {
    expect(intrareSablon(sablon()).id).toBeUndefined();
    expect(intrareSablon(sablon({ id: "abc" })).id).toBe("abc");
  });
});

describe("numarPasi", () => {
  it("adună peste toate etapele și pașii fără etapă", () => {
    const stare = sablon({
      etape: [
        { titlu: "A", descriere: "", termen_zile_relativ: "0", pasi: [pasNou(), pasNou()] },
        { titlu: "B", descriere: "", termen_zile_relativ: "7", pasi: [] },
      ],
      pasi_fara_etapa: [pasNou()],
    });
    expect(numarPasi(stare)).toBe(3);
  });
});

describe("muta", () => {
  it("mută elementul și lasă restul în ordine", () => {
    expect(muta([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(muta([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
  });

  it("nu face nimic în afara marginilor — butonul de la capăt e dezactivat, dar nu ne bazăm pe el", () => {
    const lista = [1, 2, 3];
    expect(muta(lista, 0, -1)).toBe(lista);
    expect(muta(lista, 0, 3)).toBe(lista);
    expect(muta(lista, 1, 1)).toBe(lista);
  });
});
