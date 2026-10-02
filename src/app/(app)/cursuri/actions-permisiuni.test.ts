// src/app/(app)/cursuri/actions-permisiuni.test.ts
//
// Stratul 4 (permisiune + prag de scope) pentru TOATE cele 22 de acțiuni ale
// modulului de cursuri. Toate cer `minScope: "team"` — managerul e autor aici,
// nu doar aprobator — deci pragul imediat dedesubt e `own`, scope-ul pe care îl
// are angajatul pe `courses`. Straturile 1–3 și 5 sunt acoperite în testul
// canonic (`salarizare/actions.test.ts`) și nu se repetă.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/lib/teste/actiune")).falsuri.nextHeaders());
vi.mock("next/server", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextServer(await orig()),
);
vi.mock("next/cache", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextCache(await orig()),
);
vi.mock("@/lib/tenant/resolve-tenant", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.resolveTenant(await orig()),
);
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);
vi.mock("@/lib/supabase/admin", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseAdmin(),
);
vi.mock("@/lib/auth/features", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.features(await orig()),
);
vi.mock("@/lib/auth/permissions", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.permissions(await orig()),
);

import { FEATURE_KEYS } from "@/config/features";
import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import type { ClientFals } from "@/lib/teste/supabase-fals";
import {
  actualizeazaCurs,
  actualizeazaLectie,
  actualizeazaMaterial,
  adaugaLectie,
  anuleazaInrolare,
  aplicaRegulile,
  atribuieCurs,
  creeazaCurs,
  creeazaMaterial,
  creeazaRegula,
  dezactiveazaCurs,
  linkPreviewMaterial,
  mutaLectie,
  pregatesteIncarcareMaterial,
  publicaCurs,
  renuntaLaIncarcare,
  salveazaTest,
  salveazaVersiuneFisier,
  salveazaVersiuneLink,
  stergeLectie,
  stergeMaterial,
  stergeRegula,
} from "./actions";

type Cheie = "courses:read" | "courses:create" | "courses:update";
type Caz = readonly [
  nume: string,
  actiune: (intrare: unknown) => Promise<{ ok: boolean }>,
  cheie: Cheie,
  intrare: unknown,
];

const CALE = `${ORG_ID}/courses/${ID_1}/v1-abc-regulament.pdf`;

/** Intrări VALIDE: refuzul trebuie să vină din permisiune, nu din Zod. */
const CAZURI: readonly Caz[] = [
  ["creeazaCurs", creeazaCurs, "courses:create", { cod: "ssm_baza", denumire: "Instructaj" }],
  [
    "actualizeazaCurs",
    actualizeazaCurs,
    "courses:update",
    { id: ID_1, cod: "ssm_baza", denumire: "Instructaj" },
  ],
  ["publicaCurs", publicaCurs, "courses:update", { id: ID_1, publicat: true }],
  ["dezactiveazaCurs", dezactiveazaCurs, "courses:update", { id: ID_1, activ: false }],
  [
    "creeazaMaterial",
    creeazaMaterial,
    "courses:create",
    { cod: "regulament", titlu: "Regulament", fel: "pdf", sursa: "fisier" },
  ],
  [
    "actualizeazaMaterial",
    actualizeazaMaterial,
    "courses:update",
    { id: ID_1, cod: "regulament", titlu: "Regulament", fel: "pdf", sursa: "fisier" },
  ],
  ["stergeMaterial", stergeMaterial, "courses:update", { id: ID_1 }],
  [
    "pregatesteIncarcareMaterial",
    pregatesteIncarcareMaterial,
    "courses:create",
    {
      material_id: ID_1,
      fel: "pdf",
      nume_fisier: "r.pdf",
      dimensiune: 10,
      mime: "application/pdf",
    },
  ],
  [
    "salveazaVersiuneFisier",
    salveazaVersiuneFisier,
    "courses:create",
    { material_id: ID_1, cale: CALE, nume_fisier: "r.pdf", mime: "application/pdf" },
  ],
  ["renuntaLaIncarcare", renuntaLaIncarcare, "courses:create", { material_id: ID_1, cale: CALE }],
  [
    "salveazaVersiuneLink",
    salveazaVersiuneLink,
    "courses:create",
    { material_id: ID_1, adresa: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  ],
  ["adaugaLectie", adaugaLectie, "courses:create", { course_id: ID_1, material_id: ID_2 }],
  ["actualizeazaLectie", actualizeazaLectie, "courses:update", { id: ID_1, obligatoriu: false }],
  ["stergeLectie", stergeLectie, "courses:update", { id: ID_1 }],
  ["mutaLectie", mutaLectie, "courses:update", { id: ID_1, directie: "sus" }],
  ["atribuieCurs", atribuieCurs, "courses:create", { course_id: ID_1, employee_ids: [ID_2, ID_3] }],
  [
    "anuleazaInrolare",
    anuleazaInrolare,
    "courses:update",
    { id: ID_1, motiv: "A plecat din firmă" },
  ],
  ["linkPreviewMaterial", linkPreviewMaterial, "courses:read", { version_id: ID_1 }],
  [
    "salveazaTest",
    salveazaTest,
    "courses:update",
    {
      version_id: ID_1,
      intrebari: [
        {
          id: "q1",
          text: "Ce faceți la incendiu?",
          optiuni: [
            { id: "a", text: "Fug" },
            { id: "b", text: "Sun la 112" },
          ],
          corect: "b",
        },
      ],
    },
  ],
  ["creeazaRegula", creeazaRegula, "courses:create", { course_id: ID_1, criteriu: "toti" }],
  ["stergeRegula", stergeRegula, "courses:update", { id: ID_1 }],
  ["aplicaRegulile", aplicaRegulile, "courses:create", { course_id: ID_1 }],
];

const TOATE_CHEILE: readonly Cheie[] = ["courses:read", "courses:create", "courses:update"];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("cursuri — inventarul acțiunilor", () => {
  it("tabela acoperă toate cele 22 de acțiuni, fiecare o singură dată", () => {
    expect(CAZURI).toHaveLength(22);
    expect(new Set(CAZURI.map((c) => c[0])).size).toBe(22);
  });
});

describe("cursuri — permisiunea și pragul `team`", () => {
  it.each(CAZURI)(
    "%s: cheia cerută doar la `own` (sub `team`) ⇒ INTERZIS, fără nicio interogare",
    async (_nume, actiune, cheie, intrare) => {
      // Celelalte chei la `all`: refuzul trebuie să vină din cheia CORECTĂ,
      // nu dintr-o hartă goală.
      const permisiuni: Record<string, "own" | "all"> = {};
      for (const k of TOATE_CHEILE) permisiuni[k] = k === cheie ? "own" : "all";
      const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni });

      const r = await actiune(intrare);

      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
      expect(server.apeluriStocare).toHaveLength(0);
      expect(admin.apeluriRpc).toHaveLength(0);
      expect(admin.apeluriStocare).toHaveLength(0);
      expect(server.audituri()).toEqual([
        expect.objectContaining({ p_status: "denied", p_error_code: "INTERZIS" }),
      ]);
    },
  );
});

describe("cursuri — modulul `courses`", () => {
  it.each(CAZURI)(
    "%s: cu modulul `courses` dezactivat ⇒ MODUL_DEZACTIVAT, fără nicio interogare",
    async (_nume, actiune, _cheie, intrare) => {
      // Toate cheile la `all` și toate celelalte module active: refuzul poate
      // veni DOAR din cheia de modul a acțiunii.
      const { server, admin } = configureazaActiunea({
        functii: FEATURE_KEYS.filter((k) => k !== "courses"),
        permisiuni: Object.fromEntries(TOATE_CHEILE.map((k) => [k, "all"])),
      });

      const r = await actiune(intrare);

      expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
      expect(server.apeluri).toHaveLength(0);
      expect(server.apeluriStocare).toHaveLength(0);
      expect(admin.apeluri).toHaveLength(0);
      expect(admin.apeluriRpc).toHaveLength(0);
      expect(admin.apeluriStocare).toHaveLength(0);
    },
  );
});

describe("cursuri — organizația vine din sesiune, nu din intrare", () => {
  type CazOrganizatie = readonly [
    nume: string,
    actiune: (intrare: unknown) => Promise<{ ok: boolean }>,
    tabela: string,
    intrare: Record<string, unknown>,
    pregateste: (server: ClientFals) => void,
  ];

  const CAZURI_ORGANIZATIE: readonly CazOrganizatie[] = [
    [
      "creeazaMaterial",
      creeazaMaterial,
      "course_materials",
      { cod: "regulament", titlu: "Regulament", fel: "pdf", sursa: "fisier" },
      () => undefined,
    ],
    [
      "adaugaLectie",
      adaugaLectie,
      "course_items",
      { course_id: ID_1, material_id: ID_2 },
      (server) => server.raspunde("course_items", "select", { data: null }),
    ],
    [
      "creeazaRegula",
      creeazaRegula,
      "course_assignment_rules",
      { course_id: ID_1, criteriu: "toti" },
      () => undefined,
    ],
  ];

  it.each(CAZURI_ORGANIZATIE)(
    "%s: un `organization_id` trimis în intrare nu suprascrie organizația sesiunii",
    async (_nume, actiune, tabela, intrare, pregateste) => {
      const { server } = configureazaActiunea({
        permisiuni: { "courses:create": "team" },
      });
      pregateste(server);
      server.raspunde(tabela, "insert", { data: { id: ID_3 } });

      const r = await actiune({ ...intrare, organization_id: ID_2 });

      expect(r.ok).toBe(true);
      const [apel] = server.apeluriPe(tabela, "insert");
      expect((apel?.payload as { organization_id: string }).organization_id).toBe(ORG_ID);
    },
  );
});
