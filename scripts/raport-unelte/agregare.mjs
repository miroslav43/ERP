// scripts/raport-unelte/agregare.mjs
/**
 * Raportul săptămânal al uneltelor gratuite — partea pură, fără rețea și fără
 * parolă, ca testul (`agregare.test.ts`) s-o poată verifica.
 *
 * Numele evenimentelor de server vin din `src/lib/unelte/masurare.ts`:
 *   dl:<unealtă>:<format>:<clasă>   o descărcare; clasa: om, neconfirmat, robot, audit
 *   calc:calculator-salariu:<clasă> un calcul de salariu, numărat la randarea paginii
 *   cont:<sursă>                    un cont creat; sursa e unealta sau „direct”
 *
 * Descărcările și calculele poartă și câmpuri (proprietăți de eveniment Umami):
 * luna, anul, câți angajați, programul, treapta brutului — lista albă e în
 * `src/lib/unelte/date-eveniment.ts`. `randeazaDate` le pune într-o tabelă.
 *
 * `.mjs`, nu `.ts`: pe VM rulează Node 20, fără eliminarea tipurilor.
 */

const ZI = 24 * 60 * 60 * 1000;

export const CLASE = ["om", "neconfirmat", "robot", "audit"];

const DESCARCARE = /^dl:([a-z0-9-]+):([a-z0-9]+):(om|neconfirmat|robot|audit)$/u;
const CONT = /^cont:([a-z0-9-]+)$/u;
const CALCUL = /^calc:calculator-salariu:(om|neconfirmat|robot|audit)$/u;
const DIN_BROWSER = /-(?:genereaza|pdf|docx|xlsx)$|^cta-|^modul-din-|^inregistrare-trimisa$/u;

/** O cheie din `.env`, citită pe linie, fără `source` (ca `umami-goaluri.sh`). */
export function valoareDinEnv(text, cheie) {
  for (const linie of text.split(/\r?\n/u)) {
    if (!linie.startsWith(`${cheie}=`)) continue;
    let valoare = linie.slice(cheie.length + 1).trim();
    const intre = (c) => valoare.length >= 2 && valoare.startsWith(c) && valoare.endsWith(c);
    if (intre('"') || intre("'")) valoare = valoare.slice(1, -1);
    return valoare === "" ? null : valoare;
  }
  return null;
}

/** Umami 3.3.1 dă numere; versiunile vechi dădeau `{ value, prev }`. */
export function numar(v) {
  const brut = typeof v === "object" && v !== null && "value" in v ? v.value : v;
  const n = Number(brut);
  return Number.isFinite(n) ? n : 0;
}

function etichetaIso(luni) {
  const joi = new Date(luni.getTime() + 3 * ZI);
  const an = joi.getUTCFullYear();
  const saptamana = 1 + Math.floor((joi.getTime() - Date.UTC(an, 0, 1)) / ZI / 7);
  return `${an}-S${String(saptamana).padStart(2, "0")}`;
}

/** Ultima săptămână ISO încheiată, în UTC: luni 00:00 → duminică 23:59:59.999. */
export function saptamanaTrecuta(acum) {
  const azi = Date.UTC(acum.getUTCFullYear(), acum.getUTCMonth(), acum.getUTCDate());
  const dinLuni = (new Date(azi).getUTCDay() + 6) % 7;
  const luniaAceasta = azi - dinLuni * ZI;
  const de = new Date(luniaAceasta - 7 * ZI);
  return { de, pana: new Date(luniaAceasta - 1), eticheta: etichetaIso(de) };
}

/** `--de-la 2026-10-01 --pana-la 2026-10-07`: ambele zile incluse. */
export function intervalExplicit(deLa, panaLa) {
  const forma = /^\d{4}-\d{2}-\d{2}$/u;
  if (!forma.test(deLa) || !forma.test(panaLa)) throw new Error("Datele se scriu AAAA-LL-ZZ.");
  const de = new Date(`${deLa}T00:00:00Z`);
  const sfarsit = Date.parse(`${panaLa}T00:00:00Z`);
  if (Number.isNaN(de.getTime()) || Number.isNaN(sfarsit)) throw new Error("Data nu există.");
  const pana = new Date(sfarsit + ZI - 1);
  if (de.getTime() > pana.getTime()) throw new Error("Intervalul e inversat.");
  return { de, pana, eticheta: `${deLa} – ${panaLa}` };
}

export function parseazaEvenimente(randuri) {
  const unelte = new Map();
  const rand = (slug) => {
    let r = unelte.get(slug);
    if (r === undefined) {
      r = { om: 0, neconfirmat: 0, robot: 0, audit: 0, formate: {}, conturi: 0 };
      unelte.set(slug, r);
    }
    return r;
  };
  let conturiDirecte = 0;
  const calcule = { om: 0, neconfirmat: 0, robot: 0, audit: 0 };
  const browser = [];
  for (const { x, y } of randuri) {
    const n = numar(y);
    const dl = DESCARCARE.exec(x);
    if (dl !== null) {
      const [, slug, format, clasa] = dl;
      const r = rand(slug);
      r[clasa] += n;
      if (clasa === "om" || clasa === "neconfirmat")
        r.formate[format] = (r.formate[format] ?? 0) + n;
      continue;
    }
    const calc = CALCUL.exec(x);
    if (calc !== null) {
      calcule[calc[1]] += n;
      continue;
    }
    const cont = CONT.exec(x);
    if (cont !== null) {
      if (cont[1] === "direct") conturiDirecte += n;
      else rand(cont[1]).conturi += n;
      continue;
    }
    if (DIN_BROWSER.test(x)) browser.push({ nume: x, numar: n });
  }
  browser.sort((a, b) => b.numar - a.numar || a.nume.localeCompare(b.nume));
  return { unelte, conturiDirecte, calcule, browser };
}

/**
 * Datele evenimentelor de server: un rând pe (eveniment, câmp), cu valorile și
 * numărul lor. `null` = API-ul n-a răspuns; raportul o spune, nu se oprește.
 */
export function randeazaDate(proprietati) {
  const linii = ["## Datele evenimentelor (server)", ""];
  if (proprietati === null) {
    linii.push("(datele evenimentelor nu s-au putut citi din Umami)");
    return `${linii.join("\n")}\n`;
  }
  if (proprietati.length === 0) {
    linii.push("(nicio proprietate de eveniment)");
    return `${linii.join("\n")}\n`;
  }
  linii.push("| Eveniment | Câmp | Valori (număr) |", "| --- | --- | --- |");
  const sortate = [...proprietati].sort(
    (a, b) => a.eveniment.localeCompare(b.eveniment) || a.camp.localeCompare(b.camp),
  );
  for (const { eveniment, camp, valori } of sortate) {
    const text = [...valori]
      .sort((a, b) => b.numar - a.numar || String(a.valoare).localeCompare(String(b.valoare)))
      .map((v) => `${v.valoare} ${v.numar}`)
      .join(" · ");
    linii.push(`| ${eveniment} | ${camp} | ${text || "—"} |`);
  }
  return `${linii.join("\n")}\n`;
}

export function randeazaRaport({ eticheta, de, pana, vizitatori, evenimente }) {
  const zi = (d) => d.toISOString().slice(0, 10);
  const gol = { om: 0, neconfirmat: 0, robot: 0, audit: 0, formate: {}, conturi: 0 };
  const slugs = [...new Set([...vizitatori.keys(), ...evenimente.unelte.keys()])];
  const randuri = slugs
    .map((slug) => ({
      slug,
      v: vizitatori.get(slug) ?? 0,
      ...(evenimente.unelte.get(slug) ?? gol),
    }))
    .sort((a, b) => b.om - a.om || b.v - a.v || a.slug.localeCompare(b.slug));
  const total = randuri.reduce(
    (t, r) => ({
      v: t.v + r.v,
      om: t.om + r.om,
      neconfirmat: t.neconfirmat + r.neconfirmat,
      robot: t.robot + r.robot,
      audit: t.audit + r.audit,
      conturi: t.conturi + r.conturi,
    }),
    { v: 0, om: 0, neconfirmat: 0, robot: 0, audit: 0, conturi: 0 },
  );
  const formate = (f) =>
    Object.entries(f)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, n]) => `${k} ${n}`)
      .join(" · ") || "—";
  const linii = [
    `# Uneltele gratuite — ${eticheta} (${zi(de)} – ${zi(pana)})`,
    "",
    "| Unealta | Vizitatori RO | Descărcări om | Neconfirmate | Roboți | Audit | Formate (om + neconfirmate) | Conturi |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |",
    ...randuri.map(
      (r) =>
        `| ${r.slug} | ${r.v} | ${r.om} | ${r.neconfirmat} | ${r.robot} | ${r.audit} | ${formate(r.formate)} | ${r.conturi} |`,
    ),
    `| **Total** | ${total.v} | ${total.om} | ${total.neconfirmat} | ${total.robot} | ${total.audit} | | ${total.conturi} |`,
    "",
    `Conturi fără unealtă (direct): ${evenimente.conturiDirecte}`,
    "",
    `Calcule de salariu (server): ${CLASE.map((c) => `${c} ${evenimente.calcule[c]}`).join(" · ")}`,
    "",
    "## Din browser (Umami, doar vizitatorii care nu blochează măsurarea)",
    "",
    ...(evenimente.browser.length === 0
      ? ["(niciun eveniment)"]
      : [
          "| Eveniment | Număr |",
          "| --- | ---: |",
          ...evenimente.browser.map((e) => `| ${e.nume} | ${e.numar} |`),
        ]),
    "",
    "Citire: „om” = descărcare pornită de un clic (Sec-Fetch-User); „neconfirmate” = fără semnul ăsta (preîncărcări, managerul de descărcări din Android, browsere vechi, boți deghizați); „audit” = testele noastre (?m=, IP-ul serverului). Vizitatorii RO includ și echipa.",
  ];
  return `${linii.join("\n")}\n`;
}
