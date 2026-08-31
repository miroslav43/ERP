// src/lib/asistent/prompt.test.ts
/**
 * Testul central e „nu poate spune ce nu i s-a spus”.
 *
 * Diferența dintre a instrui un model să nu vorbească despre salarizare și a nu
 * pune salarizarea în promptul lui e diferența dintre o rugăminte și o
 * imposibilitate. Verificăm imposibilitatea.
 */
import { describe, expect, it } from "vitest";

import { DESTINATII } from "./destinatii";
import { construiestePrompt, type IntrarePrompt } from "./prompt";

const baza = (partial: Partial<IntrarePrompt> = {}): IntrarePrompt => ({
  destinatii: DESTINATII.filter((d) => d.zona === "app"),
  unelte: [],
  zona: "app",
  numeUtilizator: "Ana Popescu",
  numeOrganizatie: "Firma Exemplu SRL",
  aziISO: "2026-08-30",
  ...partial,
});

describe("ce ajunge în prompt", () => {
  it("enumeră fiecare destinație primită, cu identificator, nume și drum", () => {
    const prompt = construiestePrompt(baza({ destinatii: DESTINATII.slice(0, 1) }));
    const [prima] = DESTINATII;
    expect(prima).toBeDefined();
    expect(prompt).toContain(prima?.id ?? "");
    expect(prompt).toContain(prima?.eticheta ?? "");
    expect(prompt).toContain(prima?.drum.join(" → ") ?? "");
    expect(prompt).toContain(prima?.descriere ?? "");
  });

  it("nu pomenește NICIO destinație din afara listei primite", () => {
    /*
     * Cazul concret: un angajat fără drepturi de salarizare.
     *
     * Se verifică RÂNDUL, nu cuvântul. Un `not.toContain("salarizare")` ar fi
     * părut mai sever, dar e greșit: cuvântul apare legitim în descrierea
     * rapoartelor („Rapoartele de personal și salarizare”), iar un test care
     * pică pe proză corectă ajunge să fie slăbit până nu mai apără nimic.
     * Ce contează e că modelul nu primește identificatorul cu care ar putea
     * trimite pe cineva acolo.
     */
    const interzise = DESTINATII.filter((d) => d.id.startsWith("salarizare"));
    const permise = DESTINATII.filter((d) => d.zona === "app" && !d.id.startsWith("salarizare"));
    const prompt = construiestePrompt(baza({ destinatii: permise }));

    expect(interzise.length).toBeGreaterThan(3);
    for (const interzisa of interzise) {
      expect(prompt, interzisa.id).not.toContain(`${interzisa.id} | `);
      expect(prompt, interzisa.id).not.toContain(interzisa.descriere);
    }
  });

  it("nu pune nicio adresă de pagină în lista de destinații", () => {
    /*
     * Dacă href-urile ar apărea printre destinații, modelul ar începe să le
     * scrie direct în răspuns, ocolind marcajele — și ar ajunge, inevitabil, să
     * compună adrese care seamănă cu ele. Singura cale sigură e să nu le vadă.
     *
     * Se verifică doar tabelul: regulile conțin intenționat un „/pontaj” ca
     * exemplu de ce NU are voie să scrie, iar exemplul concret își face treaba
     * mai bine decât o interdicție abstractă.
     */
    const prompt = construiestePrompt(baza());
    const tabel = prompt.slice(prompt.indexOf("DESTINAȚII ("));
    expect(tabel.length).toBeGreaterThan(1000);
    for (const destinatie of DESTINATII) {
      expect(tabel, destinatie.href).not.toContain(destinatie.href);
    }
  });

  it("dă modelului ziua curentă, fiindcă nu are ceas", () => {
    expect(construiestePrompt(baza({ aziISO: "2026-12-01" }))).toContain("2026-12-01");
  });

  it("spune numele firmei și al omului", () => {
    const prompt = construiestePrompt(baza());
    expect(prompt).toContain("Firma Exemplu SRL");
    expect(prompt).toContain("Ana Popescu");
  });

  it("se descurcă fără numele omului", () => {
    const prompt = construiestePrompt(baza({ numeUtilizator: null }));
    expect(prompt).toContain("Firma Exemplu SRL");
    expect(prompt).not.toContain("Vorbești cu");
  });

  it("spune că e în portal când e în portal", () => {
    const prompt = construiestePrompt(
      baza({ zona: "portal", destinatii: DESTINATII.filter((d) => d.zona === "portal") }),
    );
    expect(prompt).toContain("portalul angajatului");
  });
});

describe("secțiunea de unelte", () => {
  it("lipsește cu totul când nu e disponibilă nicio unealtă", () => {
    // Un rol fără drepturi de citire nu trebuie să afle nici măcar CE ar putea
    // întreba: o listă de unelte inaccesibile e tot o hartă a aplicației.
    expect(construiestePrompt(baza({ unelte: [] }))).not.toContain("UNELTE");
  });

  it("enumeră uneltele primite, cu descrierea lor", () => {
    const prompt = construiestePrompt(
      baza({
        unelte: [
          {
            nume: "sold_concediu",
            descriere: "Zilele de concediu rămase.",
            parametri: { _def: {} } as never,
            featureKey: "leave",
            permission: "leave:read",
            minScope: "own",
            executa: async () => ({ text: "" }),
          },
        ],
      }),
    );
    expect(prompt).toContain("sold_concediu");
    expect(prompt).toContain("Zilele de concediu rămase.");
  });
});

describe("regulile de scriere", () => {
  it("cere marcajul și interzice explicit scrierea adreselor", () => {
    const prompt = construiestePrompt(baza());
    expect(prompt).toContain("[[ruta:IDENTIFICATOR]]");
    expect(prompt).toContain("NU scrii niciodată");
  });

  it("scrie ș și ț cu virgulă dedesubt, nu cu sedilă", () => {
    expect(/[şţ]/u.test(construiestePrompt(baza()))).toBe(false);
  });
});
