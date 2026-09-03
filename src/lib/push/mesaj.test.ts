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

  it("cade pe portal când notificarea n-are link", () => {
    const mesaj = construiesteMesaj({ jeton: JETON, titlu: "Ceva.", corp: null, link: null });
    expect(mesaj.data.cale).toBe("/portal");
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
      expect(mesaj.data.cale).toBe("/portal");
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
