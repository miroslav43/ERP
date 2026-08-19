import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { NAV_ITEMS, type NavLink } from "./navigation";

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
  for (const item of NAV_ITEMS) {
    rezultat.push({ href: item.href, featureKey: item.featureKey, id: item.id });
    for (const copil of (item.children ?? []) as readonly NavLink[]) {
      rezultat.push({ href: copil.href, featureKey: copil.featureKey, id: copil.id });
    }
  }
  return rezultat;
}

/** Ruta `/x/y` corespunde lui `src/app/(app)/x/y/page.tsx` sau `src/app/x/y/page.tsx`. */
function arePagina(href: string): boolean {
  const segmente = href.replace(/^\//, "").split("/");
  return [
    path.join(process.cwd(), "src", "app", "(app)", ...segmente, "page.tsx"),
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
    expect(platite, "Rute livrate, dar rămase în MODULE_NECONSTRUITE — scoate-le.").toEqual(
      [],
    );
  });

  it("nu există două intrări cu același id", () => {
    const ids = intrari.map((i) => i.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});
