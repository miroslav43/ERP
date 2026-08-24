// src/app/(app)/salarizare/setari-complete.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Poarta care face imposibilă repetarea celui mai scump defect tăcut găsit în
 * acest modul.
 *
 * ── CE S-A ÎNTÂMPLAT ──────────────────────────────────────────────────────
 * `salveazaSetari` INSEREAZĂ o versiune nouă la fiecare salvare; nu
 * actualizează. `payroll_settings` are 38 de coloane de business, iar
 * formularul administrează 18. Celelalte 20 nu se moșteneau — cădeau pe
 * DEFAULT-ul coloanei, tăcut.
 *
 * Consecințele nu erau cosmetice: `plafon_poprire_unica` și
 * `plafon_popriri_concurente` intră în motorul de calcul al popririlor, cele
 * opt conturi `cont_*` alimentează nota contabilă, iar `plata_avans`,
 * `ziua_plata_avans`, `ziua_plata_lichidare` și `tichete_furnizor` se
 * completează la ÎNROLARE — prima salvare de setări le ștergea pe toate patru.
 *
 * ── DE CE UN TEST CARE CITEȘTE FIȘIERE ────────────────────────────────────
 * Fiindcă defectul reapare la fiecare coloană NOUĂ adăugată în migrare. Nimeni
 * n-o să-și amintească să caute `insert(` din `salarizare/actions.ts` când
 * adaugă un câmp în `payroll_settings`. Testul citește ambele surse și cade
 * atunci — la adăugarea coloanei, nu peste șase luni, când cineva observă că
 * plafonul s-a schimbat singur.
 *
 * Coloana nouă are exact trei destinații legitime, toate explicite:
 * scrisă din formular, moștenită din versiunea precedentă, sau trecută în
 * `RESETATE_DELIBERAT` de mai jos, cu motivul scris.
 */

const RADACINA = process.cwd();

/** Coloanele care NU se moștenesc, și de ce. Fiecare intrare e o decizie. */
const RESETATE_DELIBERAT: Readonly<Record<string, string>> = {
  verificat_de_contabil:
    "O versiune NOUĂ de cote nu e verificată de nimeni prin faptul că cea dinaintea ei era. Moștenită, ar marca drept confirmate niște cote pe care contabilul nu le-a văzut.",
  verificat_la: "Perechea de dată a lui `verificat_de_contabil` — se resetează odată cu el.",
};

const TEHNICE = new Set([
  "id",
  "organization_id",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "deleted_at",
]);

/** Coloanele de business ale tabelei, din tipurile generate din bază. */
function coloaneTabela(): readonly string[] {
  const tipuri = readFileSync(join(RADACINA, "src/types/database.ts"), "utf8");
  const inceput = tipuri.indexOf("payroll_settings: {");
  expect(inceput).toBeGreaterThan(0);
  const bucata = tipuri.slice(inceput, inceput + 4000);
  const rand = bucata.slice(bucata.indexOf("Row: {"), bucata.indexOf("Insert: {"));
  return rand
    .split("\n")
    .map((linie) => linie.trim())
    .filter((linie) => linie.includes(":") && !linie.startsWith("Row"))
    .map((linie) => linie.split(":")[0]?.trim() ?? "")
    .filter((nume) => nume !== "" && !TEHNICE.has(nume));
}

/** Ce scrie și ce moștenește acțiunea, citite din corpul lui `salveazaSetari`. */
function coloaneAcoperite(): Readonly<{ scrise: Set<string>; mostenite: Set<string> }> {
  const sursa = readFileSync(join(RADACINA, "src/app/(app)/salarizare/actions.ts"), "utf8");
  const inceput = sursa.indexOf('name: "payroll.settings.save"');
  expect(inceput).toBeGreaterThan(0);
  const bucata = sursa.slice(
    inceput,
    sursa.indexOf("});", sursa.indexOf(".single<{ id: string }>()")),
  );

  // Moștenirea: lista de coloane din `.select("…")` de dinaintea inserării.
  const select = /\.select\(\s*"([^"]+)"/.exec(bucata);
  const mostenite = new Set(
    (select?.[1] ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c !== ""),
  );

  // Scrierea: cheile din obiectul dat lui `.insert({ … })`.
  const insert = bucata.slice(bucata.indexOf(".insert({"), bucata.indexOf('.select("id")'));
  const scrise = new Set(
    [...insert.matchAll(/^\s{8}([a-z_]+):/gm)].map((m) => m[1] ?? "").filter((c) => c !== ""),
  );
  return { scrise, mostenite };
}

describe("salveazaSetari — nicio coloană nu se pierde tăcut", () => {
  it("fiecare coloană de business e scrisă, moștenită, sau resetată cu motiv", () => {
    const { scrise, mostenite } = coloaneAcoperite();
    const neacoperite = coloaneTabela().filter(
      (c) => !scrise.has(c) && !mostenite.has(c) && !(c in RESETATE_DELIBERAT),
    );
    expect(neacoperite).toEqual([]);
  });

  it("cele trei mulțimi nu se suprapun — o coloană are o singură destinație", () => {
    const { scrise, mostenite } = coloaneAcoperite();
    const dublate = [...mostenite].filter((c) => scrise.has(c) || c in RESETATE_DELIBERAT);
    expect(dublate).toEqual([]);
  });

  it("plafoanele de poprire chiar se moștenesc — ele intră în calcul", () => {
    // Cazul care costă bani: o firmă care își ridicase plafonul revenea tăcut
    // la 1/3 și 1/2 după orice modificare de cotă.
    const { mostenite } = coloaneAcoperite();
    expect(mostenite.has("plafon_poprire_unica")).toBe(true);
    expect(mostenite.has("plafon_popriri_concurente")).toBe(true);
  });

  it("cele patru câmpuri culese la înrolare se moștenesc", () => {
    const { mostenite } = coloaneAcoperite();
    for (const camp of [
      "plata_avans",
      "ziua_plata_avans",
      "ziua_plata_lichidare",
      "tichete_furnizor",
    ]) {
      expect(mostenite.has(camp)).toBe(true);
    }
  });

  it("«verificat de contabil» NU se moștenește", () => {
    const { scrise, mostenite } = coloaneAcoperite();
    expect(mostenite.has("verificat_de_contabil")).toBe(false);
    expect(scrise.has("verificat_de_contabil")).toBe(false);
  });
});
