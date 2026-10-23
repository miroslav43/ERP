#!/usr/bin/env node
// Compară două amprente `lint-vault --json`, de dinainte și de după trecerea
// agenților. Poarta NU e „zero erori" — vault-ul poate avea deja erori cunoscute
// pe pagini pe care nimeni nu le-a atins. Poarta e „nicio eroare ÎN PLUS", pe
// pagină, exact ca fingerprint-ul de erori de tip din `revizuire.yml`.
//
// Și, ca acolo: comparația o face workflow-ul, nu agentul. Auto-raportarea nu e
// dovadă.
//
// `--familii <fișier>`: câte o familie pe linie, căi separate prin spațiu —
// pagina-mamă și subpaginile NOI pe care spargerea ei le-a creat (le scrie
// pasul „Aplică paginile", nu agentul). O regresie pe oricare membru retrage
// familia ÎNTREAGĂ: doar subpagina ar lăsa mama fără secțiunea mutată și cu un
// wikilink mort, doar mama ar lăsa o subpagină orfană.
import { existsSync, readFileSync } from "node:fs";

const argumente = process.argv.slice(2);
const idxFamilii = argumente.indexOf("--familii");
const caleFamilii = idxFamilii >= 0 ? argumente[idxFamilii + 1] : null;
const [caleA, caleB] = argumente.filter(
  (_, i) => idxFamilii < 0 || (i !== idxFamilii && i !== idxFamilii + 1),
);

const familii =
  caleFamilii && existsSync(caleFamilii)
    ? readFileSync(caleFamilii, "utf8")
        .split("\n")
        .map((l) => l.split(/\s+/).filter(Boolean))
        .filter((f) => f.length > 0)
    : [];
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
  // O pagină trecută DEJA de plafonul dur are eroarea `R` și înainte, și după
  // (1 → 1), deci numărătoarea n-o prindea: `modul/pontaj.md` a crescut așa
  // până la 29 KB pe main. Peste plafon, orice creștere a corpului e regresie;
  // o spargere reușită îl micșorează, deci trece.
  const crescutPestePlafon =
    p.erori.some((e) => e.clasa === "R") &&
    typeof p.corp?.octeti === "number" &&
    typeof vechi?.corp?.octeti === "number" &&
    p.corp.octeti > vechi.corp.octeti;
  if (nNou > nVechi || crescutPestePlafon)
    regresii.push({
      rel,
      nVechi,
      nNou,
      erori: p.erori,
      crescut: crescutPestePlafon ? [vechi.corp.octeti, p.corp.octeti] : null,
    });
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
  console.log(
    r.crescut
      ? `- \`${r.rel}\` — peste plafonul dur și a crescut: ${r.crescut[0]} → ${r.crescut[1]} octeți`
      : `- \`${r.rel}\` — ${r.nVechi} → ${r.nNou}`,
  );
  for (const e of r.erori.slice(0, 5)) console.log(`  - [${e.clasa}] linia ${e.nr}: ${e.mesaj}`);
}
const deRevertit = new Set(regresii.map((r) => r.rel));
for (const familie of familii) {
  if (!familie.some((p) => deRevertit.has(p))) continue;
  const trase = familie.filter((p) => !deRevertit.has(p));
  for (const p of familie) deRevertit.add(p);
  if (trase.length)
    console.log(
      `- retrase odată cu familia lui \`${familie[0]}\`: ${trase.map((p) => `\`${p}\``).join(", ")}`,
    );
}
// Numele paginilor de revertit, pe stdout, ca pasul următor să le poată lua.
console.log(`\nREVERT: ${[...deRevertit].join(" ")}`);
process.exit(0);
