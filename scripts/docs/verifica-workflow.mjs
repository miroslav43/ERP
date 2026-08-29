#!/usr/bin/env node
// Validare structurală a workflow-urilor. Există fiindcă `yaml.safe_load` a
// ACCEPTAT tăcut un fișier pe care GitHub l-a respins: un `-m` multi-linie într-un
// bloc `run: |` pusese liniile următoare la coloana 0, unde au devenit chei YAML
// de nivel înalt (`Pagini atinse`, `Co-Authored-By`). „Parsează" nu înseamnă
// „e workflow valid".
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PERMISE = new Set([
  "name",
  "on",
  "true",
  "concurrency",
  "permissions",
  "env",
  "jobs",
  "defaults",
  "run-name",
]);
const dir = ".github/workflows";
let erori = 0;

for (const nume of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
  const text = readFileSync(join(dir, nume), "utf8");
  // Chei de nivel înalt = linii care încep cu un identificator la coloana 0.
  const chei = [...text.matchAll(/^([A-Za-z][^:\n]*):/gm)].map((m) => m[1]);
  const straine = chei.filter((c) => !PERMISE.has(c));
  if (straine.length) {
    console.log(`✗ ${nume}: chei de nivel înalt neașteptate — ${straine.join(", ")}`);
    console.log(
      "  cauza obișnuită: text multi-linie într-un bloc `run: |`, cu liniile la coloana 0",
    );
    erori += 1;
  } else {
    console.log(`✓ ${nume}`);
  }
}
process.exit(erori ? 1 : 0);
