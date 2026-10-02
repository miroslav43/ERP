// src/lib/queries/sabloane-documente.test.ts
//
// Șabloanele HR se citesc cu ACEEAȘI precedență ca la emitere (varianta firmei
// bate seed-ul de platformă), ca ecranul să nu mintă despre ce e în vigoare;
// antetul documentelor se compune din firmă + branding, cu sigla prin URL semnat.

import { describe, expect, it } from "vitest";

import { areFiltru, clientFals, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  citesteAntetDocumente,
  citesteSablonDocument,
  listeazaSabloaneDocumente,
} from "./sabloane-documente";

const ORG = "11111111-1111-4111-8111-111111111111";

const sablon = (cod: string, organizationId: string | null, denumire = cod) => ({
  id: `${cod}-${organizationId ?? "platforma"}`,
  organization_id: organizationId,
  cod,
  denumire,
  descriere: null,
  continut_html: "<p>x</p>",
  serie: "S",
  activ: true,
});

describe("listeazaSabloaneDocumente", () => {
  it("câte unul per cod: primul văzut (al firmei, ordonat întâi) câștigă", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", {
      data: [
        sablon("nda", ORG, "NDA al firmei"),
        sablon("contract_munca", null),
        sablon("nda", null, "NDA de platformă"),
        sablon("adeverinta", null),
      ],
    });

    const r = await listeazaSabloaneDocumente(db.client, ORG);

    expect(r.map((s) => [s.cod, s.organization_id])).toEqual([
      ["adeverinta", null],
      ["contract_munca", null],
      ["nda", ORG],
    ]);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "or", argumente: [`organization_id.eq.${ORG},organization_id.is.null`] },
        { metoda: "order", argumente: ["organization_id", { ascending: true, nullsFirst: false }] },
      ]),
    );
  });

  it("eroarea devine un mesaj fără detalii de bază", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", {
      error: eroarePostgrest("42501", "secret intern"),
    });
    await expect(listeazaSabloaneDocumente(db.client, ORG)).rejects.toThrow(
      "Șabloanele de documente nu au putut fi citite.",
    );
  });
});

describe("citesteSablonDocument", () => {
  it("varianta pe care ar folosi-o emiterea: un rând, al firmei întâi", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", { data: [sablon("nda", ORG)] });

    const r = await citesteSablonDocument(db.client, ORG, "nda");

    expect(r?.organization_id).toBe(ORG);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "cod", "nda")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "or", argumente: [`organization_id.eq.${ORG},organization_id.is.null`] },
        { metoda: "order", argumente: ["organization_id", { ascending: true, nullsFirst: false }] },
        { metoda: "limit", argumente: [1] },
      ]),
    );
  });

  it("cod inexistent ⇒ null; eroare ⇒ mesaj fix", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", { data: [] });
    expect(await citesteSablonDocument(db.client, ORG, "nimic")).toBeNull();
    db.raspunde("hr_document_templates", "select", { error: eroarePostgrest("57014") });
    await expect(citesteSablonDocument(db.client, ORG, "x")).rejects.toThrow(
      "Șablonul de document nu a putut fi citit.",
    );
  });
});

describe("citesteAntetDocumente", () => {
  const organizatie = {
    name: "Firma",
    legal_name: "Firma Test SRL",
    forma_juridica: "SRL",
    cui: "RO123",
    reg_com: "J40/1/2020",
    adresa: "Str. Lungă 1",
    oras: " ",
    judet: "Cluj",
    capital_social: 200,
    capital_social_varsat: null,
    sistem_dualist: false,
    telefon_contact: null,
    email_contact: "a@firma.ro",
  };

  it("antetul din datele firmei; sigla prin URL semnat pe o oră, doar dacă firma o arată", async () => {
    const db = clientFals();
    db.raspunde("organizations", "select", { data: organizatie });
    db.raspunde("organization_branding", "select", {
      data: { antet_pozitie: "subsol", antet_arata_logo: true, logo_light_path: `${ORG}/logo.png` },
    });
    db.raspundeStocare("org-branding", "createSignedUrl", {
      data: { signedUrl: "https://semnat" },
    });

    const r = await citesteAntetDocumente(db.client, ORG, "Firma");

    expect(r).toEqual({
      antet: {
        denumire: "Firma Test SRL",
        formaJuridica: "SRL",
        cui: "RO123",
        regCom: "J40/1/2020",
        adresa: "Str. Lungă 1, Cluj",
        capitalSocial: 200,
        capitalVarsat: null,
        sistemDualist: false,
        telefon: null,
        email: "a@firma.ro",
        pozitie: "subsol",
        sigla: null,
      },
      urlSigla: "https://semnat",
    });
    expect(db.apeluriStocare).toEqual([
      { bucket: "org-branding", metoda: "createSignedUrl", argumente: [`${ORG}/logo.png`, 3600] },
    ]);
    expect(areFiltru(db.apeluriPe("organizations")[0], "eq", "id", ORG)).toBe(true);
    const [branding] = db.apeluriPe("organization_branding");
    expect(areFiltru(branding, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(branding, "is", "deleted_at", null)).toBe(true);
  });

  it("logo ascuns sau lipsă: fără URL și fără apel la stocare", async () => {
    const db = clientFals();
    db.raspunde("organizations", "select", { data: organizatie });
    db.raspunde("organization_branding", "select", {
      data: { antet_pozitie: "antet", antet_arata_logo: false, logo_light_path: "x.png" },
    });
    const r = await citesteAntetDocumente(db.client, ORG, "Firma");
    expect(r.urlSigla).toBeNull();
    expect(db.apeluriStocare).toHaveLength(0);
  });

  it("firmă și branding necitibile: denumirea uzuală, antet sus, restul gol", async () => {
    const db = clientFals();
    db.raspunde("organizations", "select", { data: null });
    db.raspunde("organization_branding", "select", { data: null });

    const r = await citesteAntetDocumente(db.client, ORG, "Denumire uzuală");

    expect(r.antet).toMatchObject({
      denumire: "Denumire uzuală",
      cui: null,
      adresa: null,
      sistemDualist: false,
      pozitie: "antet",
    });
    expect(r.urlSigla).toBeNull();
  });

  it("fără denumire legală, cade pe denumirea uzuală a firmei", async () => {
    const db = clientFals();
    db.raspunde("organizations", "select", { data: { ...organizatie, legal_name: null } });
    db.raspunde("organization_branding", "select", { data: null });
    const r = await citesteAntetDocumente(db.client, ORG, "Altceva");
    expect(r.antet.denumire).toBe("Firma");
  });

  it("semnarea eșuată: URL null, nu excepție", async () => {
    const db = clientFals();
    db.raspunde("organizations", "select", { data: organizatie });
    db.raspunde("organization_branding", "select", {
      data: { antet_pozitie: "antet", antet_arata_logo: true, logo_light_path: "x.png" },
    });
    db.raspundeStocare("org-branding", "createSignedUrl", { data: null, error: { message: "nu" } });
    const r = await citesteAntetDocumente(db.client, ORG, "Firma");
    expect(r.urlSigla).toBeNull();
  });
});
