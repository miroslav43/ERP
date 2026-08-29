// Poarta filtrelor golite: `.eq("ceva_id", x ?? "")`.
//
// Trăiește sub `src/` din același motiv ca `granita-rsc.test.ts`:
// `vitest.config.ts` limitează proiectul `unit` la `include: ["src/**/*.test.ts"]`.
// Pusă în `tests/`, n-ar rula niciodată.
//
// ── CE PRINDE ȘI DE CE N-O PRINDEA NIMIC ALTCEVA ─────────────────────────────
// `?? ""` pe un filtru PostgREST arată ca o măsură de siguranță și e exact
// opusul ei. Șirul vid nu e o valoare care „nu potrivește nimic": pe o coloană
// `uuid`, Postgres încearcă să-l convertească și ridică 22P02 — „invalid input
// syntax for type uuid: ''". PostgREST îl întoarce ca eroare, iar apelantul
// care aruncă eroarea duce pagina în `error.tsx`.
//
// S-a întâmplat: `/angajati/<id>/permisiuni` cădea cu „Angajații nu au putut fi
// afișați" pentru ORICE angajat fără cont, prin
// `.eq("user_id", angajat.user_id ?? "")`. Două rânduri mai jos stătea ramura
// scrisă anume pentru angajatul fără cont — de neatins tocmai în cazul ei.
// Pe baza reală, 4 din 11 fișe active n-au `user_id`.
//
// Niciuna dintre celelalte porți n-o vede:
//   · `tsc`               — `string` acolo unde se cere `string`, nimic de spus;
//   · `eslint`            — n-are noțiunea de tip de coloană;
//   · `coloane.test.ts`   — își declară explicit `.eq()` în afara acoperirii;
//   · `build`             — nu execută nicio interogare.
//
// ── CE SE SCRIE ÎN LOC ───────────────────────────────────────────────────────
// Absența nu se codifică într-o valoare, se ramifică ÎNAINTEA interogării:
//
//   const membru = userId === null ? null : await citesteApartenenta(userId);
//
// Un `uuid` gol nu există; întrebarea pusă bazei despre el n-are răspuns, are
// eroare.
//
// ── LIMITA ───────────────────────────────────────────────────────────────────
// Scanarea e pe linie și doar pe coloanele de identificator (`id`, `*_id`),
// unde tipul e cu certitudine `uuid`. Nu prinde golirea făcută cu câteva
// rânduri mai sus, într-o variabilă, și nici `?? ""` pe o coloană `date` sau
// enum, unde 22P02 vine la fel — numele coloanei nu spune tipul, iar o poartă
// care ghicește produce raportări false. Fișierele de test sunt sărite: acolo
// șirul vid e uneori chiar subiectul.
//
// Rândurile de comentariu sunt sărite și ele, altfel poarta se raportează pe
// sine: un depozit care își documentează capcanele scrie tocmai tiparul
// interzis, cu explicația de ce e interzis. Un comentariu la coada unui rând de
// cod rămâne prins — acolo codul de deasupra e oricum vinovat.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

function plimba(dir: string): string[] {
  const gasite: string[] = [];
  for (const intrare of readdirSync(dir, { withFileTypes: true })) {
    const cale = join(dir, intrare.name);
    if (intrare.isDirectory()) gasite.push(...plimba(cale));
    else if (/\.tsx?$/u.test(intrare.name) && !/\.test\.tsx?$/u.test(intrare.name))
      gasite.push(cale);
  }
  return gasite;
}

/**
 * Filtrul PostgREST pe o coloană de identificator, cu valoarea golită prin
 * `?? ""` sau `|| ""`, pe același rând. Ghilimelele din jurul șirului vid sunt
 * scrise ca pereche `["']\3` ca să nu potrivească un șir cu conținut.
 */
const TIPAR_FILTRU_GOLIT =
  /\.(?:eq|neq|in|is|filter)\(\s*(["'`])(id|[a-z0-9_]+_id)\1\s*,[^;]*?(?:\?\?|\|\|)\s*(["'])\3/u;

/** Rândul e doar text despre cod: `//`, `/*` sau continuarea unui bloc `*`. */
function esteComentariu(linie: string): boolean {
  return /^(?:\/\/|\/\*|\*)/u.test(linie);
}

describe("filtre PostgREST golite cu șirul vid", () => {
  it('nicio interogare nu trimite `""` unei coloane de identificator', () => {
    const vinovate = plimba(SRC)
      .flatMap((cale) =>
        readFileSync(cale, "utf8")
          .split("\n")
          .map((linie, i) => ({ cale, linie: linie.trim(), rand: i + 1 })),
      )
      .filter(({ linie }) => !esteComentariu(linie) && TIPAR_FILTRU_GOLIT.test(linie))
      .map(({ cale, linie, rand }) => `${cale.slice(SRC.length + 1)}:${rand} — ${linie}`);

    expect(vinovate, "un `uuid` gol ridică 22P02, nu întoarce zero rânduri").toEqual([]);
  });

  it("poarta chiar prinde tiparul (santinelă împotriva unui regex care tace)", () => {
    expect(TIPAR_FILTRU_GOLIT.test(`.eq("user_id", angajat.user_id ?? "")`)).toBe(true);
    expect(TIPAR_FILTRU_GOLIT.test(`.eq("id", mesaj.contract_id ?? "")`)).toBe(true);
    expect(TIPAR_FILTRU_GOLIT.test(`.eq("contract_id", x || '')`)).toBe(true);

    // Ce NU trebuie să prindă: filtrul cu valoare reală, revenirea la un șir
    // implicit pe o coloană de text și căutarea liberă golită (acolo `%%`
    // potrivește tot, ceea ce e chiar comportamentul dorit).
    expect(TIPAR_FILTRU_GOLIT.test(`.eq("user_id", angajat.user_id)`)).toBe(false);
    expect(TIPAR_FILTRU_GOLIT.test(`.eq("status", filtre.status ?? "activ")`)).toBe(false);
    expect(TIPAR_FILTRU_GOLIT.test(`.ilike("full_name", \`%\${cautare ?? ""}%\`)`)).toBe(false);

    // Textul DESPRE capcană nu e capcana.
    expect(esteComentariu(`// .eq("user_id", angajat.user_id ?? "")`)).toBe(true);
    expect(esteComentariu(`* .eq("user_id", angajat.user_id ?? "")`)).toBe(true);
    expect(esteComentariu(`.eq("user_id", angajat.user_id)`)).toBe(false);
  });
});
