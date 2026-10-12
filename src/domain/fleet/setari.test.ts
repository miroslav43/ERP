// src/domain/fleet/setari.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PRAG_FLOTA_AVERTIZARE_ZILE } from "./scadente";
import {
  LIMITE_SETARI_FLOTA,
  PRAG_SALT_IMPLICIT_KM,
  PRAGURI_ALERTA_IMPLICITE,
  pragurileDinText,
  textulPragurilor,
} from "./setari";

describe("pragurileDinText", () => {
  it("desparte pe virgulă, spațiu și punct și virgulă, descrescător", () => {
    expect(pragurileDinText("7, 30;14")).toEqual([30, 14, 7]);
    expect(pragurileDinText(" 60  20 7 ")).toEqual([60, 20, 7]);
  });

  it("păstrează fiecare zi o singură dată, ca triggerul din bază", () => {
    expect(pragurileDinText("7, 7, 30, 30")).toEqual([30, 7]);
  });

  it("textul gol dă lista goală — „lipsește” o spune schema, nu parserul", () => {
    expect(pragurileDinText("")).toEqual([]);
    expect(pragurileDinText(" , ; ")).toEqual([]);
  });

  it.each([["30, două"], ["7.5"], ["-7"], ["14 zile"], ["99999"]])(
    "„%s” nu e o listă de zile întregi: null, nu un prag ghicit",
    (text) => {
      expect(pragurileDinText(text)).toBeNull();
    },
  );

  it("drumul întors: textul pragurilor se citește înapoi la aceleași zile", () => {
    expect(textulPragurilor([30, 14, 7])).toBe("30, 14, 7");
    expect(pragurileDinText(textulPragurilor([45, 21, 7]))).toEqual([45, 21, 7]);
  });
});

describe("implicitele flotei sunt cele din bază", () => {
  const migrare = readFileSync(
    join(process.cwd(), "supabase/migrations/0198_flota_conformitate_zilnica.sql"),
    "utf8",
  );
  const flota = readFileSync(join(process.cwd(), "supabase/migrations/0012_fleet.sql"), "utf8");

  it("pragul de salt: default-ul coloanei și rezerva din 0012", () => {
    expect(migrare).toMatch(
      new RegExp(`prag_salt_km\\s+integer not null default ${String(PRAG_SALT_IMPLICIT_KM)}`, "u"),
    );
    expect(flota).toMatch(
      new RegExp(
        `flota_prag_salt_km\\(\\)[\\s\\S]{0,200}?select ${String(PRAG_SALT_IMPLICIT_KM)}`,
        "u",
      ),
    );
  });

  it("pragurile de alertă: default-ul coloanei", () => {
    expect(migrare).toContain(
      `praguri_alerta_zile  integer[] not null default array[${PRAGURI_ALERTA_IMPLICITE.join(", ")}]`,
    );
  });

  it("rezumatul duce la filtrul „expiră” doar în fereastra pe care filtrul o arată", () => {
    // `flota_rezumat` alege între `/flota?conformitate=expira` și `/flota` după
    // aceeași fereastră ca filtrul listei; altfel vehiculele cu documente peste
    // ea ar lipsi din lista pe care o deschide notificarea.
    expect(migrare).toContain(
      `o.ultima_scadenta <= v_azi + ${String(PRAG_FLOTA_AVERTIZARE_ZILE)} then '/flota?conformitate=expira'`,
    );
  });

  it("limitele: aceleași cu CHECK-urile tabelei", () => {
    expect(migrare).toContain(
      `prag_salt_km between ${String(LIMITE_SETARI_FLOTA.pragSaltMin)} and ${String(LIMITE_SETARI_FLOTA.pragSaltMax)}`,
    );
    expect(migrare).toContain(`between 1 and ${String(LIMITE_SETARI_FLOTA.praguriMaxim)}`);
    expect(migrare).toContain(
      `${String(LIMITE_SETARI_FLOTA.pragAlertaMax)} >= all (praguri_alerta_zile)`,
    );
    expect(migrare).toContain(
      `array_length(responsabili, 1), 0) <= ${String(LIMITE_SETARI_FLOTA.responsabiliMaxim)}`,
    );
  });
});
