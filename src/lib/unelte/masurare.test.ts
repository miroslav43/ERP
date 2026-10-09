import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CLASE,
  DOMENIU_MASURAT,
  FORMATE_NUMARATE,
  LUNGIME_MAXIMA_NUME,
  SLUGURI_UNELTE,
  clasificaCererea,
  esteRobot,
  evenimentCalcul,
  evenimentCont,
  evenimentDescarcare,
  formatDinRaspuns,
  ipClient,
  numeEvenimentCalcul,
  numeEvenimentCont,
  numeEvenimentDescarcare,
  sursaConversiei,
  sursaDinParametri,
  unealtaDinCale,
} from "./masurare";

/** UA-uri reale: cele din jurnalul auditului din 8 oct 2026, plus telefoanele uzuale. */
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const ANDROID_DESCARCARI =
  "AndroidDownloadManager/14 (Linux; U; Android 14; SM-A546B Build/UP1A.231005.007)";
const CUBOT =
  "Mozilla/5.0 (Linux; Android 10; Cubot X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const OVH_CA_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const SAFARI_15 =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15";
const META =
  "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)";
const HEADLESS =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36";

const antete = (a: Record<string, string>) => new Headers(a);
const fara = new URLSearchParams();

describe("clasificaCererea", () => {
  it("un clic real pe o descărcare e „om”", () => {
    expect(clasificaCererea(antete({ "user-agent": IPHONE, "sec-fetch-user": "?1" }), fara)).toBe(
      "om",
    );
    expect(clasificaCererea(antete({ "user-agent": ANDROID, "sec-fetch-user": "?1" }), fara)).toBe(
      "om",
    );
  });

  it("fără semnul clicului, aceeași cerere e „neconfirmat”, nu „om”", () => {
    expect(clasificaCererea(antete({ "user-agent": IPHONE }), fara)).toBe("neconfirmat");
    // A doua cerere, a managerului de descărcări din Android, nu dublează oamenii.
    expect(clasificaCererea(antete({ "user-agent": ANDROID_DESCARCARI }), fara)).toBe(
      "neconfirmat",
    );
    // Safari sub 16.4 nu trimite Sec-Fetch: subnumărare acceptată, nu supranumărare.
    expect(clasificaCererea(antete({ "user-agent": SAFARI_15 }), fara)).toBe("neconfirmat");
    // Botul OVH din audit (5 sept), care se dădea drept Chrome.
    expect(clasificaCererea(antete({ "user-agent": OVH_CA_CHROME }), fara)).toBe("neconfirmat");
  });

  it("boții și clienții HTTP sunt „robot”, chiar dacă trimit Sec-Fetch-User", () => {
    for (const ua of [META, HEADLESS, "curl/8.5.0", "python-requests/2.31", "node", ""]) {
      expect(clasificaCererea(antete({ "user-agent": ua, "sec-fetch-user": "?1" }), fara), ua).toBe(
        "robot",
      );
    }
    expect(clasificaCererea(antete({}), fara)).toBe("robot");
  });

  it("un telefon Cubot nu e robot doar pentru că are „bot” în nume", () => {
    expect(esteRobot(CUBOT)).toBe(false);
    expect(clasificaCererea(antete({ "user-agent": CUBOT, "sec-fetch-user": "?1" }), fara)).toBe(
      "om",
    );
  });

  it("auditurile noastre bat orice alt semn", () => {
    const om = { "user-agent": IPHONE, "sec-fetch-user": "?1" };
    expect(clasificaCererea(antete(om), new URLSearchParams("m=1791483495"))).toBe("audit");
    expect(clasificaCererea(antete({ ...om, "cf-connecting-ip": "62.171.154.194" }), fara)).toBe(
      "audit",
    );
    expect(
      clasificaCererea(
        antete({ ...om, "x-forwarded-for": "2a02:c207:2316:2304::1, 172.69.130.85" }),
        fara,
      ),
    ).toBe("audit");
    expect(
      clasificaCererea(antete({ ...om, "cf-connecting-ip": "::ffff:62.171.154.194" }), fara),
    ).toBe("audit");
    expect(clasificaCererea(antete({ "user-agent": "SEO-audit-check" }), fara)).toBe("audit");
  });

  it("IP-ul se ia din Cloudflare, apoi din primul x-forwarded-for", () => {
    expect(ipClient(antete({ "cf-connecting-ip": " 82.137.40.16 " }))).toBe("82.137.40.16");
    expect(ipClient(antete({ "x-forwarded-for": "82.137.40.16, 172.69.130.85" }))).toBe(
      "82.137.40.16",
    );
    expect(ipClient(antete({}))).toBeNull();
  });
});

describe("unealta și formatul", () => {
  it("harta are toate uneltele de azi și nu are hub-ul", () => {
    for (const slug of [
      "foaie-de-pontaj",
      "condica-de-prezenta",
      "cerere-concediu-de-odihna",
      "foaie-de-parcurs",
      "fisa-instruire-ssm",
      "fisa-evaluare",
      "calculator-salariu",
    ]) {
      expect(SLUGURI_UNELTE.has(slug), slug).toBe(true);
    }
    expect(SLUGURI_UNELTE.has("unelte")).toBe(false);
    expect(SLUGURI_UNELTE.has("")).toBe(false);
  });

  it("calea rutei dă unealta paginii, inclusiv prin alias", () => {
    expect(unealtaDinCale("/api/unelte/foaie-de-pontaj")).toBe("foaie-de-pontaj");
    expect(unealtaDinCale("/api/unelte/cerere-concediu")).toBe("cerere-concediu-de-odihna");
    expect(unealtaDinCale("/api/unelte/fisa-evaluare/x")).toBe("fisa-evaluare");
    for (const cale of [
      "/api/unelte/constructor",
      "/api/unelte/__proto__",
      "/api/unelte/hasOwnProperty",
      "/api/unelte/",
      "/unelte/foaie-de-pontaj",
    ]) {
      expect(unealtaDinCale(cale), cale).toBeNull();
    }
  });

  it("formatul se citește din numele fișierului atașat", () => {
    const cu = (d: string) => new Response("x", { headers: { "content-disposition": d } });
    expect(formatDinRaspuns(cu('attachment; filename="pontaj-2026-10.xlsx"'))).toBe("xlsx");
    expect(formatDinRaspuns(cu("attachment; filename*=UTF-8''cerere.pdf"))).toBe("pdf");
    expect(formatDinRaspuns(cu('attachment; filename="arhiva.zip"'))).toBe("alt");
    expect(formatDinRaspuns(cu('inline; filename="x.pdf"'))).toBeNull();
    expect(formatDinRaspuns(new Response("x"))).toBeNull();
  });

  it("niciun nume de eveniment nu depășește coloana din Umami", () => {
    for (const slug of SLUGURI_UNELTE) {
      for (const format of [...FORMATE_NUMARATE, "alt"]) {
        for (const clasa of CLASE) {
          const nume = numeEvenimentDescarcare(slug, format, clasa);
          expect(nume.length, nume).toBeLessThanOrEqual(LUNGIME_MAXIMA_NUME);
        }
      }
      expect(numeEvenimentCont(slug).length, slug).toBeLessThanOrEqual(LUNGIME_MAXIMA_NUME);
    }
    expect(numeEvenimentCont(null)).toBe("cont:direct");
  });
});

describe("evenimentDescarcare", () => {
  const fisier = () =>
    new Response("%PDF", {
      headers: { "content-disposition": 'attachment; filename="condica-prezenta-2026-10.pdf"' },
    });
  const cerere = (gazda: string, metoda = "GET") =>
    new Request("http://localhost/api/unelte/condica-de-prezenta?format=pdf&luna=10", {
      method: metoda,
      headers: { host: gazda, "user-agent": IPHONE, "sec-fetch-user": "?1" },
    });

  it("o descărcare de om pe domeniul măsurat dă numele și pagina uneltei", () => {
    expect(evenimentDescarcare(cerere("administrativo.ro"), fisier())).toEqual({
      nume: "dl:condica-de-prezenta:pdf:om",
      cale: "/unelte/condica-de-prezenta",
      // Doar câmpurile din lista albă (`date-eveniment.ts`): luna, nu formatul din adresă.
      date: { luna: 10 },
    });
  });

  it("fără câmpuri citite, evenimentul nu poartă `date`", () => {
    const r = new Request("http://localhost/api/unelte/condica-de-prezenta?format=pdf", {
      headers: { host: "administrativo.ro", "user-agent": IPHONE, "sec-fetch-user": "?1" },
    });
    expect(evenimentDescarcare(r, fisier())).toEqual({
      nume: "dl:condica-de-prezenta:pdf:om",
      cale: "/unelte/condica-de-prezenta",
    });
  });

  it("numele angajaților și firma din adresă nu ajung în eveniment", () => {
    const r = new Request(
      "http://localhost/api/unelte/condica-de-prezenta?format=pdf&an=2026&luna=10&program=ls&angajati=Zzsecret+Popescu%0AIon+Pop&firma=Zzsecret+SRL&cui=RO14399840",
      { headers: { host: "administrativo.ro", "user-agent": IPHONE, "sec-fetch-user": "?1" } },
    );
    const ev = evenimentDescarcare(r, fisier());
    expect(ev?.date).toEqual({ an: 2026, luna: 10, angajati: 2, program: "ls" });
    expect(JSON.stringify(ev)).not.toMatch(/Zzsecret|14399840/u);
  });

  it("staging, localhost, HEAD și răspunsurile fără fișier nu se numără", () => {
    expect(evenimentDescarcare(cerere("staging.administrativo.ro"), fisier())).toBeNull();
    expect(evenimentDescarcare(cerere("localhost:3000"), fisier())).toBeNull();
    expect(evenimentDescarcare(cerere("administrativo.ro", "HEAD"), fisier())).toBeNull();
    expect(
      evenimentDescarcare(cerere("administrativo.ro"), new Response("x", { status: 400 })),
    ).toBeNull();
    expect(
      evenimentDescarcare(
        cerere("administrativo.ro"),
        new Response(null, { status: 303, headers: { location: "/unelte/x" } }),
      ),
    ).toBeNull();
  });
});

describe("sursa conversiei", () => {
  it("se ia doar din campania unei unelte existente", () => {
    expect(sursaDinParametri({ utm_source: "unealta", utm_campaign: "foaie-de-pontaj" })).toBe(
      "foaie-de-pontaj",
    );
    expect(sursaDinParametri({ utm_source: "fisier", utm_campaign: "foaie-de-pontaj" })).toBeNull();
    expect(sursaDinParametri({ utm_source: "unealta", utm_campaign: "inexistenta" })).toBeNull();
    expect(
      sursaDinParametri({ utm_source: "unealta", utm_campaign: ["foaie-de-pontaj", "x"] }),
    ).toBeNull();
    expect(sursaDinParametri({})).toBeNull();
    for (const brut of ["__proto__", "constructor", 42, null, undefined, "x".repeat(500)]) {
      expect(sursaConversiei(brut)).toBeNull();
    }
  });

  it("contul se numără doar pe domeniul măsurat și nu pentru audituri sau roboți", () => {
    const om = { host: DOMENIU_MASURAT, "user-agent": IPHONE };
    expect(evenimentCont("foaie-de-pontaj", antete(om))).toEqual({
      nume: "cont:foaie-de-pontaj",
      cale: "/inregistrare",
    });
    expect(evenimentCont("nu-exista", antete(om))?.nume).toBe("cont:direct");
    expect(evenimentCont(null, antete({ ...om, host: "staging.administrativo.ro" }))).toBeNull();
    expect(evenimentCont(null, antete({ ...om, "cf-connecting-ip": "62.171.154.194" }))).toBeNull();
    expect(evenimentCont(null, antete({ ...om, "user-agent": "curl/8.5.0" }))).toBeNull();
  });
});

describe("evenimentCalcul", () => {
  const om = { host: DOMENIU_MASURAT, "user-agent": IPHONE, "sec-fetch-user": "?1" };

  it("un calcul trimis de om pleacă cu perioada, sensul și treapta brutului", () => {
    const q = new URLSearchParams({ suma: "4.325", din: "net", perioada: "2026-2" });
    const ev = evenimentCalcul(antete(om), q, 7412);
    expect(ev).toEqual({
      nume: "calc:calculator-salariu:om",
      cale: "/unelte/calculator-salariu",
      date: { din: "net", perioada: "2026-2", brut: "5000-10000" },
    });
    expect(JSON.stringify(ev)).not.toMatch(/4325|4\.325|7412/u);
  });

  it("pagina fără sumă, staging și o preîncărcare nu se numără ca om", () => {
    expect(evenimentCalcul(antete(om), new URLSearchParams(), 4325)).toBeNull();
    expect(
      evenimentCalcul(
        antete({ ...om, host: "staging.administrativo.ro" }),
        new URLSearchParams({ suma: "5000" }),
        5000,
      ),
    ).toBeNull();
    expect(
      evenimentCalcul(
        antete({ host: DOMENIU_MASURAT, "user-agent": IPHONE }),
        new URLSearchParams({ suma: "5000" }),
        5000,
      )?.nume,
    ).toBe("calc:calculator-salariu:neconfirmat");
  });

  it("numele evenimentului de calcul încape în coloană pe orice clasă", () => {
    for (const clasa of CLASE) {
      expect(numeEvenimentCalcul(clasa).length).toBeLessThanOrEqual(LUNGIME_MAXIMA_NUME);
    }
  });
});

describe("un singur domeniu, scris o dată", () => {
  it("e același cu data-domains din scriptul Umami", () => {
    const sursa = readFileSync("src/app/(marketing)/_componente/analitice.tsx", "utf8");
    expect(/data-domains="([^"]+)"/u.exec(sursa)?.[1]).toBe(DOMENIU_MASURAT);
  });
});
