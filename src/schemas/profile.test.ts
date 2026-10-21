// src/schemas/profile.test.ts
//
// Profilul propriu: telefonul respectă regula comună (QA 8 oct 2026,
// ANG-030: „abc-12" se salva), iar parola nouă respectă politica din `auth.ts`
// — 12–72 de caractere, ca la invitație și la resetare, nu 8 ca până acum.

import { describe, expect, it } from "vitest";

import { schemaParolaNoua, schemaProfilPropriu } from "./profile";

describe("schemaProfilPropriu — phone", () => {
  it("litere în număr: issue pe `phone`", () => {
    const r = schemaProfilPropriu.safeParse({ full_name: "Ion Popescu", phone: "abc-12" });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.some((i) => i.path[0] === "phone")).toBe(true);
  });

  it("număr românesc obișnuit: trece", () => {
    const r = schemaProfilPropriu.safeParse({ full_name: "Ion Popescu", phone: "0722123456" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.phone).toBe("0722123456");
  });

  it("gol: devine null", () => {
    const r = schemaProfilPropriu.safeParse({ full_name: "Ion Popescu", phone: "" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.phone).toBeNull();
  });
});

describe("schemaParolaNoua — politica de parolă", () => {
  it("8 caractere: „cel puțin 12 caractere”", () => {
    const r = schemaParolaNoua.safeParse({ parola_noua: "abcdefgh", confirma_parola: "abcdefgh" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "parola_noua");
    expect(issue?.message).toContain("cel puțin 12 caractere");
  });

  it("73 de caractere: „maximum 72”", () => {
    const parola = "a".repeat(73);
    const r = schemaParolaNoua.safeParse({ parola_noua: parola, confirma_parola: parola });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "parola_noua");
    expect(issue?.message).toContain("maximum 72");
  });

  it("12 caractere identice: trece", () => {
    const r = schemaParolaNoua.safeParse({
      parola_noua: "abcdefghijkl",
      confirma_parola: "abcdefghijkl",
    });
    expect(r.success).toBe(true);
  });

  it("parole diferite: issue pe `confirma_parola`", () => {
    const r = schemaParolaNoua.safeParse({
      parola_noua: "abcdefghijkl",
      confirma_parola: "abcdefghijkm",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "confirma_parola");
    expect(issue?.message).toContain("nu coincid");
  });
});
