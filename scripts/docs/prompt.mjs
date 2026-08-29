#!/usr/bin/env node
// Compune promptul din șablon. Există ca fișier separat dintr-un motiv mecanic:
// un heredoc cu terminatorul la coloana 0 rupe blocul `run: |` din YAML, iar unul
// indentat nu e recunoscut de bash (`<<-` taie doar TAB-uri, nu spații). Șablon +
// substituție explicită evită ambele capcane.
//
// Se substituie DOAR variabilele numite mai jos — toate controlate de noi (SHA-uri,
// nume de repo, căi din RUNNER_TEMP). Nimic din conținutul diff-ului nu ajunge în
// prompt: diff-ul e dat ca FIȘIER, iar skill-ul îi spune agentului că e dată.
import { readFileSync, writeFileSync } from "node:fs";

const [sablon, iesire] = process.argv.slice(2);
const permise = ["REPO", "PAGINA", "SHA_VECHI", "SHA_NOU", "DIR"];

let text = readFileSync(sablon, "utf8");
for (const cheie of permise) {
  const val = process.env[cheie];
  if (val === undefined) throw new Error(`lipsește variabila ${cheie}`);
  if (/[\n\r]/.test(val)) throw new Error(`${cheie} conține linie nouă — refuz`);
  text = text.split(`{{${cheie}}}`).join(val);
}
const ramase = text.match(/\{\{[A-Z_]+\}\}/g);
if (ramase) throw new Error(`substituenți nerezolvați: ${ramase.join(", ")}`);
writeFileSync(iesire, text);
console.log(`prompt scris: ${iesire} (${Buffer.byteLength(text)} octeți)`);
