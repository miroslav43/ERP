// src/lib/asistent/destinatii.test.ts
/**
 * Poarta care ține indexul asistentului lipit de aplicația reală.
 *
 * Un index de rute scris de mână are exact o boală, și e tăcută: nu se strică
 * niciodată zgomotos. Aplicația crește, cineva adaugă `/pontaj/setari/reguli`,
 * nimic nu pică, iar asistentul continuă să nu știe că pagina există — sau, mai
 * rău, cineva redenumește o rută și asistentul trimite mai departe la cea veche.
 *
 * Precedentul e în repo, cu cifre: `docs/conturi-si-rute.md` s-a autodeclarat
 * „se strică singur" și avea, la ultima numărătoare, două rute documentate care
 * nu mai există și unsprezece existente nedocumentate. Diferența dintre acel
 * fișier și ăsta e testul de mai jos.
 *
 * Tiparul e cel din `src/config/permissions.test.ts`: sursa de adevăr (acolo
 * seed-ul SQL, aici arborele de fișiere) se compară cu ce zice codul, iar
 * divergența pică. `EXCLUSE` există ca „lipsește" să nu poată fi confundat
 * niciodată cu „am uitat" — o rută scoasă intenționat cere un motiv scris.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FEATURE_KEYS } from "@/config/features";
import { PERMISSION_KEYS } from "@/config/permissions";
import { NAV_ITEMS, PORTAL_NAV_ITEMS } from "@/config/navigation";
import { DESTINATII, EXCLUSE, destinatiaDupaId } from "./destinatii";

const RADACINA = join(process.cwd(), "src", "app");

/**
 * Rutele statice de pe disc, în forma în care le vede browserul.
 *
 * Grupurile de rute — directoarele `(app)`, `(portal)` — nu apar în URL, deci se
 * taie. Segmentele dinamice `[id]` se sar cu totul: asistentul nu poate trimite
 * pe cineva la fișa unui angajat fără să știe CARE angajat, iar aia e treaba
 * uneltei `cauta-om`, nu a indexului.
 */
function ruteStaticeDinArbore(director: string, prefix: string): readonly string[] {
  const rute: string[] = [];
  for (const intrare of readdirSync(director, { withFileTypes: true })) {
    if (intrare.isFile()) {
      if (intrare.name === "page.tsx") rute.push(prefix === "" ? "/" : prefix);
      continue;
    }
    if (!intrare.isDirectory()) continue;
    const nume = intrare.name;
    if (nume.startsWith("[")) continue; // rută dinamică
    if (nume.startsWith("_")) continue; // director privat de componente
    if (nume.startsWith("@")) continue; // slot paralel
    const prefixCopil = nume.startsWith("(") && nume.endsWith(")") ? prefix : `${prefix}/${nume}`;
    rute.push(...ruteStaticeDinArbore(join(director, nume), prefixCopil));
  }
  return rute;
}

const RUTE_APP = ruteStaticeDinArbore(join(RADACINA, "(app)"), "");
const RUTE_PORTAL = ruteStaticeDinArbore(join(RADACINA, "(portal)"), "");
const RUTE_PE_DISC = [...RUTE_APP, ...RUTE_PORTAL];

const HREF_INDEXATE = new Set(DESTINATII.map((d) => d.href));

describe("indexul de destinații față de arborele de rute", () => {
  it("găsește rute pe disc (altfel testul trece degeaba)", () => {
    // Fără asta, o greșeală de cale ar face parcurgerea să întoarcă zero rute,
    // iar cele două teste de mai jos ar trece triumfător peste mulțimea vidă.
    expect(RUTE_APP.length).toBeGreaterThan(60);
    expect(RUTE_PORTAL.length).toBeGreaterThan(15);
  });

  it("acoperă fiecare rută statică, ori indexată, ori exclusă cu motiv", () => {
    const neacoperite = RUTE_PE_DISC.filter(
      (ruta) => !HREF_INDEXATE.has(ruta) && EXCLUSE[ruta] === undefined,
    );
    expect(
      neacoperite,
      "Rute noi pe disc, necunoscute asistentului. Adaugă-le în INTRARI (cu o descriere " +
        "scrisă pentru un om care nu știe unde e) sau în EXCLUSE, cu motivul.",
    ).toEqual([]);
  });

  it("nu conține nicio destinație către o pagină care nu mai există", () => {
    const peDisc = new Set(RUTE_PE_DISC);
    const fantome = DESTINATII.filter((d) => !peDisc.has(d.href)).map((d) => `${d.id} → ${d.href}`);
    expect(fantome, "Destinații care trimit în gol — pagina a fost mutată sau ștearsă.").toEqual(
      [],
    );
  });

  it("nu exclude o rută care între timp a dispărut", () => {
    // Un motiv scris pentru o rută inexistentă e un comentariu care minte.
    const peDisc = new Set(RUTE_PE_DISC);
    expect(Object.keys(EXCLUSE).filter((ruta) => !peDisc.has(ruta))).toEqual([]);
  });
});

describe("integritatea internă a indexului", () => {
  it("nu repetă niciun identificator", () => {
    const vazute = new Set<string>();
    const duble: string[] = [];
    for (const d of DESTINATII) {
      if (vazute.has(d.id)) duble.push(d.id);
      vazute.add(d.id);
    }
    expect(duble).toEqual([]);
  });

  it("nu repetă niciun href", () => {
    const vazute = new Set<string>();
    const duble: string[] = [];
    for (const d of DESTINATII) {
      if (vazute.has(d.href)) duble.push(d.href);
      vazute.add(d.href);
    }
    expect(duble).toEqual([]);
  });

  it("folosește doar chei de modul care există în catalog", () => {
    const cunoscute = new Set<string>(FEATURE_KEYS);
    const straine = DESTINATII.filter(
      (d) => d.featureKey !== null && !cunoscute.has(d.featureKey),
    ).map((d) => `${d.id} → ${String(d.featureKey)}`);
    expect(straine).toEqual([]);
  });

  it("folosește doar chei de permisiune care există în matrice", () => {
    // O cheie inventată aici nu ar da eroare de tip dacă cineva o adaugă cu
    // `as PermissionKey`; ar produce în schimb o destinație pe care NIMENI nu o
    // vede, fiindcă harta de permisiuni nu are niciodată acea cheie.
    const cunoscute = new Set<string>(PERMISSION_KEYS);
    const straine = DESTINATII.filter(
      (d) => d.permission !== null && !cunoscute.has(d.permission),
    ).map((d) => `${d.id} → ${String(d.permission)}`);
    expect(straine).toEqual([]);
  });

  it("trimite fiecare destinație către un părinte de meniu real", () => {
    const idApp = new Set(NAV_ITEMS.map((i) => i.id));
    const idPortal = new Set(PORTAL_NAV_ITEMS.map((i) => i.id));
    const orfane = DESTINATII.filter((d) => {
      if (d.parinte === null) return false;
      return d.zona === "app" ? !idApp.has(d.parinte) : !idPortal.has(d.parinte);
    }).map((d) => `${d.id} → ${String(d.parinte)}`);
    expect(orfane, "Părinte de meniu inexistent: drumul de click s-ar randa trunchiat.").toEqual(
      [],
    );
  });

  it("dă fiecărei destinații un drum de click nevid", () => {
    expect(DESTINATII.filter((d) => d.drum.length === 0).map((d) => d.id)).toEqual([]);
  });

  it("scrie fiecare descriere ca propoziție, nu ca etichetă", () => {
    // Descrierea e singurul lucru din index pe care modelul îl citește ca text
    // liber. O etichetă repetată („Pontaj") nu-i spune nimic peste ce știe deja
    // din `eticheta`; o propoziție îi spune ce se FACE acolo.
    const scurte = DESTINATII.filter((d) => d.descriere.length < 30 || !d.descriere.endsWith("."));
    expect(scurte.map((d) => d.id)).toEqual([]);
  });

  it("scrie ș și ț cu virgulă dedesubt, nu cu sedilă", () => {
    const cuSedila = DESTINATII.filter((d) =>
      /[şţ]/u.test(`${d.eticheta} ${d.descriere} ${d.drum.join(" ")}`),
    );
    expect(cuSedila.map((d) => d.id)).toEqual([]);
  });
});

describe("destinatiaDupaId", () => {
  it("găsește o destinație existentă", () => {
    expect(destinatiaDupaId("pontaj.saptamana")?.href).toBe("/pontaj/saptamana");
  });

  it("întoarce undefined pentru un identificator inventat", () => {
    // Exact ce va face modelul din când în când. Apelantul aruncă referința.
    expect(destinatiaDupaId("pontaj.orele-mele")).toBeUndefined();
  });
});

describe("drumul de click", () => {
  it("pornește din grupul de meniu și trece prin intrarea de meniu", () => {
    expect(destinatiaDupaId("pontaj.perioade")?.drum).toEqual(["Operațiuni", "Pontaj", "Perioade"]);
  });

  it("nu repetă intrarea de meniu când fila poartă alt nume", () => {
    expect(destinatiaDupaId("pontaj")?.drum).toEqual(["Operațiuni", "Pontaj", "Prezența"]);
  });

  it("folosește grupurile portalului pentru rutele de portal", () => {
    expect(destinatiaDupaId("portal.salariu")?.drum).toEqual([
      "Banii și actele mele",
      "Salariul meu",
    ]);
  });

  it("cade pe propria etichetă pentru o rută fără părinte de meniu", () => {
    expect(destinatiaDupaId("profil")?.drum).toEqual(["Profilul meu"]);
  });
});
