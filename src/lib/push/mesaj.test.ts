import { describe, expect, it } from "vitest";

import { construiesteMesaj } from "./mesaj";

const JETON = "ExponentPushToken[abcdef]";

describe("construiesteMesaj", () => {
  it("duce titlul și corpul mai departe", () => {
    const mesaj = construiesteMesaj({
      jeton: JETON,
      titlu: "Concediu aprobat.",
      corp: "Cererea din 12 septembrie a fost aprobată.",
      link: "/portal/concediile-mele",
    });
    expect(mesaj.to).toBe(JETON);
    expect(mesaj.title).toBe("Concediu aprobat.");
    expect(mesaj.body).toBe("Cererea din 12 septembrie a fost aprobată.");
    expect(mesaj.data.cale).toBe("/portal/concediile-mele");
  });

  it("cade pe cutia poștală când notificarea n-are link", () => {
    const mesaj = construiesteMesaj({ jeton: JETON, titlu: "Ceva.", corp: null, link: null });
    expect(mesaj.data.cale).toBe("/portal/notificarile-mele");
  });

  it("corpul gol devine șir gol, nu 'null'", () => {
    const mesaj = construiesteMesaj({ jeton: JETON, titlu: "Ceva.", corp: null, link: null });
    expect(mesaj.body).toBe("");
  });

  it("refuză o cale care nu e internă", () => {
    // Constrângerea din bază oprește asta la scriere; aici e centura peste
    // bretele, pentru rândurile scrise înainte de 0001 sau prin service_role.
    for (const ostil of ["//evil.com", "https://evil.com", "/\\evil.com"]) {
      const mesaj = construiesteMesaj({ jeton: JETON, titlu: "X.", corp: null, link: ostil });
      expect(mesaj.data.cale).toBe("/portal/notificarile-mele");
    }
  });

  it("lasă neatinsă o cale care e deja de portal", () => {
    for (const cale of ["/portal", "/portal/concediile-mele", "/portal/pontajul-meu/saptamana"]) {
      const mesaj = construiesteMesaj({ jeton: JETON, titlu: "X.", corp: null, link: cale });
      expect(mesaj.data.cale).toBe(cale);
    }
  });

  it("traduce în portal legăturile `(app)` pe care le primește un angajat", () => {
    // Formele reale din baza vie la revizuirea finală — zero notificări cu link
    // erau pe `/portal/…`. Netraduse, fiecare atingere de notificare îl scotea
    // pe angajat din portal: poarta de rol din `(app)/layout.tsx` îl aducea
    // înapoi la `/portal`, fără niciun mesaj pe ecran.
    const ID = "3f8c1d2e-1111-4222-8333-444455556666";
    const perechi: readonly (readonly [string, string])[] = [
      ["/pontaj/saptamana", "/portal/pontajul-meu/saptamana"],
      [`/concedii/${ID}`, `/portal/concediile-mele/${ID}`],
      [`/anunturi/${ID}`, `/portal/anunturi/${ID}`],
      [`/ticketing/${ID}`, `/portal/tichetele-mele/${ID}`],
    ];
    for (const [link, asteptat] of perechi) {
      const mesaj = construiesteMesaj({ jeton: JETON, titlu: "X.", corp: null, link });
      expect(mesaj.data.cale, link).toBe(asteptat);
    }
  });

  it("o cale `(app)` fără corespondent în portal cade pe cutia poștală", () => {
    // Legăturile de aprobator: un angajat n-ar trebui să le primească, dar dacă
    // le primește, cutia poștală îi arată mesajul întreg — o cale ghicită l-ar
    // duce într-un 404, iar un 404 dintr-o notificare arată ca o notificare
    // falsă.
    for (const link of ["/concedii/aprobari", "/pontaj/aprobare", "/salarizare/2026/8"]) {
      const mesaj = construiesteMesaj({ jeton: JETON, titlu: "X.", corp: null, link });
      expect(mesaj.data.cale, link).toBe("/portal/notificarile-mele");
    }
  });

  it("nicio ieșire posibilă nu părăsește portalul", () => {
    const intrari: readonly (string | null)[] = [
      null,
      "",
      "/portal",
      "/pontaj/saptamana",
      "/concedii/aprobari",
      "//evil.com",
      "https://evil.com",
      "/\\evil.com",
      "/constructor",
      "/toString",
    ];
    for (const link of intrari) {
      const mesaj = construiesteMesaj({ jeton: JETON, titlu: "X.", corp: null, link });
      expect(mesaj.data.cale, String(link)).toMatch(/^\/portal(?:\/|$)/u);
    }
  });

  it("taie titlul la 100 și corpul la 240 de caractere", () => {
    const mesaj = construiesteMesaj({
      jeton: JETON,
      titlu: "a".repeat(200),
      corp: "b".repeat(500),
      link: null,
    });
    expect(mesaj.title).toHaveLength(100);
    expect(mesaj.body).toHaveLength(240);
  });
});
