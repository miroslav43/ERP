// src/app/(portal)/portal/pontajul-meu/grila-luna.test.ts
//
// Regula de clicabilitate a fost greșită de la început: cerea ca ziua să aibă
// DEJA un pontaj `lucratoare`. Pe o zi goală, `intrare` e `undefined`, celula se
// randa ca `<div>` în loc de legătură, iar clicul nu făcea nimic — deci ca să
// pontezi o zi trebuia s-o fi pontat deja. Din portal nu se putea ponta nimic
// nou, deloc.
//
// Defectul a trăit nevăzut fiindcă predicatul stătea într-un JSX. Aici e scos
// și apărat.
import { describe, expect, it } from "vitest";

import { motivulBlocarii, ziuaSePoateDeschide } from "./grila-luna";

const LIBERA = undefined;
const PONTATA = { approved_at: null, leave_request_id: null };

describe("ziuaSePoateDeschide", () => {
  it("o zi GOALĂ se poate deschide — cazul care nu mergea", () => {
    expect(ziuaSePoateDeschide(true, LIBERA)).toBe(true);
  });

  it("o zi pontată, neaprobată, se poate corecta", () => {
    expect(ziuaSePoateDeschide(true, PONTATA)).toBe(true);
  });

  it("o zi APROBATĂ nu se deschide — politica ar respinge-o tăcut", () => {
    expect(ziuaSePoateDeschide(true, { ...PONTATA, approved_at: "2026-09-10T10:00:00Z" })).toBe(
      false,
    );
  });

  it("o zi din CONCEDIU nu se deschide — se modifică din Concedii", () => {
    expect(
      ziuaSePoateDeschide(true, {
        ...PONTATA,
        leave_request_id: "c4aab7eb-0000-4000-8000-000000000000",
      }),
    ).toBe(false);
  });

  it("fără drept de scriere, nimic nu se deschide", () => {
    expect(ziuaSePoateDeschide(false, LIBERA)).toBe(false);
    expect(ziuaSePoateDeschide(false, PONTATA)).toBe(false);
  });

  it("NU se uită la tipul zilei", () => {
    // Vechea regulă cerea `tip_zi === "lucratoare"`, ceea ce bloca și weekendul
    // lucrat, și sărbătoarea lucrată — zile care CHIAR se pontează, cu spor.
    const weekendLucrat = { approved_at: null, leave_request_id: null };
    expect(ziuaSePoateDeschide(true, weekendLucrat)).toBe(true);
  });
});

/*
  O zi RESPINSĂ trebuie să rămână deschisă pentru corecție.

  Respingerea nu e o interdicție, ci o cerere: `public.decide_zi_pontaj` (0067)
  scrie `respins_la` și ȘTERGE `approved_at`, tocmai ca omul să poată intra din
  nou peste ea. Dacă regula de clicabilitate ar începe vreodată să se uite și
  la respingere, ziua ar rămâne blocată exact în starea în care i se cere să
  fie schimbată — o fundătură perfect tăcută.
*/
describe("ziuaSePoateDeschide — ziua respinsă", () => {
  it("o zi respinsă se poate corecta, fiindcă respingerea a șters aprobarea", () => {
    expect(ziuaSePoateDeschide(true, { approved_at: null, leave_request_id: null })).toBe(true);
  });

  it("o zi respinsă și apoi reaprobată nu se mai deschide", () => {
    expect(
      ziuaSePoateDeschide(true, { approved_at: "2026-09-11T08:00:00Z", leave_request_id: null }),
    ).toBe(false);
  });
});

/*
  Motivul blocării — reclamat pe 11 sept 2026 ca „pe unele zile pot să dau
  click și pe unele nu".

  `ziuaSePoateDeschide` spunea corect DA sau NU, dar celula neclicabilă se
  randa mută. Pe un calendar amestecat, un refuz fără motiv arată exact ca un
  defect. Cele două motive reale sunt aprobarea și concediul; regula lor stă
  acum lângă cea de clicabilitate, ca să nu se poată despărți.
*/
describe("motivulBlocarii", () => {
  it("ziua aprobată spune că e aprobată", () => {
    const motiv = motivulBlocarii(true, {
      approved_at: "2026-09-10T10:00:00Z",
      leave_request_id: null,
    });
    expect(motiv).toContain("aprobată");
  });

  it("ziua din concediu trimite la modulul de concedii", () => {
    const motiv = motivulBlocarii(true, { approved_at: null, leave_request_id: "cerere-1" });
    expect(motiv).toContain("Concediile mele");
  });

  it("ziua liberă n-are motiv de blocare", () => {
    expect(motivulBlocarii(true, undefined)).toBeNull();
  });

  it("ziua pontată și nedecisă n-are motiv de blocare", () => {
    expect(motivulBlocarii(true, { approved_at: null, leave_request_id: null })).toBeNull();
  });

  it("fără drept de scriere nu se dă un motiv PER ZI", () => {
    // Atunci nu ziua e blocată, ci luna toată e doar de citit — un motiv scris
    // pe fiecare celulă ar muta vina pe zi și ar deruta.
    expect(motivulBlocarii(false, { approved_at: null, leave_request_id: null })).toBeNull();
  });

  it("aprobarea bate concediul când sunt amândouă", () => {
    // O zi de concediu aprobată e blocată din ambele motive; cel care se
    // afișează trebuie să fie stabil, nu la voia ordinii câmpurilor.
    const motiv = motivulBlocarii(true, {
      approved_at: "2026-09-10T10:00:00Z",
      leave_request_id: "cerere-1",
    });
    expect(motiv).toContain("aprobată");
  });
});
