// src/domain/fleet/tipuri-document.test.ts
import { describe, expect, it } from "vitest";

import {
  aplicaSetariTipuri,
  codDinDenumire,
  tipuriPentruDocument,
  type TipBrut,
} from "./tipuri-document";

const ORG = "org-1";

function tip(p: Partial<TipBrut> & Pick<TipBrut, "id" | "cod">): TipBrut {
  return {
    organization_id: null,
    denumire: p.cod.toUpperCase(),
    descriere: null,
    cere_expirare: true,
    obligatoriu: false,
    ordine: 100,
    activ: true,
    categorii_aplicabile: null,
    masa_max_kg: null,
    ...p,
  };
}

describe("aplicaSetariTipuri", () => {
  const RCA = tip({ id: "rca", cod: "rca", obligatoriu: true, ordine: 20 });
  const ADR = tip({ id: "adr", cod: "adr", activ: false, ordine: 110 });
  const CASCO = tip({ id: "casco", cod: "casco", ordine: 30 });
  const PROPRIU = tip({ id: "p", cod: "autorizatie", organization_id: ORG, ordine: 5 });

  it("fără setări, valorile platformei rămân", () => {
    const [rca] = aplicaSetariTipuri([RCA], []);
    expect(rca).toMatchObject({
      id: "rca",
      activ: true,
      obligatoriu: true,
      propriu: false,
      setare: null,
    });
  });

  it("setarea firmei activează un tip retras din platformă (ADR, 0116)", () => {
    const [adr] = aplicaSetariTipuri(
      [ADR],
      [{ document_type_id: "adr", activ: true, obligatoriu: true }],
    );
    expect(adr).toMatchObject({ activ: true, obligatoriu: true, activ_platforma: false });
  });

  it("setarea firmei retrage un tip activ, iar un tip retras nu mai e obligatoriu", () => {
    const [rca] = aplicaSetariTipuri(
      [RCA],
      [{ document_type_id: "rca", activ: false, obligatoriu: true }],
    );
    expect(rca).toMatchObject({ activ: false, obligatoriu: false });
  });

  it("schimbă doar obligativitatea, cu tipul rămas activ", () => {
    const [casco] = aplicaSetariTipuri(
      [CASCO],
      [{ document_type_id: "casco", activ: true, obligatoriu: true }],
    );
    expect(casco).toMatchObject({ activ: true, obligatoriu: true, obligatoriu_platforma: false });
  });

  it("tipul propriu se ține de rândul lui; o setare rătăcită pe el se ignoră", () => {
    // Baza refuză setarea pe un tip propriu (0202 §3). Dacă una ar ajunge totuși
    // aici, două adevăruri pentru același tip ar fi exact ce evităm.
    const [p] = aplicaSetariTipuri(
      [PROPRIU],
      [{ document_type_id: "p", activ: false, obligatoriu: true }],
    );
    expect(p).toMatchObject({ propriu: true, activ: true, obligatoriu: false, setare: null });
  });

  it("ordonează după `ordine`, apoi după denumire", () => {
    const ids = aplicaSetariTipuri([ADR, CASCO, RCA, PROPRIU], []).map((t) => t.id);
    expect(ids).toEqual(["p", "rca", "casco", "adr"]);
  });
});

describe("codDinDenumire", () => {
  it("scoate diacriticele și pune `_` între cuvinte", () => {
    expect(codDinDenumire("Autorizație de transport județean")).toBe(
      "autorizatie_de_transport_judetean",
    );
  });

  it("începe mereu cu o literă, ca `vdt_cod_ck` și `expirables.kind`", () => {
    expect(codDinDenumire("2024 — verificare")).toBe("tip_2024_verificare");
  });

  it("taie la 48 de caractere, fără `_` la coadă", () => {
    const cod = codDinDenumire("a".repeat(30) + " " + "b".repeat(30));
    expect(cod.length).toBeLessThanOrEqual(48);
    expect(cod.endsWith("_")).toBe(false);
    expect(cod).toMatch(/^[a-z][a-z0-9_]{1,48}$/u);
  });

  it("o denumire fără nicio literă latină dă totuși un cod valid", () => {
    expect(codDinDenumire("—")).toMatch(/^[a-z][a-z0-9_]{1,48}$/u);
  });
});

describe("tipuriPentruDocument", () => {
  const ITP = { id: "itp", activ: true };
  const RCA = { id: "rca", activ: true };
  const CASCO_RETRAS = { id: "casco", activ: false };
  const nomenclator = [ITP, RCA, CASCO_RETRAS];

  it("un document pe un tip activ primește doar tipurile active", () => {
    expect(tipuriPentruDocument(nomenclator, "rca").map((t) => t.id)).toEqual(["itp", "rca"]);
  });

  it("un document pe un tip RETRAS își păstrează tipul în listă, ca să se poată corecta fără să-l schimbe", () => {
    // Fără el, `<select defaultValue>` nu găsește opțiunea, cade pe „Alegeți
    // tipul”, iar documentul nu se mai poate salva decât mutat pe alt tip.
    expect(tipuriPentruDocument(nomenclator, "casco").map((t) => t.id)).toEqual([
      "itp",
      "rca",
      "casco",
    ]);
  });

  it("un id necunoscut nu adaugă nimic", () => {
    expect(tipuriPentruDocument(nomenclator, "lipsa").map((t) => t.id)).toEqual(["itp", "rca"]);
  });
});
