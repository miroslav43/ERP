import { describe, expect, it } from "vitest";

import { caleaDePortal, idCerereDeConcediu, idTichet, type ContextDestinatar } from "./legaturi";

const ID = "3f8c1d2e-1111-4222-8333-444455556666";
const ALT_ID = "9a7b6c5d-2222-4333-8444-555566667777";

/** Destinatarul deține cererea `ID` și tichetul `ID`, nimic altceva. */
const AL_MEU: ContextDestinatar = {
  concediiProprii: new Set([ID]),
  ticheteProprii: new Set([ID]),
};

/** Destinatarul nu deține nimic — HR, aprobator, manager. */
const AL_ALTCUIVA: ContextDestinatar = {
  concediiProprii: new Set<string>(),
  ticheteProprii: new Set<string>(),
};

describe("caleaDePortal", () => {
  it("traduce legăturile care nu depind de destinatar", () => {
    expect(caleaDePortal("/pontaj/saptamana")).toBe("/portal/pontajul-meu/saptamana");
    // Anunțul e difuzat firmei întregi: `portal/anunturi/[id]` n-are gardă de
    // proprietate, deci se traduce fără context.
    expect(caleaDePortal(`/anunturi/${ID}`)).toBe(`/portal/anunturi/${ID}`);
  });

  it("traduce cererea de concediu și tichetul CÂND sunt ale destinatarului", () => {
    expect(caleaDePortal(`/concedii/${ID}`, AL_MEU)).toBe(`/portal/concediile-mele/${ID}`);
    expect(caleaDePortal(`/ticketing/${ID}`, AL_MEU)).toBe(`/portal/tichetele-mele/${ID}`);
  });

  it("NU le traduce când destinatarul e altcineva — HR, aprobator, manager", () => {
    // Defectul reparat: `0056:95` trimite `/concedii/<uuid>` către HR și
    // `0079:338` către aprobatori, iar `concediile-mele/[id]/page.tsx:60`
    // cheamă `notFound()` pentru cererea altcuiva. Pe baza vie, la 2026-09-04,
    // 10 din 15 astfel de notificări aterizau într-un 404.
    expect(caleaDePortal(`/concedii/${ID}`, AL_ALTCUIVA)).toBeNull();
    expect(caleaDePortal(`/ticketing/${ID}`, AL_ALTCUIVA)).toBeNull();
    // Și când contextul e neg, dar pentru ALT id decât cel din link.
    expect(caleaDePortal(`/concedii/${ALT_ID}`, AL_MEU)).toBeNull();
    expect(caleaDePortal(`/ticketing/${ALT_ID}`, AL_MEU)).toBeNull();
  });

  it("IMPLICITUL E CEL SIGUR: fără context, nu se traduce", () => {
    // Poarta care contează pentru orice apelant viitor. Un apelant care uită
    // contextul pierde o aterizare directă — nu produce un 404.
    expect(caleaDePortal(`/concedii/${ID}`)).toBeNull();
    expect(caleaDePortal(`/ticketing/${ID}`)).toBeNull();
    expect(caleaDePortal(`/concedii/${ID}`, undefined)).toBeNull();
  });

  it("lasă neatinsă o cale care e deja de portal", () => {
    expect(caleaDePortal("/portal/concediile-mele")).toBe("/portal/concediile-mele");
    expect(caleaDePortal("/portal")).toBe("/portal");
  });

  it("întoarce `null` pentru legăturile de aprobator", () => {
    // Un angajat nu le primește. Dacă totuși ajunge una la el, un text fără link
    // e mai onest decât o cale ghicită care duce în 404.
    expect(caleaDePortal("/concedii/aprobari")).toBeNull();
    expect(caleaDePortal("/pontaj/aprobare")).toBeNull();
  });

  it("întoarce `null` pentru orice cale necunoscută", () => {
    expect(caleaDePortal("/salarizare/2026/8")).toBeNull();
    expect(caleaDePortal("/angajati")).toBeNull();
    expect(caleaDePortal("")).toBeNull();
    expect(caleaDePortal(null)).toBeNull();
  });

  it("nu traduce o cale care doar SEAMĂNĂ cu una cunoscută", () => {
    // Listă albă, nu potrivire pe prefix: `/concediix` nu e `/concedii`.
    expect(caleaDePortal("/concediile-altcuiva", AL_MEU)).toBeNull();
    expect(caleaDePortal(`/concedii/${ID}/editare`, AL_MEU)).toBeNull();
    expect(caleaDePortal("/concedii/nu-e-uuid", AL_MEU)).toBeNull();
  });

  it("nu poate produce o cale în afara portalului", () => {
    const intrari = [
      `/concedii/${ID}`,
      "/pontaj/saptamana",
      `/anunturi/${ID}`,
      `/ticketing/${ID}`,
      "/anunturi",
      "/concedii",
      "/pontaj",
    ];
    // Cu context și fără: ambele drumuri prin funcție trebuie să rămână în
    // portal, iar `null` e o ieșire legitimă (rândul se randează ca text).
    for (const context of [AL_MEU, AL_ALTCUIVA, undefined]) {
      for (const intrare of intrari) {
        const iesire = caleaDePortal(intrare, context);
        if (iesire === null) continue;
        expect(iesire, `${intrare} → ${iesire}`).toMatch(/^\/portal(\/|$)/);
      }
    }
  });
});

describe("idCerereDeConcediu / idTichet", () => {
  it("extrag id-ul din forma exactă", () => {
    expect(idCerereDeConcediu(`/concedii/${ID}`)).toBe(ID);
    expect(idTichet(`/ticketing/${ID}`)).toBe(ID);
  });

  it("întorc `null` pentru orice altceva", () => {
    for (const intrare of [
      null,
      "",
      "/concedii",
      "/concedii/aprobari",
      "/concedii/nu-e-uuid",
      `/concedii/${ID}/editare`,
      `/ticketing/${ID}/comentarii`,
    ]) {
      expect(idCerereDeConcediu(intrare), String(intrare)).toBeNull();
      if (intrare !== `/ticketing/${ID}`) expect(idTichet(intrare), String(intrare)).toBeNull();
    }
  });

  it("nu se încurcă între ele", () => {
    expect(idCerereDeConcediu(`/ticketing/${ID}`)).toBeNull();
    expect(idTichet(`/concedii/${ID}`)).toBeNull();
  });
});
