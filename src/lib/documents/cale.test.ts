// src/lib/documents/cale.test.ts
import { describe, expect, it } from "vitest";

import { PERMISSION_KEYS } from "@/config/permissions";

import {
  ENTITATI_DOCUMENT,
  caleLotImport,
  construiesteCaleDocument,
  prefixCaleDocument,
  slugFisier,
  verificaDocument,
} from "./cale";

/**
 * Testul care ar fi prins defectul din 0073.
 *
 * `app.can_path` (0002_authz.sql) descompune calea în
 * `{org}/{RESURSĂ}/{entitate}/{fișier}` și dă segmentul 2 lui
 * `app.has_permission` ca nume de resursă. Un cuvânt care nu există în catalog
 * întoarce `none` — refuz TĂCUT, fără eroare, la fiecare încărcare. Codul a
 * trăit luni de zile cu „angajati" acolo, iar funcția n-a mers niciodată pentru
 * cine nu era platform admin.
 *
 * `PERMISSION_KEYS` e oglinda în cod a seed-ului din `role_permissions`, iar
 * `tests/rls/permisiuni.test.ts` verifică deja că cele două nu divergă. Deci
 * verificarea de aici, împotriva lui, e tranzitiv o verificare împotriva bazei.
 */
const RESURSE_REALE = new Set(PERMISSION_KEYS.map((cheie) => cheie.split(":")[0]));

describe("contractul de cale din Storage", () => {
  it("fiecare entitate de document este o resursă de permisiune reală", () => {
    for (const entitate of ENTITATI_DOCUMENT) {
      expect(RESURSE_REALE, `„${entitate}" nu există în PERMISSION_KEYS`).toContain(entitate);
    }
  });

  it("segmentul 2 respectă `^[a-z][a-z0-9_]{1,63}$` cerut de app.path_resource", () => {
    for (const entitate of ENTITATI_DOCUMENT) {
      expect(entitate).toMatch(/^[a-z][a-z0-9_]{1,63}$/);
    }
  });

  it("calea are exact patru segmente, cu organizația prima", () => {
    const cale = construiesteCaleDocument({
      organizationId: "774fb27a-98e7-4224-927c-49613223e00d",
      entitate: "employees",
      entitateId: "8b867d05-d4c0-4a42-9bc7-ce21abe20ac4",
      numeFisier: "Contract individual de muncă.pdf",
    });
    const segmente = cale.split("/");
    expect(segmente).toHaveLength(4);
    expect(segmente[0]).toBe("774fb27a-98e7-4224-927c-49613223e00d");
    expect(segmente[1]).toBe("employees");
    expect(segmente[2]).toBe("8b867d05-d4c0-4a42-9bc7-ce21abe20ac4");
  });

  it("lotul de import stă tot sub `employees`, ca poarta acțiunii", () => {
    const cale = caleLotImport("org-1", "lot-9");
    expect(cale.split("/")[1]).toBe("employees");
    expect(RESURSE_REALE).toContain(cale.split("/")[1]);
  });

  it("prefixul de verificare e chiar începutul căii construite", () => {
    const intrare = {
      organizationId: "org-1",
      entitate: "employees" as const,
      entitateId: "emp-1",
      numeFisier: "adeverință.pdf",
    };
    const prefix = prefixCaleDocument(intrare.organizationId, intrare.entitate, intrare.entitateId);
    expect(construiesteCaleDocument(intrare).startsWith(prefix)).toBe(true);
  });
});

describe("slugFisier", () => {
  it("scoate diacriticele și păstrează extensia", () => {
    expect(slugFisier("Adeverință de vechime.pdf")).toBe("adeverinta-de-vechime.pdf");
  });

  it("nu întoarce niciodată șir gol", () => {
    expect(slugFisier("???")).toBe("fisier");
  });
});

describe("verificaDocument", () => {
  it("acceptă un PDF de dimensiune normală", () => {
    expect(verificaDocument("application/pdf", 1024)).toBeNull();
  });

  it("respinge un tip neacceptat", () => {
    expect(verificaDocument("application/x-msdownload", 1024)).not.toBeNull();
  });

  it("respinge fișierul gol și pe cel prea mare", () => {
    expect(verificaDocument("application/pdf", 0)).not.toBeNull();
    expect(verificaDocument("application/pdf", 21 * 1024 * 1024)).not.toBeNull();
  });
});
