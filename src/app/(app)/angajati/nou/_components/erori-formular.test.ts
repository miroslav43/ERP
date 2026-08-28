// src/app/(app)/angajati/nou/_components/erori-formular.test.ts
import { describe, expect, it } from "vitest";

import { radacinaCampului, rezumatulErorilor } from "./erori-formular";

/**
 * Rezumatul de erori al asistentului de înrolare.
 *
 * Defectul de la care a pornit tot: butonul „Continuă” nu avansa și nu scria
 * nimic. `z.enum(X).nullable()` respingea șirul gol trimis de un `<select>` cu
 * opțiune goală, iar câmpul vinovat (`special_regime`) nu randa niciun mesaj.
 * Aici se apără partea care face erorile VIZIBILE: desfacerea arborelui, filtrul
 * pe pas și ordinea — fiindcă primul element al listei e și câmpul pe care sare
 * focusul.
 */
const ORDINE = [
  "last_name",
  "first_name",
  "stare_civila",
  "numar",
  "special_regime",
  "salariu_baza",
  "autorizatii",
] as const;

describe("radacinaCampului", () => {
  it("taie indicele și subcâmpul", () => {
    expect(radacinaCampului("autorizatii.2.numar")).toBe("autorizatii");
    expect(radacinaCampului("salariu_baza")).toBe("salariu_baza");
  });
});

describe("rezumatulErorilor", () => {
  it("desface arborele react-hook-form într-o listă plată", () => {
    const rezumat = rezumatulErorilor(
      {
        special_regime: { type: "invalid_value", message: "Alegeți un regim special din listă." },
        salariu_baza: { type: "custom", message: "Salariul de bază este obligatoriu." },
      },
      ORDINE,
      null,
    );
    expect(rezumat.map((e) => e.camp)).toEqual(["special_regime", "salariu_baza"]);
    expect(rezumat[0]?.mesaj).toBe("Alegeți un regim special din listă.");
  });

  it("pune erorile în ordinea ecranului, nu a obiectului", () => {
    // Primul element e și câmpul pe care sare focusul. În ordinea obiectului,
    // omul ar fi trimis la „Salariu de bază” înaintea lui „Nume” — adică peste
    // pași înapoi.
    const rezumat = rezumatulErorilor(
      {
        salariu_baza: { message: "Salariul de bază este obligatoriu." },
        last_name: { message: "Câmpul „Nume” este obligatoriu." },
      },
      ORDINE,
      null,
    );
    expect(rezumat.map((e) => e.camp)).toEqual(["last_name", "salariu_baza"]);
  });

  it("filtrează pe câmpurile pasului curent", () => {
    // La „Continuă” se arată doar ce blochează PASUL. Restul formularului nu e
    // încă vina nimănui.
    const rezumat = rezumatulErorilor(
      {
        last_name: { message: "Câmpul „Nume” este obligatoriu." },
        salariu_baza: { message: "Salariul de bază este obligatoriu." },
      },
      ORDINE,
      ["last_name", "first_name"],
    );
    expect(rezumat.map((e) => e.camp)).toEqual(["last_name"]);
  });

  it("coboară în listele de câmpuri, cu indice", () => {
    const rezumat = rezumatulErorilor(
      {
        autorizatii: [
          undefined,
          undefined,
          { numar: { message: "Numărul autorizației e obligatoriu." } },
        ],
      },
      ORDINE,
      null,
    );
    expect(rezumat).toHaveLength(1);
    expect(rezumat[0]?.camp).toBe("autorizatii.2.numar");
    // Numerotat de la 1: omul vede „Autorizația 3”, nu indicele 2.
    expect(rezumat[0]?.eticheta).toBe("Autorizația 3");
  });

  it("emite ȘI mesajul rădăcinii, ȘI pe cel al indicelui", () => {
    // Serverul raportează pe rădăcină — `z.flattenError` din `create-action.ts`
    // COLAPSEAZĂ `["autorizatii", 2, "numar"]` la `autorizatii`. Clientul
    // raportează pe indice. Dacă lista s-ar opri la primul mesaj găsit, una
    // dintre cele două căi ar dispărea tăcut de pe ecran.
    const rezumat = rezumatulErorilor(
      {
        autorizatii: Object.assign(
          [undefined, { numar: { message: "Numărul autorizației e obligatoriu." } }],
          { message: "Cel mult 10 autorizații la înrolare." },
        ),
      },
      ORDINE,
      null,
    );
    expect(rezumat.map((e) => e.camp)).toEqual(["autorizatii", "autorizatii.1.numar"]);
  });

  it("nu coboară în `ref`, care e un nod DOM", () => {
    // Un `ref` are proprietăți circulare: coborârea în el ar produce căi
    // absurde și, în cel mai rău caz, o buclă.
    const element = { message: "nu trebuie citit", nume: { message: "nici asta" } };
    const rezumat = rezumatulErorilor(
      { last_name: { message: "Câmpul „Nume” este obligatoriu.", ref: element } },
      ORDINE,
      null,
    );
    expect(rezumat.map((e) => e.camp)).toEqual(["last_name"]);
  });

  it("etichetează omenește, nu tehnic", () => {
    const rezumat = rezumatulErorilor(
      { special_regime: { message: "Alegeți un regim special din listă." } },
      ORDINE,
      null,
    );
    expect(rezumat[0]?.eticheta).toBe("Regim special");
  });

  it("nu produce nimic pentru un formular fără erori", () => {
    expect(rezumatulErorilor({}, ORDINE, null)).toEqual([]);
  });

  it("pune la coadă un câmp care nu e în ordinea cunoscută", () => {
    // O eroare de server pe un câmp fără control în asistent (`is_primary`) nu
    // trebuie să dispară din listă doar fiindcă nu are loc pe ecran.
    const rezumat = rezumatulErorilor(
      {
        is_primary: { message: "Fișa principală nu poate fi schimbată." },
        last_name: { message: "Câmpul „Nume” este obligatoriu." },
      },
      ORDINE,
      null,
    );
    expect(rezumat.map((e) => e.camp)).toEqual(["last_name", "is_primary"]);
  });
});
