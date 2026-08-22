// Redactarea payload-ului de audit.
//
// Aici a fost cea mai scumpă clasă de defecte a proiectului. `PROGRESS.md`
// documentează importul Excel care scria CNP și IBAN în CLAR într-un fișier de
// Storage — „nu atingea nicio politică RLS și nu lăsa nicio urmă de audit".
// `audit_logs` e exact locul unde un câmp sensibil ajunge tăcut și rămâne, iar
// concediile poartă date de sănătate (art. 9 GDPR): cod de indemnizație CNAS,
// serie, număr și câmpul liber unde oamenii scriu diagnosticul.
//
// `redactPayload` e pur. Se testează direct, fără mock-uri.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { redactPayload } from "./audit";

const RADACINA = join(__dirname, "..", "..", "..");

describe("redactPayload — allow-list, nu deny-list", () => {
  it("păstrează exact cheile permise și aruncă restul", () => {
    const iesire = redactPayload({ an: 2026, luna: 8, observatii: "text liber" }, ["an", "luna"]);
    expect(iesire).toEqual({ an: 2026, luna: 8 });
  });

  it("aruncă TOT ce nu e enumerat, inclusiv chei necunoscute", () => {
    // Contează la validarea eșuată: acolo `rawInput` e complet necontrolat —
    // vine direct de la client, cu orice formă.
    const iesire = redactPayload({ permis: 1, injectat: "orice", altceva: { adanc: true } }, [
      "permis",
    ]);
    expect(iesire).toEqual({ permis: 1 });
  });

  it("un câmp imbricat cere ȘI părintele în allow-list", () => {
    const intrare = { perioada: { start: "2026-01-01", stop: "x" } };

    // Capcana: filtrarea coboară nivel cu nivel, iar `perioada` e tăiat înainte
    // să se ajungă la `start`. Deci calea completă SINGURĂ nu păstrează nimic.
    // Comentariul din `audit.ts` sugera altceva; l-am corectat odată cu testul.
    expect(redactPayload(intrare, ["perioada.start"])).toEqual({});

    // Formele care funcționează: părinte + cale completă, sau părinte + nume simplu.
    expect(redactPayload(intrare, ["perioada", "perioada.start"])).toEqual({
      perioada: { start: "2026-01-01" },
    });
    expect(redactPayload(intrare, ["perioada", "start"])).toEqual({
      perioada: { start: "2026-01-01" },
    });
  });

  it("intrarea care nu e obiect simplu devine null", () => {
    for (const valoare of [null, undefined, 42, "text", [1, 2], true]) {
      expect(redactPayload(valoare, ["orice"]), String(valoare)).toBeNull();
    }
  });
});

describe("plasa de siguranță taie câmpurile sensibile CHIAR DACĂ sunt permise", () => {
  // Allow-list-ul e scris de om, într-un obiect `audit:` la fiecare acțiune.
  // Tiparul e ultima barieră când cineva enumeră din greșeală un câmp sensibil.
  const sensibile = [
    "cnp",
    "CNP",
    "cnp_ciphertext",
    "iban",
    "iban_last4",
    "salariu_brut",
    "token_acces",
    "secret_webhook",
    "parola_noua",
    "password",
    "amprenta_hash",
    "cheie_ciphertext",
    "auth_tag",
    "nonce_iv",
  ];

  it.each(sensibile)("„%s” dispare deși e enumerat explicit în allow", (camp) => {
    const iesire = redactPayload({ [camp]: "valoare reală", ok: 1 }, [camp, "ok"]);
    expect(iesire).toEqual({ ok: 1 });
  });

  it("taie și în adâncime, nu doar la primul nivel", () => {
    const iesire = redactPayload({ date: { cnp: "1900101...", marca: "001" } }, [
      "date",
      "cnp",
      "marca",
    ]);
    expect(iesire).toEqual({ date: { marca: "001" } });
  });
});

describe("contract cu triggerul de audit din bază", () => {
  // `audit.ts` spune, în comentariu: „Aceeași listă ca în triggerul generic de
  // audit din bază (R9) — cele două trebuie să rămână sincronizate."
  //
  // Nu erau. Tiparele bazei includeau `ciphertext`, `hash`, `auth_tag` și `_iv`,
  // pe care partea de TypeScript nu le avea. Din 118 câmpuri auditate în cod,
  // NICIUNUL nu era afectat — deci lărgirea n-a schimbat niciun comportament
  // existent; a închis doar golul pentru viitor.
  //
  // Testul citește SQL-ul ca text, tiparul folosit deja de
  // `src/config/permissions.test.ts`: rulează în CI fără bază de date.
  it("fiecare tipar interzis în bază e interzis și în TypeScript", () => {
    const sql = ["0002_authz.sql", "0010b_fix_garda_audit.sql", "0017_fix_concedii.sql"]
      .map((f) => readFileSync(join(RADACINA, "supabase/migrations", f), "utf8"))
      .join("\n");

    const bloc = /audit_forbidden_patterns\(\)[\s\S]*?select array\[([^\]]+)\]/g;
    const potriviri = [...sql.matchAll(bloc)];
    expect(potriviri.length, "n-am găsit definiția din bază — regexul a ruginit").toBeGreaterThan(
      0,
    );

    // Ultima definiție câștigă: migrările sunt forward-only.
    const ultima = potriviri[potriviri.length - 1]?.[1] ?? "";
    const tipare = [...ultima.matchAll(/'%?\\?([a-z_\\]+?)%?'/g)]
      .map((m) => (m[1] ?? "").replace(/\\/g, ""))
      .filter((t) => t.length > 1);

    expect(tipare.length, "n-am extras niciun tipar").toBeGreaterThan(3);

    const netaiate = tipare.filter((tipar) => {
      const camp = `camp_${tipar}_x`.replace(/_x$/, tipar.endsWith("iv") ? "" : "_x");
      return (
        redactPayload({ [camp]: "secret" }, [camp]) !== null &&
        Object.keys(redactPayload({ [camp]: "secret" }, [camp]) ?? {}).length > 0
      );
    });

    expect(
      netaiate,
      "tipare pe care baza le redactează, dar `CAMPURI_INTERZISE` din audit.ts le lasă să treacă",
    ).toEqual([]);
  });
});

describe("limitele de formă — un payload nu poate umfla audit_logs", () => {
  it("textul se taie la 500 de caractere", () => {
    const iesire = redactPayload({ nota: "x".repeat(900) }, ["nota"]);
    const nota = (iesire as Record<string, string>)["nota"] ?? "";
    expect(nota.length).toBe(501); // 500 + elipsa
    expect(nota.endsWith("…")).toBe(true);
  });

  it("tabloul se taie la 50 de elemente", () => {
    const iesire = redactPayload({ lista: Array.from({ length: 120 }, (_, i) => i) }, ["lista"]);
    expect((iesire as Record<string, unknown[]>)["lista"]).toHaveLength(50);
  });

  it("adâncimea peste 4 devine un marcaj, nu o structură", () => {
    const adanc = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    const iesire = redactPayload(adanc, ["a", "b", "c", "d", "e", "f"]);
    expect(JSON.stringify(iesire)).toContain("prea adânc");
  });
});

describe("valorile devin JSON valid", () => {
  it("Date → ISO, NaN/Infinity → null, funcțiile dispar", () => {
    const iesire = redactPayload(
      {
        cand: new Date("2026-08-22T10:00:00.000Z"),
        nan: Number.NaN,
        inf: Number.POSITIVE_INFINITY,
        fn: () => 1,
        nul: null,
        adevarat: true,
      },
      ["cand", "nan", "inf", "fn", "nul", "adevarat"],
    );
    expect(iesire).toEqual({
      cand: "2026-08-22T10:00:00.000Z",
      nan: null,
      inf: null,
      nul: null,
      adevarat: true,
    });
    expect(JSON.stringify(iesire), "rezultatul trebuie să fie serializabil").toBeTypeOf("string");
  });
});
