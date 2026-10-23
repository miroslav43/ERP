import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { pasulDinWorkflow } from "./pas-din-workflow";

/**
 * Spargerea paginilor de vault care trec de plafonul dur.
 *
 * Până la 23 oct 2026, o pagină pe care nocturna o împingea peste plafonul dur
 * căpăta eroarea `R` a lintului, comparația o declara regresie, iar pagina se
 * revertea — în FIECARE noapte, fiindcă `scris_pe` nu avansa și diff-ul de
 * recitit doar creștea. Pagina nu se mai actualiza niciodată. Iar una care
 * trecuse DEJA de plafon nu mai era revertită deloc (1 → 1 erori), deci creștea
 * nestingherită: `modul/pontaj.md` ajunsese la 29 KB pe main.
 *
 * Decizia: agentul SPARGE pagina în subpagini NOI (`<pagina>/<sub>.md`), după
 * `.claude/docs/meta/conventii.md`. `docs:lint` rămâne poarta: subpagina e o
 * pagină ca oricare, plus regula că pagina-mamă trebuie s-o lege.
 *
 * Pașii de workflow se rulează EXACT ca pe runner (`bash -e`), extrași din YAML.
 */

const SHA = "a".repeat(40);
const RADACINA_REPO = process.cwd();
const LINT = join(RADACINA_REPO, "scripts/docs/lint-vault.mjs");
const COMPARA = join(RADACINA_REPO, "scripts/docs/lint-compara.mjs");

let dosare: string[] = [];
afterEach(() => {
  for (const d of dosare) rmSync(d, { recursive: true, force: true });
  dosare = [];
});

function dosarNou(): string {
  const d = mkdtempSync(join(tmpdir(), "spargere-docs-"));
  dosare.push(d);
  return d;
}

/**
 * Mediu CURAT: fără `CLAUDE_PROJECT_DIR` moștenit (lintul își ia rădăcina din
 * el — într-o sesiune Claude Code ar arăta spre arborele principal) și fără
 * configurația git a mașinii.
 */
function mediu(radacina: string): NodeJS.ProcessEnv {
  const home = join(radacina, "home");
  mkdirSync(home, { recursive: true });
  writeFileSync(join(home, ".gitconfig"), "");
  return {
    NODE_ENV: "test",
    PATH: `${dirname(process.execPath)}:${process.env.PATH ?? "/usr/bin:/bin"}`,
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: join(home, ".gitconfig"),
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
    LC_ALL: "C.UTF-8",
  };
}

function pagina(titlu: string, corp: string, extra: { faraCai?: boolean } = {}): string {
  return [
    "---",
    "tip: modul",
    `titlu: ${titlu}`,
    ...(extra.faraCai ? [] : ["cai:", '  - "src/x/**"']),
    "tabele: []",
    "permisiuni: []",
    "capcane: []",
    `scris_pe: ${SHA}`,
    "scris_la: 2026-10-01",
    "---",
    "",
    corp,
  ].join("\n");
}

function scrie(radacina: string, cale: string, continut: string): void {
  mkdirSync(dirname(join(radacina, cale)), { recursive: true });
  writeFileSync(join(radacina, cale), continut);
}

/** Un repo git cu fișierele date, comise pe `main`. */
function repo(fisiere: Record<string, string>): { dir: string; env: NodeJS.ProcessEnv } {
  const radacina = dosarNou();
  const env = mediu(radacina);
  const dir = join(radacina, "runner");
  mkdirSync(dir);
  for (const [cale, continut] of Object.entries(fisiere)) scrie(dir, cale, continut);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, env, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "baza");
  return { dir, env };
}

function ruleazaPas(nume: string, cwd: string, env: NodeJS.ProcessEnv) {
  const script = join(dirname(cwd), `pas-${nume.replace(/\W+/g, "-")}.sh`);
  writeFileSync(script, pasulDinWorkflow(nume));
  const r = spawnSync("bash", ["-e", script], { cwd, env, encoding: "utf8", timeout: 30_000 });
  return { cod: r.status, iesire: `${r.stdout}${r.stderr}` };
}

const MAMA = ".claude/docs/modul/x.md";
const NOU = ".claude/docs/modul/x/nou.md";

describe("docs:lint — subpaginile rămân sub poartă", () => {
  function lint(fisiere: Record<string, string>) {
    const radacina = dosarNou();
    mkdirSync(join(radacina, "supabase/migrations"), { recursive: true });
    for (const [cale, continut] of Object.entries(fisiere)) scrie(radacina, cale, continut);
    const r = spawnSync("node", [LINT, "--json"], {
      env: { ...mediu(radacina), CLAUDE_PROJECT_DIR: radacina },
      encoding: "utf8",
    });
    const json = JSON.parse(r.stdout) as {
      pagini: {
        rel: string;
        erori: { clasa: string; mesaj: string }[];
        corp?: { octeti: number; tinta: number; dur: number };
      }[];
    };
    const pag = (rel: string) => json.pagini.find((p) => p.rel === rel);
    return { cod: r.status, pag };
  }

  it("o subpagină pe care pagina-mamă n-o leagă e eroare: cine citește mama n-o găsește", () => {
    const r = lint({
      [MAMA]: pagina("X", "# X\n\nTrunchiul.\n"),
      [NOU]: pagina("X — nou", "# X — nou\n\nSecțiune extrasă din [[modul/x]].\n"),
    });

    expect(r.cod).toBe(1);
    // Eroarea e a mamei: ea trebuie să lege subpagina, ea se revertește.
    const erori = r.pag(MAMA)?.erori ?? [];
    expect(erori.some((e) => e.clasa === "H" && e.mesaj.includes("[[modul/x/nou]]"))).toBe(true);
    expect(r.pag(NOU)?.erori).toEqual([]);
  });

  it("legată din mamă, subpagina trece", () => {
    const r = lint({
      [MAMA]: pagina(
        "X",
        "# X\n\n| Pagină | Ce ține |\n| --- | --- |\n| [[modul/x/nou]] | restul |\n",
      ),
      [NOU]: pagina("X — nou", "# X — nou\n\nSecțiune extrasă din [[modul/x]].\n"),
    });

    expect(r.pag(NOU)?.erori).toEqual([]);
    expect(r.pag(MAMA)?.erori).toEqual([]);
    expect(r.cod).toBe(0);
  });

  it("lintul dă mărimea corpului, ca workflow-ul să MĂSOARE plafonul, nu agentul să-l ghicească", () => {
    const corp = "# X\n\n" + "rând de proză\n".repeat(1000);
    const r = lint({ [MAMA]: pagina("X", corp) });

    const p = r.pag(MAMA);
    // Corpul începe după `---\n`, deci include rândul gol de după frontmatter.
    expect(p?.corp).toEqual({ octeti: Buffer.byteLength(`\n${corp}`), tinta: 8192, dur: 12288 });
    expect(p?.erori.some((e) => e.clasa === "R")).toBe(true);
  });
});

describe("lint-compara — o spargere se revertește ÎNTREAGĂ", () => {
  function compara(familii: string | null) {
    const d = dosarNou();
    const inainte = { pagini: [{ rel: MAMA, erori: [] }] };
    const dupa = {
      pagini: [
        { rel: MAMA, erori: [] },
        { rel: NOU, erori: [{ clasa: "FM", nr: 1, mesaj: "lipsește `cai`" }] },
      ],
    };
    writeFileSync(join(d, "a.json"), JSON.stringify(inainte));
    writeFileSync(join(d, "b.json"), JSON.stringify(dupa));
    const args = [COMPARA, join(d, "a.json"), join(d, "b.json")];
    if (familii !== null) {
      writeFileSync(join(d, "familii.txt"), familii);
      args.push("--familii", join(d, "familii.txt"));
    }
    const r = spawnSync("node", args, { encoding: "utf8" });
    const linie = r.stdout.split("\n").find((l) => l.startsWith("REVERT: ")) ?? "";
    return linie.slice("REVERT: ".length).split(" ").filter(Boolean).sort();
  }

  it("o subpagină nouă stricată trage după ea și pagina-mamă golită de secțiune", () => {
    // Revertul doar al subpaginii ar lăsa mama fără secțiunea mutată și cu un
    // wikilink mort; doar al mamei, o subpagină orfană.
    expect(compara(`${MAMA} ${NOU}\n`)).toEqual([MAMA, NOU].sort());
  });

  it("fără familii, comportamentul rămâne cel vechi: doar pagina cu erori noi", () => {
    expect(compara(null)).toEqual([NOU]);
  });

  it("o pagină DEJA peste plafon care mai crește e regresie, deși are tot o eroare `R`", () => {
    const d = dosarNou();
    const R = { clasa: "R", nr: 1, mesaj: "peste plafon" };
    const fisier = (nume: string, octeti: number) => {
      writeFileSync(
        join(d, nume),
        JSON.stringify({
          pagini: [{ rel: MAMA, erori: [R], corp: { octeti, tinta: 8192, dur: 12288 } }],
        }),
      );
      return join(d, nume);
    };
    const a = fisier("a.json", 29_000);
    const revert = (b: string) =>
      spawnSync("node", [COMPARA, a, b], { encoding: "utf8" }).stdout.includes(`REVERT: ${MAMA}`);

    expect(revert(fisier("crescut.json", 30_000))).toBe(true);
    // Spargerea care n-a coborât încă sub plafon, dar a micșorat pagina, trece.
    expect(revert(fisier("micsorat.json", 13_000))).toBe(false);
  });

  it("un fișier de familii lipsă nu oprește comparația", () => {
    const d = dosarNou();
    writeFileSync(join(d, "a.json"), JSON.stringify({ pagini: [] }));
    writeFileSync(join(d, "b.json"), JSON.stringify({ pagini: [] }));
    const r = spawnSync(
      "node",
      [COMPARA, join(d, "a.json"), join(d, "b.json"), "--familii", join(d, "nu-exista.txt")],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Nicio eroare în plus");
  });
});

// Fiecare caz pornește procese git și un bash, SINCRON: pe o mașină încărcată
// trec de cele 5000 ms implicite fără să fie greșite.
describe.skipIf(process.platform === "win32")(
  "documentatie.yml — spargerea ajunge pe main, iar poarta o judecă întreagă",
  { timeout: 30_000 },
  () => {
    /**
     * Pasul „Rescrie pagina” cu un `claude` FALS în PATH: prima trecere scrie
     * pagina primită cu corpul de mărimea dată; a doua (recunoscută după
     * promptul ei) o sparge. Jurnalul spune de câte ori a fost chemat agentul.
     */
    function rescrie(octetiDupaPrimaTrecere: number) {
      const { dir, env } = repo({
        [MAMA]: pagina("X", "# X\n"),
        "supabase/migrations/.gitkeep": "",
      });
      for (const f of [
        "scripts/docs/prompt.mjs",
        "scripts/docs/lint-vault.mjs",
        ".github/documentatie-prompt.md",
        ".github/documentatie-sparge-prompt.md",
      ]) {
        mkdirSync(dirname(join(dir, f)), { recursive: true });
        copyFileSync(join(RADACINA_REPO, f), join(dir, f));
      }
      const radacina = dirname(dir);
      const bin = join(radacina, "bin");
      const lucru = join(radacina, "lucru");
      mkdirSync(bin);
      mkdirSync(lucru);
      const jurnal = join(radacina, "apeluri.txt");
      const mare = pagina("X", `# X\n\n${"x".repeat(octetiDupaPrimaTrecere)}\n`);
      const mic = pagina(
        "X",
        "# X\n\n| Pagină | Ce ține |\n| --- | --- |\n| [[modul/x/nou]] | tot |\n",
      );
      writeFileSync(join(radacina, "mare.md"), mare);
      writeFileSync(join(radacina, "mic.md"), mic);
      writeFileSync(
        join(radacina, "nou.md"),
        pagina("X — nou", "# nou\n\nExtrasă din [[modul/x]].\n"),
      );
      writeFileSync(
        join(bin, "claude"),
        [
          "#!/bin/sh",
          'case "$2" in',
          `  *"A doua trecere: SPARGEREA"*) echo sparge >> '${jurnal}'; mkdir -p .claude/docs/modul/x; cp '${radacina}/mic.md' '${MAMA}'; cp '${radacina}/nou.md' '${NOU}' ;;`,
          `  *) echo rescrie >> '${jurnal}'; cp '${radacina}/mare.md' '${MAMA}' ;;`,
          "esac",
          'echo "{}"',
          "",
        ].join("\n"),
      );
      chmodSync(join(bin, "claude"), 0o755);
      const iesiri = join(radacina, "github.output");
      writeFileSync(iesiri, "");
      const r = ruleazaPas("Rescrie pagina", dir, {
        ...env,
        PATH: `${bin}:${env.PATH}`,
        GITHUB_OUTPUT: iesiri,
        GITHUB_REPOSITORY: "test/repo",
        GITHUB_SHA: SHA,
        PAGINA: MAMA,
        DIR: lucru,
        VECHI: SHA,
        SUBDIR: MAMA.replace(/\.md$/, ""),
        OCTETI: "10",
        TINTA: "8192",
        DUR: "12288",
      });
      const apeluri = existsSync(jurnal) ? readFileSync(jurnal, "utf8").trim().split("\n") : [];
      return { ...r, dir, lucru, apeluri };
    }

    it("o rescriere care trece de plafonul dur e urmată de spargere, nu lăsată revertului", () => {
      const r = rescrie(14_000);

      expect(r.cod).toBe(0);
      expect(r.apeluri).toEqual(["rescrie", "sparge"]);
      expect(r.iesire).toContain("::notice title=Peste plafon::");
      const prompt = readFileSync(join(r.lucru, "prompt-sparge.txt"), "utf8");
      expect(prompt).toContain(`SUBPAGINI: ${MAMA.replace(/\.md$/, "")}/`);
      expect(prompt).toMatch(/CORP: 140\d\d octeți/);
      expect(existsSync(join(r.dir, NOU))).toBe(true);
    });

    it("o rescriere sub plafon nu cheamă a doua trecere", () => {
      const r = rescrie(2_000);

      expect(r.cod).toBe(0);
      expect(r.apeluri).toEqual(["rescrie"]);
      expect(existsSync(join(r.lucru, "prompt-sparge.txt"))).toBe(false);
    });

    it("împachetarea ia DOAR pagina primită și subpaginile ei NOI", () => {
      const { dir, env } = repo({
        [MAMA]: pagina("X", "# X\n"),
        ".claude/docs/modul/x/vechi.md": pagina("X — vechi", "# vechi\n"),
        "src/a.ts": "export {};\n",
      });
      const lucru = join(dirname(dir), "lucru");
      mkdirSync(lucru);
      writeFileSync(
        join(lucru, "rezumat.json"),
        JSON.stringify({ pagina: MAMA, modificata: true }),
      );
      scrie(dir, MAMA, pagina("X", "# X\n\n[[modul/x/nou]]\n"));
      scrie(dir, NOU, pagina("X — nou", "# nou\n"));
      scrie(dir, ".claude/docs/modul/x/adanc/y.md", "# prea adânc\n");
      scrie(dir, ".claude/docs/modul/x/RAU.md", "# nume în afara convenției\n");
      scrie(dir, ".claude/docs/modul/x/vechi.md", "# subpagina altui job, rescrisă\n");
      scrie(dir, ".claude/docs/modul/alta.md", "# altă pagină\n");
      scrie(dir, "src/a.ts", "export const rau = 1;\n");

      const r = ruleazaPas("Împachetează rezultatul", dir, { ...env, PAGINA: MAMA, DIR: lucru });

      expect(r.cod).toBe(0);
      const livrare = join(lucru, "livrare");
      expect(readFileSync(join(livrare, "pagina.md"), "utf8")).toContain("[[modul/x/nou]]");
      expect(readFileSync(join(livrare, "subpagini.tsv"), "utf8")).toBe(`sub-1.md\t${NOU}\n`);
      expect(readFileSync(join(livrare, "sub-1.md"), "utf8")).toContain("# nou");
      expect(existsSync(join(livrare, "sub-2.md"))).toBe(false);
      for (const ignorat of [
        ".claude/docs/modul/x/adanc/y.md",
        ".claude/docs/modul/x/RAU.md",
        ".claude/docs/modul/x/vechi.md",
        ".claude/docs/modul/alta.md",
        "src/a.ts",
      ])
        expect(r.iesire).toContain(`::warning title=Schimbare ignorată::${ignorat}`);
    });

    function aplica(subpagini: string) {
      const { dir, env } = repo({
        [MAMA]: pagina("X", "# X\n"),
        ".claude/docs/modul/x/vechi.md": pagina("X — vechi", "# vechi\n"),
      });
      const temp = join(dirname(dir), "temp");
      const art = join(temp, "artefacte/pagina-0");
      mkdirSync(art, { recursive: true });
      writeFileSync(join(art, "rezumat.json"), JSON.stringify({ pagina: MAMA, modificata: true }));
      writeFileSync(join(art, "pagina.md"), pagina("X", "# X\n\n[[modul/x/nou]]\n"));
      writeFileSync(join(art, "sub-1.md"), pagina("X — nou", "# nou\n"));
      writeFileSync(join(art, "subpagini.tsv"), subpagini);
      const githubEnv = join(temp, "github.env");
      writeFileSync(githubEnv, "");
      const r = ruleazaPas("Aplică paginile", dir, {
        ...env,
        RUNNER_TEMP: temp,
        GITHUB_ENV: githubEnv,
      });
      const familii = join(temp, "familii.txt");
      return {
        ...r,
        dir,
        familii: existsSync(familii) ? readFileSync(familii, "utf8") : "",
        githubEnv: readFileSync(githubEnv, "utf8"),
      };
    }

    it("aplicarea pune subpagina nouă lângă mamă și le notează ca familie", () => {
      const r = aplica(`sub-1.md\t${NOU}\n`);

      expect(r.cod).toBe(0);
      expect(readFileSync(join(r.dir, MAMA), "utf8")).toContain("[[modul/x/nou]]");
      expect(readFileSync(join(r.dir, NOU), "utf8")).toContain("# nou");
      expect(r.familii).toBe(`${MAMA} ${NOU}\n`);
      expect(r.githubEnv).toContain("aplicate=2");
    });

    it.each([
      [".claude/docs/modul/alta/nou.md", "sub altă pagină"],
      [".claude/docs/modul/x/../../../../evadare.md", "cu `..`"],
      [".claude/docs/modul/x/adanc/nou.md", "pe două niveluri"],
      [".claude/docs/modul/x/Nou Rau.md", "cu nume în afara convenției"],
    ])("refuză o subpagină %s (%s)", (cale) => {
      const r = aplica(`sub-1.md\t${cale}\n`);

      expect(r.cod).toBe(1);
      expect(r.iesire).toMatch(/^::error title=Subpagină refuzată::/m);
      expect(existsSync(join(r.dir, cale))).toBe(false);
    });

    it("nu suprascrie o subpagină care există deja: aia are jobul ei", () => {
      const r = aplica("sub-1.md\t.claude/docs/modul/x/vechi.md\n");

      expect(r.cod).toBe(0);
      expect(r.iesire).toContain("::warning title=Subpagină existentă::");
      expect(readFileSync(join(r.dir, ".claude/docs/modul/x/vechi.md"), "utf8")).toContain(
        "# vechi",
      );
    });

    function lintDupa(subpagina: string) {
      const continutMama = pagina("X", "# X\n\nTrunchiul și secțiunea care pleacă.\n");
      const { dir, env } = repo({
        [MAMA]: continutMama,
        "supabase/migrations/.gitkeep": "",
        "scripts/docs/.gitkeep": "",
      });
      for (const s of ["lint-vault.mjs", "lint-compara.mjs"])
        copyFileSync(join(RADACINA_REPO, "scripts/docs", s), join(dir, "scripts/docs", s));
      const temp = join(dirname(dir), "temp");
      mkdirSync(temp);
      const inainte = spawnSync("node", ["scripts/docs/lint-vault.mjs", "--json"], {
        cwd: dir,
        env,
        encoding: "utf8",
      });
      writeFileSync(join(temp, "lint-inainte.json"), inainte.stdout);

      // Ce lasă în arbore „Aplică paginile" după o spargere.
      scrie(dir, MAMA, pagina("X", "# X\n\nTrunchiul. Restul: [[modul/x/nou]].\n"));
      scrie(dir, NOU, subpagina);
      writeFileSync(join(temp, "familii.txt"), `${MAMA} ${NOU}\n`);

      const r = ruleazaPas("Lint după, comparat independent", dir, {
        ...env,
        RUNNER_TEMP: temp,
        GITHUB_STEP_SUMMARY: join(temp, "rezumat.md"),
      });
      return { ...r, dir, continutMama };
    }

    it("o spargere cu o subpagină stricată se retrage ÎNTREAGĂ, iar publicarea continuă", () => {
      // Înainte: revertul făcea `git checkout HEAD -- <subpagina nouă>`, care
      // pică pe un fișier neurmărit; subpagina rămânea, verificarea finală o
      // găsea tot stricată și toată noaptea se anula.
      const r = lintDupa(
        pagina("X — nou", "# nou\n\nSecțiune extrasă din [[modul/x]].\n", { faraCai: true }),
      );

      expect(r.cod).toBe(0);
      expect(existsSync(join(r.dir, NOU))).toBe(false);
      expect(readFileSync(join(r.dir, MAMA), "utf8")).toBe(r.continutMama);
      expect(r.iesire).not.toContain("Revertul n-a curățat regresiile");
    });

    it("o spargere curată trece de poartă și rămâne în arbore", () => {
      const r = lintDupa(pagina("X — nou", "# nou\n\nSecțiune extrasă din [[modul/x]].\n"));

      expect(r.cod).toBe(0);
      expect(r.iesire).toContain("Nicio eroare în plus");
      expect(existsSync(join(r.dir, NOU))).toBe(true);
      expect(readFileSync(join(r.dir, MAMA), "utf8")).toContain("[[modul/x/nou]]");
    });

    it("o mamă rescrisă care pierde legătura spre o subpagină EXISTENTĂ e revertită ea, iar noaptea continuă", () => {
      // Vina e a mamei: ea a scos rândul din tabelul paginilor. Dacă eroarea
      // stă pe subpagină, revertul face `git checkout` pe subpagina neatinsă
      // (nimic de revertit), verificarea finală o găsește tot stricată și se
      // anulează publicarea TUTUROR paginilor din noaptea aia.
      const VECHI = ".claude/docs/modul/x/vechi.md";
      const continutMama = pagina("X", "# X\n\nTrunchiul. Restul: [[modul/x/vechi]].\n");
      const { dir, env } = repo({
        [MAMA]: continutMama,
        [VECHI]: pagina("X — vechi", "# vechi\n\nSecțiune extrasă din [[modul/x]].\n"),
        "supabase/migrations/.gitkeep": "",
        "scripts/docs/.gitkeep": "",
      });
      for (const s of ["lint-vault.mjs", "lint-compara.mjs"])
        copyFileSync(join(RADACINA_REPO, "scripts/docs", s), join(dir, "scripts/docs", s));
      const temp = join(dirname(dir), "temp");
      mkdirSync(temp);
      const inainte = spawnSync("node", ["scripts/docs/lint-vault.mjs", "--json"], {
        cwd: dir,
        env,
        encoding: "utf8",
      });
      expect(inainte.status).toBe(0);
      writeFileSync(join(temp, "lint-inainte.json"), inainte.stdout);

      scrie(dir, MAMA, pagina("X", "# X\n\nTrunchiul, rescris fără tabelul paginilor.\n"));
      writeFileSync(join(temp, "familii.txt"), `${MAMA}\n`);

      const r = ruleazaPas("Lint după, comparat independent", dir, {
        ...env,
        RUNNER_TEMP: temp,
        GITHUB_STEP_SUMMARY: join(temp, "rezumat.md"),
      });

      expect(r.iesire).not.toContain("Revertul n-a curățat regresiile");
      expect(r.cod).toBe(0);
      expect(readFileSync(join(dir, MAMA), "utf8")).toBe(continutMama);
    });
  },
);
