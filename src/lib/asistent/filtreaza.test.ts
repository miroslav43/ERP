// src/lib/asistent/filtreaza.test.ts
/**
 * Ce se verifică aici e LOGICA porții, cu hărți de permisiuni construite de
 * mână. Ce NU se verifică aici — și nu se poate — e dacă harta reală a lui
 * `employee` chiar arată așa cum credem noi.
 *
 * Distincția nu e pedanterie. Memoria proiectului spune că raționamentul despre
 * ce poate scrie un rol a greșit de patru ori la rând, iar adevărul s-a aflat
 * abia rulând sub identitatea rolului. Un test care își inventează singur
 * fixture-ul poate demonstra cel mult că filtrul face ce i-am cerut; că i-am
 * cerut lucrul potrivit se află din proba reală, pe baza vie.
 *
 * Deci: aici, algebra pragurilor. Acolo, adevărul.
 */
import { describe, expect, it } from "vitest";

import type { FeatureKey } from "@/config/features";
import type { PermissionMap } from "@/lib/auth/permissions";

import { DESTINATII } from "./destinatii";
import { destinatiiPermise, type ContextAcces } from "./filtreaza";

const TOATE_MODULELE: ReadonlySet<FeatureKey> = new Set<FeatureKey>([
  "nucleu",
  "attendance",
  "leave",
  "onboarding",
  "courses",
  "reges",
  "payroll",
  "per_diem",
  "fleet",
  "maintenance",
  "inventory",
  "ssm",
  "announcements",
  "employee_portal",
  "evaluations",
  "ticketing",
  "asistent",
]);

function harta(intrari: Readonly<Record<string, "own" | "team" | "all">>): PermissionMap {
  return new Map(Object.entries(intrari)) as PermissionMap;
}

function context(partial: Partial<ContextAcces> = {}): ContextAcces {
  return {
    features: TOATE_MODULELE,
    permisiuni: harta({}),
    zona: "app",
    ...partial,
  };
}

const idPermise = (ctx: ContextAcces): readonly string[] => destinatiiPermise(ctx).map((d) => d.id);

describe("poarta pe modul", () => {
  it("ascunde tot ce ține de un modul stins", () => {
    const ctx = context({
      features: new Set<FeatureKey>(["nucleu"]),
      permisiuni: harta({ "payroll:read": "all", "attendance:read": "all" }),
    });
    expect(idPermise(ctx)).not.toContain("salarizare");
    expect(idPermise(ctx)).not.toContain("pontaj");
  });

  it("lasă să treacă rutele fără modul, oricât de puține module ar fi active", () => {
    const ctx = context({ features: new Set<FeatureKey>() });
    // `/panou` n-are nici modul, nici permisiune: e nucleul aplicației.
    expect(idPermise(ctx)).toContain("panou");
  });
});

describe("poarta pe permisiune și prag", () => {
  it("refuză când cheia lipsește cu totul din hartă", () => {
    expect(idPermise(context())).not.toContain("salarizare");
  });

  it("refuză un scope sub pragul cerut", () => {
    // `/salarizare` cere `payroll:read` la prag `all`. Cu `team` nu se deschide.
    const ctx = context({ permisiuni: harta({ "payroll:read": "team" }) });
    expect(idPermise(ctx)).not.toContain("salarizare");
    // …dar sporurile și primele cer doar `team`, deci acelea se văd.
    expect(idPermise(ctx)).toContain("salarizare.componente");
  });

  it("acceptă un scope peste pragul cerut", () => {
    const ctx = context({ permisiuni: harta({ "leave:read": "all" }) });
    expect(idPermise(ctx)).toContain("concedii.echipa"); // cere doar `team`
  });

  it("acceptă exact la prag", () => {
    const ctx = context({ permisiuni: harta({ "attendance:approve": "team" }) });
    expect(idPermise(ctx)).toContain("pontaj.aprobare");
  });
});

describe("poarta pe zonă", () => {
  it("nu amestecă niciodată rutele de portal cu cele din aplicație", () => {
    const dinApp = idPermise(context({ zona: "app", permisiuni: harta({ "leave:read": "all" }) }));
    expect(dinApp).toContain("concedii");
    expect(dinApp).not.toContain("portal.concedii");

    const dinPortal = idPermise(
      context({ zona: "portal", permisiuni: harta({ "leave:read": "own" }) }),
    );
    expect(dinPortal).toContain("portal.concedii");
    expect(dinPortal).not.toContain("concedii");
  });
});

describe("silueta unui angajat obișnuit", () => {
  /*
   * Hartă apropiată de cea a rolului `employee`, așa cum e descrisă în CLAUDE.md:
   * `employees:read = own` (mutat de 0023 de la `none`), citiri proprii pe
   * pontaj, concedii, diurnă, cursuri, SSM, plus fluturașul propriu.
   *
   * Fixture, nu adevăr — vezi docblock-ul de sus.
   */
  const angajat = context({
    zona: "portal",
    permisiuni: harta({
      "employees:read": "own",
      "attendance:read": "own",
      "attendance:create": "own",
      "leave:read": "own",
      "leave:create": "own",
      "payroll:read": "own",
      "per_diem:read": "own",
      "per_diem:create": "own",
      "courses:read": "own",
      "ssm:read": "own",
      "inventory:read": "own",
      "announcements:read": "own",
      "tickets:read": "own",
      "tickets:create": "own",
      "maintenance:read": "own",
      "maintenance:create": "own",
      "checklists:read": "own",
    }),
  });

  it("îi dă fluturașul propriu", () => {
    expect(idPermise(angajat)).toContain("portal.salariu");
  });

  it("nu-i dă niciodată perioadele de salarizare ale firmei", () => {
    // Defectul pe care întregul strat există ca să-l prevină: asistentul care
    // spune „intră în Salarizare" cuiva care primește acolo un ecran de refuz.
    expect(idPermise(angajat)).not.toContain("salarizare");
    expect(idPermise(angajat)).not.toContain("salarizare.popriri");
    expect(idPermise(angajat)).not.toContain("rapoarte");
  });

  it("nu-i dă jurnalul de audit și nici membrii firmei", () => {
    expect(idPermise(angajat)).not.toContain("setari.audit");
    expect(idPermise(angajat)).not.toContain("setari.membri");
  });

  it("nu scapă nicio destinație cu prag `all` printre cele oferite", () => {
    // Verificarea de mulțime, nu pe cazuri alese: cu o hartă exclusiv `own`,
    // NICIO destinație care cere `team` sau `all` n-are voie să apară.
    const peste = destinatiiPermise(angajat).filter((d) => d.minScope !== "own");
    expect(peste.map((d) => d.id)).toEqual([]);
  });
});

describe("cine are tot", () => {
  it("vede mai mult decât un angajat, dar tot nu vede zona cealaltă", () => {
    const permisiuniComplete = harta(
      Object.fromEntries(
        DESTINATII.flatMap((d) => (d.permission === null ? [] : [[d.permission, "all" as const]])),
      ),
    );
    const totul = context({ permisiuni: permisiuniComplete, zona: "app" });
    const idApp = new Set(DESTINATII.filter((d) => d.zona === "app").map((d) => d.id));
    expect(new Set(idPermise(totul))).toEqual(idApp);
  });
});
