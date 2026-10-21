import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  NAV_ITEMS,
  PORTAL_NAV_ITEMS,
  type NavItem,
  type NavLink,
  type PortalNavItem,
} from "./navigation";

/**
 * Fiecare intrare de meniu trebuie să ducă undeva.
 *
 * Verificarea adversarială a găsit trei intrări vizibile care dădeau 404 —
 * „Rapoarte", „Roluri și permisiuni", „Module active". Toate trei aveau
 * `featureKey: null`, deci se randau MEREU, pentru orice organizație.
 *
 * Restul intrărilor fără pagină — pontaj, flotă, SSM, salarizare, diurne — nu
 * se vedeau, fiindcă modulele lor erau dezactivate. Adică defectul era latent:
 * ar fi apărut în ziua în care cineva activa modulul din Super-Admin, pentru un
 * client real. Exact asta s-a și întâmplat cu concediile și inventarul, când
 * le-am activat pe organizația de demonstrație ca să se vadă mecanismul.
 *
 * Testul de față face ambele cazuri imposibile fără o decizie explicită. Lista
 * `MODULE_NECONSTRUITE` e datoria, scrisă negru pe alb: ca să ștergi o intrare
 * de acolo trebuie să livrezi pagina, iar ca să adaugi una trebuie să treci pe
 * lângă comentariul ăsta.
 */

/**
 * Module cu schemă în bază și fără ecrane. Fiecare rând dispare de aici în ziua
 * în care apare `page.tsx`-ul lui — nu invers.
 *
 * ⚠️ Nu adăuga aici o intrare cu `featureKey: null`. Un modul nelivrat rămâne
 * invizibil fiindcă flagul lui e stins; o intrare de nucleu se randează
 * necondiționat și nu are cum să fie ascunsă.
 */
const MODULE_NECONSTRUITE: readonly string[] = [];

type IntrarePlata = Readonly<{ href: string; featureKey: string | null; id: string }>;

function aplatizeaza(): readonly IntrarePlata[] {
  const rezultat: IntrarePlata[] = [];
  // Ambele meniuri, nu doar cel de administrare. Portalul a fost multă vreme
  // scutit de verificarea asta fiindcă avea cinci intrări scrise odată cu
  // paginile lor; de când e singura aplicație a unui angajat, o intrare moartă
  // acolo nu mai e o neplăcere, e o fundătură — omul n-are alt meniu în care
  // să se întoarcă.
  // `PortalNavItem` nu are `children` — portalul n-are submeniuri, fiindcă bara
  // de jos nu poate cuibări. Accesul se face prin `copiii()`, ca aplatizarea să
  // meargă peste ambele forme fără să presupună una.
  const copiii = (item: NavItem | PortalNavItem): readonly NavLink[] =>
    "children" in item ? (item.children ?? []) : [];

  for (const item of [...NAV_ITEMS, ...PORTAL_NAV_ITEMS]) {
    rezultat.push({ href: item.href, featureKey: item.featureKey, id: item.id });
    for (const copil of copiii(item)) {
      rezultat.push({ href: copil.href, featureKey: copil.featureKey, id: copil.id });
    }
  }
  return rezultat;
}

/**
 * Ruta `/x/y` corespunde unui `page.tsx` sub unul dintre grupurile de rute.
 *
 * Grupurile `(app)` / `(portal)` nu apar în URL, deci aceeași cale poate fi
 * servită din oricare. Al treilea candidat, fără grup, acoperă rutele de la
 * rădăcină.
 */
function arePagina(href: string): boolean {
  const segmente = href.replace(/^\//, "").split("/");
  return [
    path.join(process.cwd(), "src", "app", "(app)", ...segmente, "page.tsx"),
    path.join(process.cwd(), "src", "app", "(portal)", ...segmente, "page.tsx"),
    path.join(process.cwd(), "src", "app", ...segmente, "page.tsx"),
  ].some((cale) => existsSync(cale));
}

describe("meniul nu conține intrări moarte", () => {
  const intrari = aplatizeaza();

  it("fiecare intrare are fie o pagină, fie un loc declarat în lista de module neconstruite", () => {
    const orfane = intrari
      .filter((i) => !arePagina(i.href) && !MODULE_NECONSTRUITE.includes(i.href))
      .map((i) => `${i.id} → ${i.href}`);

    expect(
      orfane,
      "Intrări de meniu fără pagină și nedeclarate. Livrează pagina, sau adaug-o " +
        "în MODULE_NECONSTRUITE cu faza în care se livrează.",
    ).toEqual([]);
  });

  it("nicio intrare de nucleu nu poate rămâne fără pagină", () => {
    // Un modul nelivrat e ascuns de propriul feature flag. O intrare de nucleu
    // nu are ce s-o ascundă: se vede pentru toată lumea, în orice organizație.
    const nucleuFaraPagina = intrari
      .filter((i) => i.featureKey === null && !arePagina(i.href))
      .map((i) => `${i.id} → ${i.href}`);

    expect(nucleuFaraPagina).toEqual([]);
  });

  it("lista de module neconstruite nu conține rute care există deja", () => {
    // Altfel datoria rămâne scrisă după ce a fost plătită, iar lista își pierde
    // înțelesul: nimeni nu mai știe ce e restanță reală.
    const platite = MODULE_NECONSTRUITE.filter((href) => arePagina(href));
    expect(platite, "Rute livrate, dar rămase în MODULE_NECONSTRUITE — scoate-le.").toEqual([]);
  });

  it("nu există două intrări cu același id", () => {
    const ids = intrari.map((i) => i.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});

/**
 * UX-001: la 900 px înălțime, meniul unui administrator avea 1174 px de conținut
 * în 790 px vizibili, iar „Financiar” și „Administrare” stăteau sub pliu.
 * „Sporuri și prime” și „Popriri” sunt pagini ale salarizării, nu module: ca
 * sub-intrări ale „Salarizare” scurtează meniul cu două rânduri.
 */
describe("Salarizarea își ține sub-paginile ca sub-intrări", () => {
  const salarizare = NAV_ITEMS.find((item) => item.id === "salarizare");

  it("„Sporuri și prime” și „Popriri” sunt copii ai „Salarizare”, în ordinea asta", () => {
    expect(salarizare?.children?.map((copil) => [copil.id, copil.label, copil.href])).toEqual([
      ["componente-salariale", "Sporuri și prime", "/salarizare/componente"],
      ["popriri", "Popriri", "/salarizare/popriri"],
    ]);
  });

  it("nu mai apar ca intrări de prim nivel", () => {
    const deSus = NAV_ITEMS.map((item) => item.id);
    expect(deSus).not.toContain("componente-salariale");
    expect(deSus).not.toContain("popriri");
  });

  it("copiii păstrează pragul paginii lor", () => {
    const praguri = new Map(salarizare?.children?.map((copil) => [copil.id, copil.minScope]));
    expect(praguri.get("componente-salariale")).toBe("team");
    expect(praguri.get("popriri")).toBe("all");
  });
});

/** UX-003: meniul, titlul paginii și adresa spun același lucru — „Panou”. */
describe("Panoul are o singură denumire", () => {
  it("intrarea de meniu se numește „Panou”, ca titlul paginii", () => {
    expect(NAV_ITEMS.find((item) => item.href === "/panou")?.label).toBe("Panou");
  });
});
