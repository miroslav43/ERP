import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { isFeatureKey } from "@/config/features";
import { PERMISSION_KEYS, type PermissionKey } from "@/config/permissions";
import { PORTI_RUTA } from "@/config/porti-ruta";

import {
  ETICHETE_RESURSE,
  descriePermisiunea,
  ordineaPermisiunii,
  type ResursaPermisiune,
} from "./permisiuni-etichete";

/**
 * Dicționarul care traduce `resursa:acțiune` în ce vede administratorul pe
 * ecranul de permisiuni per angajat (QA UX-016, ADM-012).
 *
 * Completitudinea o impune deja tsc (`Record` pe uniunea derivată din
 * `PermissionKey`). Testul verifică ce tsc nu vede: că textele sunt românești,
 * că legătura resursă→modul e cea pe care o aplică paginile, și că steagul
 * `ascunsa` urmează realitatea codului, nu memoria cuiva.
 */

const RESURSE = [...new Set(PERMISSION_KEYS.map((c) => c.split(":")[0]))] as ResursaPermisiune[];

/** Cuvinte de acțiune englezești care nu au ce căuta pe ecran. */
const ENGLEZA = /\b(read|create|update|delete|approve|invite|transmit|configure)\b/u;

describe("descriePermisiunea", () => {
  it.each(PERMISSION_KEYS)("%s are etichete românești, fără cheia brută", (cheie) => {
    const d = descriePermisiunea(cheie);
    const [resursa, actiune] = cheie.split(":") as [string, string];

    expect(d.resursa).toBe(resursa);
    expect(d.actiune).toBe(actiune);
    for (const text of [
      d.grup,
      d.etichetaResursa,
      d.descriereResursa,
      d.etichetaActiune,
      d.descriere,
    ]) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).not.toContain(cheie);
      expect(text).not.toMatch(ENGLEZA);
      // Identificatorii cu liniuță jos (`per_diem`, `trip_sheets`) sunt cheie
      // brută la vedere oricum ar fi încadrați.
      expect(text).not.toMatch(/[a-z]_[a-z]/u);
    }
    expect(d.etichetaResursa).not.toBe(resursa);
    expect(d.etichetaActiune).not.toBe(actiune);
  });

  it("nicio etichetă nu are sedilă, iar descrierile se termină cu punct", () => {
    for (const cheie of PERMISSION_KEYS) {
      const d = descriePermisiunea(cheie);
      for (const text of [
        d.grup,
        d.etichetaResursa,
        d.descriereResursa,
        d.etichetaActiune,
        d.descriere,
      ]) {
        expect(text, cheie).not.toMatch(/[şţŞŢ]/u);
      }
      expect(d.descriere, cheie).toMatch(/\.$/u);
      expect(d.descriereResursa, cheie).toMatch(/\.$/u);
    }
  });

  it("cheile cu înțeles special au fraza lor, nu formula generică", () => {
    expect(descriePermisiunea("checklists:approve").descriere).toBe(
      "Închide sau anulează un parcurs de integrare.",
    );
    expect(descriePermisiunea("attendance:export").descriere).toBe(
      "Descarcă arhiva lunară a pontajului (toată firma).",
    );
    expect(descriePermisiunea("registru:update").descriere).toBe(
      "Închide sau redeschide exercițiul financiar al registrului.",
    );
  });

  it("grupul e denumirea modulului, sau „Nucleu” pentru resursele fără modul", () => {
    expect(descriePermisiunea("attendance:approve").grup).toBe("Pontaj");
    expect(descriePermisiunea("trip_sheets:read").grup).toBe("Parc auto");
    expect(descriePermisiunea("employees:read").grup).toBe("Nucleu");
    expect(descriePermisiunea("attendance:approve").etichetaActiune).toBe("Aprobare");
  });
});

describe("ETICHETE_RESURSE — modulul fiecărei resurse", () => {
  it("fiecare modul declarat e o cheie de modul din catalog", () => {
    for (const resursa of RESURSE) {
      const { modul } = ETICHETE_RESURSE[resursa];
      if (modul !== null) expect(isFeatureKey(modul), resursa).toBe(true);
    }
  });

  /*
    EFECTUL, nu declarația: o resursă e „a modulului X" dacă paginile care o cer
    sunt păzite de X. Dacă dicționarul spune „Nucleu" pentru o resursă pe care
    toate paginile o pun sub un modul, rândul ar rămâne vizibil la o firmă care
    nu are modulul — și invers, s-ar ascunde un drept care contează.
  */
  it.each(RESURSE)("%s: modulul concordă cu registrul porților de rută", (resursa) => {
    const modulePorti = new Set(
      PORTI_RUTA.filter((p) => p.permission?.startsWith(`${resursa}:`) === true).map(
        (p) => p.featureKey,
      ),
    );
    if (modulePorti.size === 0) return; // nicio pagină nu cere resursa — nimic de comparat
    expect([...modulePorti], resursa).toContain(ETICHETE_RESURSE[resursa].modul);
  });
});

describe("ETICHETE_RESURSE — resursele ascunse", () => {
  const RADACINA = join(process.cwd(), "src");
  const EXCLUSE = new Set([
    "config/permissions.ts",
    "config/porti-ruta.ts",
    "config/permisiuni-etichete.ts",
    "types/database.ts",
  ]);

  function fisiere(dir: string): string[] {
    return readdirSync(dir).flatMap((nume) => {
      const cale = join(dir, nume);
      if (statSync(cale).isDirectory()) return fisiere(cale);
      return /\.(ts|tsx)$/u.test(nume) && !/\.test\.tsx?$/u.test(nume) ? [cale] : [];
    });
  }

  const SURSE = fisiere(RADACINA)
    .filter((cale) => !EXCLUSE.has(relative(RADACINA, cale)))
    .map((cale) => readFileSync(cale, "utf8"));

  function areConsumator(resursa: string): boolean {
    return SURSE.some((sursa) => sursa.includes(`"${resursa}:`));
  }

  /*
    Un drept pe care nicio pagină și nicio acțiune nu-l citește e o promisiune
    falsă pe ecran. Când cineva îi dă primul consumator, testul pică și cere
    scoaterea steagului — altfel dreptul nou ar rămâne de neacordat.
  */
  it.each(RESURSE.filter((r) => r !== "roles"))(
    "%s e ascunsă exact când nu are consumator în src",
    (resursa) => {
      expect(ETICHETE_RESURSE[resursa].ascunsa === true).toBe(!areConsumator(resursa));
    },
  );
});

describe("ordineaPermisiunii", () => {
  function sortate(): PermissionKey[] {
    return [...PERMISSION_KEYS].sort((a, b) => ordineaPermisiunii(a) - ordineaPermisiunii(b));
  }

  it("nucleul vine primul, începând cu angajații, apoi modulele după catalog", () => {
    const ordine = sortate();
    expect(ordine[0]).toBe("employees:read");
    const primulModul = ordine.findIndex((c) => descriePermisiunea(c).grup !== "Nucleu");
    expect(ordine.slice(primulModul).every((c) => descriePermisiunea(c).grup !== "Nucleu")).toBe(
      true,
    );
    // Pontajul (20) înaintea concediilor (30), care stau înaintea salarizării (50).
    expect(ordine.indexOf("attendance:read")).toBeLessThan(ordine.indexOf("leave:read"));
    expect(ordine.indexOf("leave:read")).toBeLessThan(ordine.indexOf("payroll:read"));
  });

  it("acțiunile aceleiași resurse rămân lipite", () => {
    const ordine = sortate().map((c) => c.split(":")[0]);
    const vazute = new Set<string>();
    let precedenta: string | undefined;
    for (const resursa of ordine) {
      if (resursa !== precedenta) {
        expect(vazute.has(resursa ?? ""), resursa).toBe(false);
        vazute.add(resursa ?? "");
      }
      precedenta = resursa;
    }
  });
});
