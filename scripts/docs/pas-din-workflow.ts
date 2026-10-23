import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Corpul blocului `run: |` al pasului cu numele dat, fără indentarea YAML.
 *
 * Testele din `scripts/docs/` rulează pașii din `.github/workflows/documentatie.yml`
 * EXACT ca pe runner — `bash -e <fișier>` — în loc să-i rescrie: o copie a
 * pasului în test ar trece și după ce pasul real s-a stricat.
 */
export function pasulDinWorkflow(
  nume: string,
  workflow = join(process.cwd(), ".github/workflows/documentatie.yml"),
): string {
  const linii = readFileSync(workflow, "utf8").split("\n");
  const linia = (i: number): string => linii[i] ?? "";
  const start = linii.findIndex((l) => l.trim() === `- name: ${nume}`);
  if (start < 0) throw new Error(`pasul „${nume}" nu e în ${workflow}`);
  const nivelPas = linia(start).search(/\S/);
  let i = start + 1;
  for (; i < linii.length; i++) {
    const l = linia(i);
    if (l.trim() && l.search(/\S/) <= nivelPas) throw new Error(`pasul „${nume}" n-are run`);
    if (/^\s*run: \|\s*$/.test(l)) break;
  }
  if (i >= linii.length) throw new Error(`pasul „${nume}" n-are run`);
  const nivelRun = linia(i).search(/\S/);
  const corp: string[] = [];
  let nivelCorp = -1;
  for (i += 1; i < linii.length; i++) {
    const l = linia(i);
    if (l.trim() === "") {
      corp.push("");
      continue;
    }
    const nivel = l.search(/\S/);
    if (nivel <= nivelRun) break;
    if (nivelCorp < 0) nivelCorp = nivel;
    corp.push(l.slice(nivelCorp));
  }
  return `${corp.join("\n").trimEnd()}\n`;
}
