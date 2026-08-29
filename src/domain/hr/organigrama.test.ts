// src/domain/hr/organigrama.test.ts
import { describe, expect, it } from "vitest";

import { construiesteOrganigrama, type NodOrganigrama, type RandOrganigrama } from "./organigrama";

/**
 * Cazurile de aici nu sunt ipotetice. Pe firma reală care a cerut schimbarea,
 * ambele fișe aveau `manager_employee_id = null`: patronul și singurul lui
 * angajat apăreau ca doi arbori paraleli, ca și cum n-ar avea nicio legătură.
 *
 * Miza testelor e mai ales pe ce NU se întâmplă: cuibărirea implicită se face
 * DOAR când există exact un administrator, și doar dacă el însuși e rădăcină.
 * Un al doilea administrator face întrebarea „sub cine?" să n-aibă răspuns, iar
 * un răspuns inventat ar desena o ierarhie plauzibilă și falsă.
 */

interface Rand extends RandOrganigrama {
  readonly nume: string;
}

const rand = (
  id: string,
  manager_employee_id: string | null,
  user_id: string | null = `u-${id}`,
): Rand => ({ id, manager_employee_id, user_id, nume: id });

/** Harta rol pe cont, în forma întoarsă de `rolurileConturilor`. */
const roluri = (...perechi: readonly (readonly [string, string])[]) => new Map(perechi);

function idUri(noduri: readonly NodOrganigrama<Rand>[]): string[] {
  return noduri.flatMap((n) => [n.date.id, ...idUri(n.copii)]);
}

describe("construiesteOrganigrama", () => {
  it("întoarce arbore gol pentru intrare goală", () => {
    const rezultat = construiesteOrganigrama<Rand>([], new Map());
    expect(rezultat.arbore).toEqual([]);
    expect(rezultat.administrator).toBeNull();
    expect(rezultat.atasatiImplicit).toBe(0);
  });

  it("pune administratorul rădăcină și îi atârnă dedesubt ceilalți fără manager", () => {
    const rezultat = construiesteOrganigrama(
      [rand("patron", null), rand("angajat", null)],
      roluri(["u-patron", "org_admin"]),
    );

    expect(idUri(rezultat.arbore)).toEqual(["patron", "angajat"]);
    expect(rezultat.arbore).toHaveLength(1);
    expect(rezultat.administrator?.id).toBe("patron");
    expect(rezultat.atasatiImplicit).toBe(1);
  });

  it("marchează drept implicită doar muchia dedusă, nu și pe cele configurate", () => {
    const rezultat = construiesteOrganigrama(
      [rand("patron", null), rand("sef", null), rand("subordonat", "sef")],
      roluri(["u-patron", "org_admin"]),
    );

    const sef = rezultat.arbore[0]?.copii[0];
    expect(sef?.date.id).toBe("sef");
    expect(sef?.implicit).toBe(true);
    expect(sef?.copii[0]?.date.id).toBe("subordonat");
    // `subordonat` are manager configurat în bază — muchia lui e reală.
    expect(sef?.copii[0]?.implicit).toBe(false);
    // Rădăcina n-are părinte, deci n-are ce muchie să fie dedusă.
    expect(rezultat.arbore[0]?.implicit).toBe(false);
  });

  it("așază subordonații reali ai administratorului înaintea celor atașați implicit", () => {
    const rezultat = construiesteOrganigrama(
      [rand("patron", null), rand("atasat", null), rand("real", "patron")],
      roluri(["u-patron", "org_admin"]),
    );

    expect(rezultat.arbore[0]?.copii.map((n) => n.date.id)).toEqual(["real", "atasat"]);
    expect(rezultat.arbore[0]?.copii.map((n) => n.implicit)).toEqual([false, true]);
  });

  it("nu cuibărește nimic când sunt doi administratori", () => {
    const rezultat = construiesteOrganigrama(
      [rand("patron1", null), rand("patron2", null), rand("angajat", null)],
      roluri(["u-patron1", "org_admin"], ["u-patron2", "org_admin"]),
    );

    expect(rezultat.arbore).toHaveLength(3);
    expect(rezultat.administrator).toBeNull();
    expect(rezultat.atasatiImplicit).toBe(0);
  });

  it("nu cuibărește nimic când niciun cont nu e administrator", () => {
    const rezultat = construiesteOrganigrama(
      [rand("a", null), rand("b", null)],
      roluri(["u-a", "manager"], ["u-b", "employee"]),
    );

    expect(rezultat.arbore).toHaveLength(2);
    expect(rezultat.administrator).toBeNull();
  });

  it("nu cuibărește nimic când administratorul are el însuși un manager vizibil", () => {
    // Se poate configura: patronul își pune un manager direct pe fișă. Atunci
    // el nu e vârful ierarhiei, iar mutarea celorlalți sub el ar fi o invenție.
    const rezultat = construiesteOrganigrama(
      [rand("sef", null), rand("patron", "sef"), rand("angajat", null)],
      roluri(["u-patron", "org_admin"]),
    );

    expect(rezultat.arbore.map((n) => n.date.id)).toEqual(["sef", "angajat"]);
    expect(rezultat.administrator).toBeNull();
  });

  it("ignoră fișele fără cont la căutarea administratorului", () => {
    const rezultat = construiesteOrganigrama(
      [rand("faraCont", null, null), rand("patron", null)],
      roluri(["u-patron", "org_admin"]),
    );

    expect(rezultat.administrator?.id).toBe("patron");
    expect(idUri(rezultat.arbore)).toEqual(["patron", "faraCont"]);
  });

  it("atașează și rădăcinile al căror manager e nevizibil, nu doar pe cele fără manager", () => {
    // Managerul șters logic sau inactiv: rândul lui nu vine din bază, deci
    // subordonatul rămâne fără părinte vizibil. E aceeași lipsă de ierarhie.
    const rezultat = construiesteOrganigrama(
      [rand("patron", null), rand("orfan", "manager-sters")],
      roluri(["u-patron", "org_admin"]),
    );

    expect(idUri(rezultat.arbore)).toEqual(["patron", "orfan"]);
    expect(rezultat.arbore[0]?.copii[0]?.implicit).toBe(true);
    expect(rezultat.atasatiImplicit).toBe(1);
  });

  it("numără rădăcinile cu manager nevizibil chiar și fără administrator", () => {
    const rezultat = construiesteOrganigrama(
      [rand("a", "sters-1"), rand("b", "sters-2"), rand("c", null)],
      new Map(),
    );

    expect(rezultat.radaciniFaraManagerVizibil).toBe(2);
    expect(rezultat.administrator).toBeNull();
  });

  it("calculează nivelul pornind de la 1 la rădăcină", () => {
    const rezultat = construiesteOrganigrama(
      [rand("patron", null), rand("sef", null), rand("subordonat", "sef")],
      roluri(["u-patron", "org_admin"]),
    );

    expect(rezultat.arbore[0]?.nivel).toBe(1);
    expect(rezultat.arbore[0]?.copii[0]?.nivel).toBe(2);
    expect(rezultat.arbore[0]?.copii[0]?.copii[0]?.nivel).toBe(3);
  });

  it("nu intră în buclă la un ciclu și nu pierde niciun rând", () => {
    // Baza n-ar trebui să lase un ciclu (`tg_employees_manager_path` îl
    // respinge), dar funcția primește ce i se dă și nu poate invoca triggerul
    // drept garanție — vezi aceeași coadă în `departments/arbore.ts`.
    const rezultat = construiesteOrganigrama(
      [rand("x", "y"), rand("y", "x"), rand("liber", null)],
      new Map(),
    );

    const toate = idUri(rezultat.arbore);
    expect([...toate].sort()).toEqual(["liber", "x", "y"]);
    expect(toate).toHaveLength(3);
  });

  it("nu pierde rândurile dintr-un ciclu nici când există administrator", () => {
    const rezultat = construiesteOrganigrama(
      [rand("patron", null), rand("x", "y"), rand("y", "x")],
      roluri(["u-patron", "org_admin"]),
    );

    const toate = idUri(rezultat.arbore);
    expect([...toate].sort()).toEqual(["patron", "x", "y"]);
    expect(toate).toHaveLength(3);
  });
});
