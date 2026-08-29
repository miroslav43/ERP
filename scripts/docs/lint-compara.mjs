#!/usr/bin/env node
// Compară două amprente `lint-vault --json`, de dinainte și de după trecerea
// agenților. Poarta NU e „zero erori" — vault-ul poate avea deja erori cunoscute
// pe pagini pe care nimeni nu le-a atins. Poarta e „nicio eroare ÎN PLUS", pe
// pagină, exact ca fingerprint-ul de erori de tip din `revizuire.yml`.
//
// Și, ca acolo: comparația o face workflow-ul, nu agentul. Auto-raportarea nu e
// dovadă.
import { readFileSync } from "node:fs";

const [caleA, caleB] = process.argv.slice(2);
const citeste = (c) => {
  try {
    const d = JSON.parse(readFileSync(c, "utf8"));
    return new Map((d.pagini || []).map((p) => [p.rel, p]));
  } catch {
    return new Map();
  }
};

const inainte = citeste(caleA);
const dupa = citeste(caleB);

const regresii = [];
for (const [rel, p] of dupa) {
  const vechi = inainte.get(rel);
  const nVechi = vechi ? vechi.erori.length : 0;
  const nNou = p.erori.length;
  if (nNou > nVechi) regresii.push({ rel, nVechi, nNou, erori: p.erori });
}

const totalDupa = [...dupa.values()].reduce((s, p) => s + p.erori.length, 0);
const verifDupa = [...dupa.values()].reduce(
  (s, p) => s + Object.values(p.verificari || {}).reduce((a, b) => a + b, 0),
  0,
);

console.log(`### Poarta vault-ului\n`);
console.log(
  `${dupa.size} pagini · ${verifDupa} afirmații verificate · ${totalDupa} erori în total\n`,
);

if (!regresii.length) {
  console.log("Nicio eroare în plus față de starea dinainte.");
  process.exit(0);
}

console.log(`**${regresii.length} pagini au căpătat erori noi — se revertesc individual:**\n`);
for (const r of regresii) {
  console.log(`- \`${r.rel}\` — ${r.nVechi} → ${r.nNou}`);
  for (const e of r.erori.slice(0, 5)) console.log(`  - [${e.clasa}] linia ${e.nr}: ${e.mesaj}`);
}
// Numele paginilor de revertit, pe stdout, ca pasul următor să le poată lua.
console.log(`\nREVERT: ${regresii.map((r) => r.rel).join(" ")}`);
process.exit(0);
