import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

/**
 * Pasul „Comite și publică" din `.github/workflows/documentatie.yml`, extras din
 * YAML și rulat EXACT ca pe runner — `bash -e <fișier>` (jurnalul GitHub îl
 * afișează: `shell: /usr/bin/bash -e {0}`) — pe un remote bare local.
 *
 * Testul există fiindcă publicarea a picat ȘASE nopți la rând (16–21 oct 2026)
 * fără nicio linie în jurnal: `set -uo pipefail` NU anulează `-e`-ul implicit,
 * iar într-o noapte fără niciun commit pe main în ultimele 24 de ore,
 * `git log … | grep -v '^$'` primea intrare goală, `grep` ieșea cu 1, `pipefail`
 * îl propaga, iar atribuirea `fisiere=$(…)` oprea pasul înainte de commit. Nu
 * ajungea nici la push, nici la mesajul „main s-a mișcat de trei ori". Nimeni
 * nu comitea, deci a doua zi main era din nou inactiv: eșecul se întreținea
 * singur. Starea „main inactiv" e exact cazul pentru care există jurnalul zilei.
 */

const WORKFLOW = join(process.cwd(), ".github/workflows/documentatie.yml");
const SHA = "a".repeat(40);

/** Corpul blocului `run: |` al pasului cu numele dat, fără indentarea YAML. */
function pasulDinWorkflow(nume: string): string {
  const linii = readFileSync(WORKFLOW, "utf8").split("\n");
  const linia = (i: number): string => linii[i] ?? "";
  const start = linii.findIndex((l) => l.trim() === `- name: ${nume}`);
  if (start < 0) throw new Error(`pasul „${nume}" nu e în ${WORKFLOW}`);
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

let dosare: string[] = [];

afterEach(() => {
  for (const d of dosare) rmSync(d, { recursive: true, force: true });
  dosare = [];
});

type Caz = {
  /** Vârsta, în ore, a ultimului commit de pe main la momentul publicării. */
  oreDeLaUltimulCommit: number;
  /** Remote-ul refuză orice push, cu un mesaj propriu (protecție, hook, scope). */
  remoteRefuza?: boolean;
  /** Altcineva a împins pe main după checkout — fetch + merge trebuie să-l prindă. */
  mainMutatIntreTimp?: boolean;
  /**
   * Altcineva împinge pe main EXACT între fetch-ul din buclă și push: push-ul e
   * respins de client („fetch first"), iar bucla trebuie să reia, nu să-l
   * raporteze drept refuz al remote-ului. Singura ramură care justifică bucla.
   */
  mainSeMutaLaPush?: boolean;
  /** O comandă din pas înlocuită cu una care iese cu 1 fără niciun mesaj. */
  comandaCazuta?: string;
};

type Rezultat = { cod: number | null; iesire: string; mesajeMain: string[] };

function ruleaza(caz: Caz): Rezultat {
  const radacina = mkdtempSync(join(tmpdir(), "publicare-docs-"));
  dosare.push(radacina);
  const home = join(radacina, "home");
  const bin = join(radacina, "bin");
  const temp = join(radacina, "temp");
  const remote = join(radacina, "remote.git");
  const runner = join(radacina, "runner");
  for (const d of [home, bin, temp]) mkdirSync(d, { recursive: true });
  writeFileSync(join(home, ".gitconfig"), "");

  // Mediu CURAT: nimic din configurația git a mașinii (semnare, hook-uri
  // globale) și nicio variabilă GIT_* moștenită de la procesul de test.
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    PATH: `${bin}:${dirname(process.execPath)}:${process.env.PATH ?? "/usr/bin:/bin"}`,
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: join(home, ".gitconfig"),
    LC_ALL: "C.UTF-8",
  };
  const data = new Date(Date.now() - caz.oreDeLaUltimulCommit * 3_600_000).toISOString();
  const autor: NodeJS.ProcessEnv = {
    ...env,
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
    GIT_AUTHOR_DATE: data,
    GIT_COMMITTER_DATE: data,
  };
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, env: autor, stdio: "pipe" });

  // `prettier` nu face obiectul testului; pasul îl cheamă cu `|| true`.
  writeFileSync(join(bin, "pnpm"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(bin, "pnpm"), 0o755);

  git(radacina, "init", "-q", "--bare", "-b", "main", remote);
  git(radacina, "clone", "-q", remote, runner);
  const fisier = (cale: string, continut: string) => {
    mkdirSync(dirname(join(runner, cale)), { recursive: true });
    writeFileSync(join(runner, cale), continut);
  };
  fisier(".claude/docs/meta/log.md", "# Jurnal\n");
  fisier(".claude/docs/modul/x.md", `---\nscris_pe: ${SHA}\nscris_la: 2026-10-01\n---\n\n# X\n`);
  fisier(
    "scripts/docs/acoperire.mjs",
    "console.log(JSON.stringify({ fierbintiFaraPagina: [] }));\n",
  );
  git(runner, "add", "-A");
  git(runner, "commit", "-q", "-m", "baza");
  git(runner, "push", "-q", "origin", "HEAD:main");

  if (caz.mainMutatIntreTimp) {
    const altul = join(radacina, "altul");
    git(radacina, "clone", "-q", remote, altul);
    writeFileSync(join(altul, "README.md"), "commit al altcuiva\n");
    git(altul, "add", "README.md");
    git(altul, "commit", "-q", "-m", "commit al altcuiva");
    git(altul, "push", "-q", "origin", "HEAD:main");
  }
  if (caz.remoteRefuza) {
    const hook = join(remote, "hooks", "pre-receive");
    writeFileSync(hook, '#!/bin/sh\necho "regula de test: push refuzat" >&2\nexit 1\n');
    chmodSync(hook, 0o755);
  }

  // Pagina „aplicată" de jobul `pagina`, ca în arborele real.
  appendFileSync(join(runner, ".claude/docs/modul/x.md"), "\nrând nou\n");
  if (caz.comandaCazuta) {
    writeFileSync(join(bin, caz.comandaCazuta), "#!/bin/sh\nexit 1\n");
    chmodSync(join(bin, caz.comandaCazuta), 0o755);
  }
  if (caz.mainSeMutaLaPush) {
    // Scris DUPĂ pregătire: și ajutorul `git` al testului trece prin `bin`.
    // Primul `git push` al pasului împinge întâi, din altă clonă, un commit pe
    // main, apoi rulează push-ul real — care vede main mutat și e respins.
    const gitReal = execFileSync("sh", ["-c", "command -v git"], { env, encoding: "utf8" }).trim();
    const altul = join(radacina, "altul-la-push");
    git(radacina, "clone", "-q", remote, altul);
    git(altul, "config", "user.name", "altcineva");
    git(altul, "config", "user.email", "altcineva@example.invalid");
    const marcaj = join(radacina, "push-interceptat");
    writeFileSync(
      join(bin, "git"),
      [
        "#!/bin/sh",
        `if [ "$1" = "push" ] && [ ! -e '${marcaj}' ]; then`,
        `  : > '${marcaj}'`,
        `  '${gitReal}' -C '${altul}' commit -q --allow-empty -m "împins în timpul publicării" >&2`,
        `  '${gitReal}' -C '${altul}' push -q origin HEAD:main >&2`,
        "fi",
        `exec '${gitReal}' "$@"`,
        "",
      ].join("\n"),
    );
    chmodSync(join(bin, "git"), 0o755);
    // Reluarea așteaptă `sleep $((i * 5))`; aici n-are ce aștepta.
    writeFileSync(join(bin, "sleep"), "#!/bin/sh\nexit 0\n");
    chmodSync(join(bin, "sleep"), 0o755);
  }

  const script = join(radacina, "pas.sh");
  writeFileSync(script, pasulDinWorkflow("Comite și publică"));
  const r = spawnSync("bash", ["-e", script], {
    cwd: runner,
    env: { ...env, RUNNER_TEMP: temp, GITHUB_SHA: SHA },
    encoding: "utf8",
    timeout: 30_000,
  });
  const mesajeMain = execFileSync("git", ["--git-dir", remote, "log", "--format=%s", "main"], {
    env,
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  return { cod: r.status, iesire: `${r.stdout}${r.stderr}`, mesajeMain };
}

// Fiecare caz pornește o duzină de procese git și un bash, SINCRON: pe o
// mașină încărcată trec de cele 5000 ms implicite fără să fie greșite.
describe.skipIf(process.platform === "win32")(
  "documentatie.yml — pasul „Comite și publică”",
  { timeout: 30_000 },
  () => {
    it("publică într-o noapte fără niciun commit pe main în ultimele 24 de ore", () => {
      const r = ruleaza({ oreDeLaUltimulCommit: 25 });

      expect(r.iesire).toContain("Publicat.");
      expect(r.cod).toBe(0);
      expect(r.mesajeMain[0]).toMatch(/^docs\(vault\): sincronizare automată/);
    });

    it("publică și când main a avut commit-uri azi (noaptea de 15 oct, cea reușită)", () => {
      const r = ruleaza({ oreDeLaUltimulCommit: 1 });

      expect(r.cod).toBe(0);
      expect(r.mesajeMain[0]).toMatch(/^docs\(vault\): sincronizare automată/);
    });

    it("prinde un commit împins de altcineva după checkout, prin fetch + merge", () => {
      const r = ruleaza({ oreDeLaUltimulCommit: 1, mainMutatIntreTimp: true });

      expect(r.cod).toBe(0);
      expect(r.mesajeMain).toContain("commit al altcuiva");
      expect(r.mesajeMain[0]).toMatch(/^Merge /);
    });

    it("main mutat între fetch și push: push-ul respins se reia, cu fetch + merge", () => {
      const r = ruleaza({ oreDeLaUltimulCommit: 1, mainSeMutaLaPush: true });

      expect(r.iesire).toMatch(/\[rejected\].*\((fetch first|non-fast-forward)\)/);
      expect(r.iesire).toContain("::warning title=main s-a mișcat::încercarea 1");
      expect(r.iesire).not.toContain("Push refuzat");
      expect(r.iesire).toContain("Publicat.");
      expect(r.cod).toBe(0);
      expect(r.mesajeMain).toContain("împins în timpul publicării");
      expect(r.mesajeMain[0]).toMatch(/^Merge /);
    });

    it("un push refuzat de remote își arată motivul și nu se dă drept „main s-a mișcat”", () => {
      const r = ruleaza({ oreDeLaUltimulCommit: 1, remoteRefuza: true });

      expect(r.cod).toBe(1);
      expect(r.iesire).toContain("regula de test: push refuzat");
      const eroare = r.iesire.split("\n").find((l) => l.startsWith("::error"));
      expect(eroare).toBeDefined();
      expect(eroare).toContain("remote rejected");
      expect(eroare).not.toContain("main s-a mișcat");
      // Un refuz al remote-ului nu se repară reluând: o singură încercare.
      // (Liniile push-ului încep cu „ ! "; adnotarea, care le citează, cu „::".)
      expect(r.iesire.match(/^ ! \[remote rejected\]/gm)).toHaveLength(1);
      expect(r.mesajeMain).toEqual(["baza"]);
    });

    it("o comandă care pică tăcut în pas lasă o adnotare cu linia, nu un simplu cod 1", () => {
      // Plasa de sub reparație: orice altă cădere sub `bash -e` trebuie să se
      // vadă, fiindcă cele șase nopți au murit fără niciun rând în jurnal.
      // `date` care iese cu 1 FĂRĂ mesaj e aceeași formă ca `grep` de atunci:
      // o atribuire `x=$(…)` care cade și oprește pasul.
      const r = ruleaza({ oreDeLaUltimulCommit: 1, comandaCazuta: "date" });

      expect(r.cod).not.toBe(0);
      expect(r.iesire).toMatch(/^::error title=[^:]+::linia \d+/m);
      expect(r.mesajeMain).toEqual(["baza"]);
    });
  },
);
