import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  PORTI_APP,
  PORTI_PORTAL,
  PORTI_RUTA,
  caleaDin,
  legaturaSigura,
  poartaRutei,
  poateDeschide,
  tiparePermise,
  tiparulCaii,
  type ContextPorti,
} from "./porti-ruta";
import { NAV_ITEMS } from "./navigation";

/**
 * Registrul porților e util doar cât timp e COMPLET. O pagină nouă fără intrare
 * ar face `poateDeschide` să răspundă „nu" pentru o rută care există — adică
 * un link ascuns pe nedrept; o intrare fără pagină ar lăsa un link spre 404.
 * De aceea lista se compară cu discul, în ambele sensuri, ca la `NAV_ITEMS`.
 */
function paginiDePeDisc(radacina: string, prefix: string): readonly string[] {
  const rute: string[] = [];
  const parcurge = (dir: string, ruta: string): void => {
    for (const intrare of readdirSync(dir)) {
      const cale = path.join(dir, intrare);
      if (statSync(cale).isDirectory()) {
        parcurge(cale, `${ruta}/${intrare}`);
      } else if (intrare === "page.tsx") {
        rute.push(ruta.length === 0 ? prefix : `${prefix}${ruta}`);
      }
    }
  };
  parcurge(radacina, "");
  return rute.sort();
}

const RADACINA = path.resolve(__dirname, "../app");

describe("registrul porților de rută", () => {
  it("are o intrare pentru fiecare page.tsx din (app), și nimic în plus", () => {
    const disc = paginiDePeDisc(path.join(RADACINA, "(app)"), "").map((r) =>
      r.length === 0 ? "/" : r,
    );
    const registru = PORTI_APP.map((p) => p.tipar).sort();
    expect(registru).toEqual(disc);
  });

  it("are o intrare pentru fiecare page.tsx din (portal), și nimic în plus", () => {
    const disc = paginiDePeDisc(path.join(RADACINA, "(portal)"), "");
    const registru = PORTI_PORTAL.map((p) => p.tipar).sort();
    expect(registru).toEqual(disc);
  });

  it("nu are tipare duplicate", () => {
    const tipare = PORTI_RUTA.map((p) => p.tipar);
    expect(new Set(tipare).size).toBe(tipare.length);
  });

  it("nu e mai permisiv decât meniul pentru nicio destinație de meniu", () => {
    // Meniul poate cere mai mult decât pagina (popriri: `all` în meniu, absența
    // în pagină), dar niciodată mai puțin: altfel intrarea ar duce în refuz.
    for (const item of NAV_ITEMS) {
      for (const link of [item, ...(item.children ?? [])]) {
        const poarta = poartaRutei(link.href);
        expect(poarta, link.href).not.toBeNull();
        if (poarta === null) continue;
        expect(poarta.featureKey, link.href).toBe(link.featureKey);
        if (poarta.permission !== null) {
          expect(link.permission, link.href).toBe(poarta.permission);
        }
      }
    }
  });
});

describe("poartaRutei", () => {
  it("găsește pagina de detaliu după un UUID", () => {
    const poarta = poartaRutei("/angajati/0f8fad5b-d9cb-469f-a165-70867728950e");
    expect(poarta?.tipar).toBe("/angajati/[id]");
  });

  it("preferă segmentul static celui dinamic", () => {
    expect(poartaRutei("/cursuri/biblioteca")?.tipar).toBe("/cursuri/biblioteca");
    expect(poartaRutei("/cursuri/nou")?.tipar).toBe("/cursuri/nou");
    expect(poartaRutei("/cursuri/abc")?.tipar).toBe("/cursuri/[id]");
  });

  it("ignoră interogarea și ancora", () => {
    expect(poartaRutei("/concedii/echipa?employee_id=x#sus")?.tipar).toBe("/concedii/echipa");
    expect(caleaDin("/pontaj/")).toBe("/pontaj");
  });

  it("întoarce null pentru o rută fără pagină", () => {
    // `/puncte-lucru/[id]` are pagină din lotul 7n; un segment în plus n-are.
    expect(poartaRutei("/puncte-lucru/0f8fad5b-d9cb-469f-a165-70867728950e/istoric")).toBeNull();
    expect(poartaRutei("/setari")).toBeNull();
    expect(poartaRutei("/inexistent")).toBeNull();
  });
});

describe("poateDeschide", () => {
  const manager: ContextPorti = {
    features: new Set(["attendance", "leave", "fleet"]),
    permissions: new Map([
      ["employees:read", "team"],
      ["attendance:read", "team"],
      ["attendance:approve", "team"],
      ["leave:read", "team"],
      ["trip_sheets:read", "own"],
    ]),
  };

  it("lasă managerul pe foile de parcurs, dar nu pe parcul auto", () => {
    expect(poateDeschide("/flota/foi", manager)).toBe(true);
    expect(poateDeschide("/flota", manager)).toBe(false);
    expect(legaturaSigura("/flota", manager)).toBeNull();
  });

  it("refuză modulul oprit chiar cu permisiune", () => {
    const faraFlota: ContextPorti = { ...manager, features: new Set(["attendance"]) };
    expect(poateDeschide("/flota/foi", faraFlota)).toBe(false);
  });

  it("refuză pragul neatins și lasă nucleul fără permisiune", () => {
    expect(poateDeschide("/pontaj/arhiva", manager)).toBe(false);
    expect(poateDeschide("/panou", manager)).toBe(true);
    expect(poateDeschide("/notificari", manager)).toBe(true);
  });

  it("refuză o rută necunoscută", () => {
    expect(poateDeschide("/setari", manager)).toBe(false);
  });

  it("tratează refuzul explicit ca absență", () => {
    const cuNone: ContextPorti = {
      ...manager,
      permissions: new Map([["attendance:read", "none"]]),
    };
    expect(poateDeschide("/pontaj", cuNone)).toBe(false);
  });

  it("tiparePermise + tiparulCaii dau același răspuns ca poateDeschide", () => {
    const permise = tiparePermise(manager);
    for (const href of ["/flota/foi", "/flota", "/pontaj/aprobare", "/angajati/x-y"]) {
      const tipar = tiparulCaii(href, permise);
      expect(tipar !== null, href).toBe(poateDeschide(href, manager));
    }
  });
});
