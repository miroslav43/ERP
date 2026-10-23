// src/app/(app)/mentenanta/erori.test.ts
//
// `traduEroare` al modulului de mentenanță: 23505, depășirile numerice și
// P0001 primesc mesaj propriu; restul trece neatins la traducerea generică.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";

import { traduEroare } from "./erori";

function prinde(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e: unknown) {
    return e;
  }
  throw new Error("traduEroare trebuia să arunce.");
}

describe("traduEroare (mentenanță)", () => {
  it.each([["equipment_uq"], ["iscir_authorizations_uq"], ["oricare_uq"]])(
    "23505 pe %s ⇒ CONFLICT care trimite la cod sau la numărul ISCIR",
    (constrangere) => {
      const e = prinde(() => traduEroare(eroarePostgrest("23505", constrangere)));
      expect(e).toBeInstanceOf(ActionDenied);
      expect(e).toMatchObject({ code: "CONFLICT" });
      expect((e as Error).message).toContain("codul echipamentului");
      expect((e as Error).message).toContain("autorizației ISCIR");
    },
  );

  it.each([["22012"], ["22003"]])("%s ⇒ CONFLICT despre contor, costuri și durate", (cod) => {
    const e = prinde(() => traduEroare(eroarePostgrest(cod)));
    expect(e).toMatchObject({ code: "CONFLICT" });
    expect((e as Error).message).toContain("citirea contorului");
  });

  it("P0001: cifrele din mesajul triggerului ajung neschimbate", () => {
    const mesaj =
      "Citirea (9500) este mai mică decât ultima citire înregistrată (10000). Corectați valoarea sau bifați „Resetare contor”.";
    const e = prinde(() => traduEroare(eroarePostgrest("P0001", mesaj)));
    expect(e).toMatchObject({ code: "CONFLICT", message: mesaj });
  });

  it("P0001: garda ISCIR de 247 de caractere încape întreagă; peste 300 se taie", () => {
    const garda = "x".repeat(247);
    expect(prinde(() => traduEroare(eroarePostgrest("P0001", garda)))).toMatchObject({
      message: garda,
    });
    const lung = "y".repeat(301);
    expect((prinde(() => traduEroare(eroarePostgrest("P0001", lung))) as Error).message).toBe(
      "y".repeat(300),
    );
  });

  // Mesajele gărzilor din 0210 (M6): încap întregi, cu numărul sesizării în ele.
  it.each([
    [
      "Intervenția a rezolvat sesizarea SZ-2026-000123. Redeschideți întâi sesizarea SZ-2026-000123, apoi anulați intervenția.",
    ],
    [
      "Intervenția a rezolvat sesizarea SZ-2026-000123, care e deja închisă: nu se mai poate anula. Corectați-o prin editare.",
    ],
    ["O intervenție anulată nu se mai reactivează. Înregistrați-o din nou, dacă a avut loc."],
    [
      "Echipamentul unei intervenții nu se schimbă. Anulați-o și înregistrați-o pe echipamentul corect.",
    ],
    ["Sesizarea de care ține o intervenție nu se schimbă prin editare."],
    ["O linie de piese nu se mută pe altă intervenție. Ștergeți-o și adăugați-o acolo."],
    [
      "Intervenția nu există în această organizație sau a fost anulată. Piesele nu se mai pot modifica.",
    ],
  ])("P0001 din 0210 ajunge întreg: %s", (mesaj) => {
    expect(mesaj.length).toBeLessThanOrEqual(300);
    expect(prinde(() => traduEroare(eroarePostgrest("P0001", mesaj)))).toMatchObject({
      code: "CONFLICT",
      message: mesaj,
    });
  });

  // Mesajele P0001 din 0211 (M7, ISCIR), citite din migrare, nu copiate: un
  // mesaj nou adăugat în gardă intră singur în probă. Fiecare încape întreg și
  // se termină cu punct.
  const mesaje0193 = [
    ...readFileSync(
      join(process.cwd(), "supabase/migrations/0211_mentenanta_iscir_conformitate.sql"),
      "utf8",
    ).matchAll(/errcode = 'P0001',\s*message = '((?:[^']|'')+)'/gu),
  ].map((m) => (m[1] ?? "").replaceAll("''", "'"));

  it("0211 are mesaje P0001 de verificat", () => {
    expect(mesaje0193.length).toBeGreaterThanOrEqual(8);
  });

  it.each(mesaje0193.map((m) => [m]))("P0001 din 0211 ajunge întreg: %s", (mesaj) => {
    expect(mesaj.length).toBeLessThanOrEqual(300);
    expect(mesaj.endsWith(".")).toBe(true);
    expect(prinde(() => traduEroare(eroarePostgrest("P0001", mesaj)))).toMatchObject({
      code: "CONFLICT",
      message: mesaj,
    });
  });

  // 0212 §3b (M3): tehnicianul fără drept. Citit din migrare, ca la 0211: un
  // mesaj nou al gărzii intră singur în probă.
  const mesaje0212 = [
    ...readFileSync(
      join(process.cwd(), "supabase/migrations/0212_mentenanta_fisiere_scriu_doar_membrii.sql"),
      "utf8",
    ).matchAll(/errcode = 'P0001',\s*message = '((?:[^']|'')+)'/gu),
  ].map((m) => (m[1] ?? "").replaceAll("''", "'"));

  it("0212 are mesajul tehnicianului fără drept", () => {
    expect(mesaje0212.some((m) => m.startsWith("Tehnicianul ales nu poate deschide"))).toBe(true);
  });

  it.each(mesaje0212.map((m) => [m]))("P0001 din 0212 ajunge întreg: %s", (mesaj) => {
    expect(mesaj.length).toBeLessThanOrEqual(300);
    expect(mesaj.endsWith(".")).toBe(true);
    expect(prinde(() => traduEroare(eroarePostgrest("P0001", mesaj)))).toMatchObject({
      code: "CONFLICT",
      message: mesaj,
    });
  });

  // 0232 (Y1): garda valorii de achiziție mutate în `equipment_costuri`. Citit
  // din migrare, ca la 0211: un mesaj nou al gărzii intră singur în probă.
  const mesaje0232 = [
    ...readFileSync(
      join(process.cwd(), "supabase/migrations/0232_mentenanta_costuri_echipament.sql"),
      "utf8",
    ).matchAll(/errcode = 'P0001',\s*message = '((?:[^']|'')+)'/gu),
  ].map((m) => (m[1] ?? "").replaceAll("''", "'"));

  it("0232 are mesajele gărzii valorii de achiziție", () => {
    expect(mesaje0232).toContain("Valoarea de achiziție nu se mută pe alt echipament.");
    expect(mesaje0232).toContain("Echipamentul ales nu există în organizația dumneavoastră.");
  });

  it.each(mesaje0232.map((m) => [m]))("P0001 din 0232 ajunge întreg: %s", (mesaj) => {
    expect(mesaj.length).toBeLessThanOrEqual(300);
    expect(mesaj.endsWith(".")).toBe(true);
    expect(prinde(() => traduEroare(eroarePostgrest("P0001", mesaj)))).toMatchObject({
      code: "CONFLICT",
      message: mesaj,
    });
  });

  it.each([["42501"], ["23503"], ["23514"], ["428C9"]])(
    "%s se aruncă mai departe, ca obiectul original",
    (cod) => {
      const original = eroarePostgrest(cod);
      expect(prinde(() => traduEroare(original))).toBe(original);
    },
  );

  it("o eroare fără forma Postgres nu e tradusă, nici cu cod P0001", () => {
    const strain = { code: "P0001", message: "mesaj" };
    expect(prinde(() => traduEroare(strain))).toBe(strain);
    expect(prinde(() => traduEroare(null))).toBeNull();
  });
});
