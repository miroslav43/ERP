import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PAGINI } from "@/content/landing/harta";
import { CLASE, FORMATE_NUMARATE, SLUGURI_UNELTE } from "@/lib/unelte/masurare";

/**
 * Pe 8 oct 2026, goal-ul „Descărcări foaie de pontaj” număra `foaie-excel`, pe
 * care nu-l mai trimitea nimic: butoanele trimit `foaie-pdf|docx|xlsx`. Panoul a
 * arătat zero, indiferent de câte descărcări ar fi fost. Testul leagă fiecare
 * goal de un eveniment pe care codul chiar îl emite.
 */
const SCRIPT = readFileSync("scripts/umami-goaluri.sh", "utf8");

function fisiere(dosar: string): string[] {
  return readdirSync(dosar, { withFileTypes: true }).flatMap((intrare) => {
    const cale = join(dosar, intrare.name);
    if (intrare.isDirectory()) return fisiere(cale);
    return /\.tsx?$/u.test(intrare.name) && !/\.test\.tsx?$/u.test(intrare.name) ? [cale] : [];
  });
}
const SURSA = fisiere("src")
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

function emis(nume: string): boolean {
  const dl = /^dl:([a-z0-9-]+):([a-z0-9]+):([a-z]+)$/u.exec(nume);
  if (dl !== null) {
    const [, slug = "", format = "", clasa = ""] = dl;
    return (
      SLUGURI_UNELTE.has(slug) &&
      (FORMATE_NUMARATE.has(format) || format === "alt") &&
      (CLASE as readonly string[]).includes(clasa)
    );
  }
  // `calc:` — calculul de salariu numărat la randare (`evenimentCalcul`, J1/J3).
  const calc = /^calc:calculator-salariu:([a-z]+)$/u.exec(nume);
  if (calc !== null) return (CLASE as readonly string[]).includes(calc[1] ?? "");
  const cont = /^cont:([a-z0-9-]+)$/u.exec(nume);
  if (cont !== null) return cont[1] === "direct" || SLUGURI_UNELTE.has(cont[1] ?? "");
  return SURSA.includes(`data-umami-event="${nume}"`);
}

describe("goal-urile și pâlniile din Umami", () => {
  it("fiecare goal pe eveniment numără un eveniment emis de cod", () => {
    const evenimente = [
      ...[...SCRIPT.matchAll(/\$\(g event ([^)\s]+)\)/gu)].map((m) => m[1] ?? ""),
      ...[...SCRIPT.matchAll(/"type":"event","value":"([^"]+)"/gu)].map((m) => m[1] ?? ""),
    ];
    expect(evenimente.length).toBeGreaterThanOrEqual(5);
    for (const nume of evenimente) expect(emis(nume), nume).toBe(true);
  });

  it("fiecare goal pe cale ține o pagină din hartă", () => {
    const cai = [...SCRIPT.matchAll(/\$\(g path ([^)\s]+)\)/gu)].map((m) => m[1] ?? "");
    const din = new Set(PAGINI.map((p) => p.cale));
    for (const cale of cai) expect(din.has(cale), cale).toBe(true);
  });
});
