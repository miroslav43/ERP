// scripts/demo/populeaza.test.ts
//
// Scriptul de populare a datelor demo rulează cu CHEIA DE SERVICIU, deci ocolește
// și RLS, și toate gărzile aplicației. Garda pe care aplicația chiar o are —
// `esteFisaProprie`, în pagină ȘI în acțiune — compară cu `auth.uid()`, iar
// acolo nu există „cine": jurnalul de audit arată `actor_id: null`.
//
// Pe 5 septembrie 2026 scriptul a șters de pe baza reală fișa de angajat a
// patronului, creată de `0083_fisa_de_angajat_pentru_patron.sql`. Fișa n-avea
// pontaje, contracte, concedii, instruiri sau inventar — cinci verificări, toate
// adevărate. A șasea lipsea: avea `user_id`. Patronul a rămas fără pontaj și
// fără nicio explicație, fiindcă filtrul de status din `listeazaAngajatiPontaj`
// îl ascunde tăcut în loc să-l refuze.
//
// Testul citește SURSA, nu comportamentul: scriptul vorbește cu baza reală, deci
// nu se poate rula aici. Ce se poate apăra e forma interogării.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SURSA = readFileSync(join(process.cwd(), "scripts/demo/populeaza.mjs"), "utf8");

/** Blocul care dezactivează fișe din `employees`, cu tot lanțul lui de filtre. */
function bloculDeStergere(): string {
  const start = SURSA.indexOf('.from("employees")');
  expect(start, "scriptul nu mai atinge deloc `employees` — actualizează testul").toBeGreaterThan(
    -1,
  );
  return SURSA.slice(start, SURSA.indexOf(".select(", start));
}

describe("populeaza.mjs — curățenia nu are voie să atingă fișe legate de conturi", () => {
  it("filtrează pe `user_id is null` înainte de a dezactiva ceva", () => {
    const bloc = bloculDeStergere();
    expect(bloc).toContain("deleted_at");
    expect(
      bloc,
      'fără `.is("user_id", null)`, curățenia poate șterge fișa de patron creată de 0083',
    ).toContain('.is("user_id", null)');
  });

  it("dezactivarea rămâne LOGICĂ, nu fizică", () => {
    // Un `.delete()` ar face restaurarea imposibilă. Cea din 5 septembrie s-a
    // putut repara tocmai fiindcă rândul era doar marcat.
    const bloc = bloculDeStergere();
    expect(bloc).not.toContain(".delete(");
  });

  it("spune în log când sare peste o fișă, nu doar când șterge", () => {
    // „N-am găsit-o" și „am găsit-o și am sărit-o fiindcă are cont" sunt lucruri
    // diferite; tăcerea le-ar face să arate la fel.
    expect(SURSA).toMatch(/NU s-a atins[\s\S]{0,120}cont/u);
  });

  it("antetul explică de ce, ca următorul filtru să nu fie șters ca redundant", () => {
    expect(SURSA).toContain("0083");
    expect(SURSA).toMatch(/user_id/u);
  });
});
