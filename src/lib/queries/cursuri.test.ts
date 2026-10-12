// src/lib/queries/cursuri.test.ts
//
// Citirile modulului de cursuri. Scope-ul (own/team/all) NU se filtrează în
// cod — politicile din 0075 restrâng rândurile —, deci aici se verifică ce e
// responsabilitatea aplicației: filtrul de organizație, `deleted_at`, plafonul
// sub `max_rows`, paginarea keyset (limita+1 ⇒ cursor), maparea rândurilor și
// agregările.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import {
  areFiltru,
  eroarePostgrest,
  type ApelFals,
  type ClientFals,
} from "@/lib/teste/supabase-fals";
import {
  filtreCursuriSchema,
  filtreInrolariSchema,
  filtreMaterialeSchema,
} from "@/schemas/cursuri";

import {
  angajatiPentruAtribuire,
  cheiaVersiunii,
  cheieCelula,
  citesteCurs,
  citesteInrolare,
  citesteLectieInrolare,
  citesteMaterial,
  citesteVersiune,
  cursuriObligatoriiNepublicate,
  cursurileMele,
  dovadaInrolarii,
  incercarileLectiei,
  intrebarileVersiunii,
  lectiileCursului,
  lectiileInrolarii,
  listeazaCursuri,
  listeazaInrolari,
  listeazaMateriale,
  materialeDisponibile,
  matriceConformitate,
  numeAngajati,
  regulileCursului,
  restanteDinCursuri,
  tinteRegula,
  versiunileMaterialului,
  type CursulMeu,
  type RandInrolare,
} from "./cursuri";
import { codificaCursor, decodificaCursor } from "./cursor";

let server: ClientFals;

beforeEach(() => {
  ({ server } = configureazaActiunea());
});

const argumente = (apel: ApelFals | undefined, metoda: string) =>
  apel?.filtre.filter((f) => f.metoda === metoda).map((f) => f.argumente);

const limita = (apel: ApelFals | undefined) => argumente(apel, "limit")?.[0]?.[0];

const areOrgSiNesters = (apel: ApelFals | undefined) =>
  areFiltru(apel, "eq", "organization_id", ORG_ID) && areFiltru(apel, "is", "deleted_at", null);

const curs = (id: string, denumire: string) => ({
  id,
  cod: `c_${denumire.toLowerCase()}`,
  denumire,
  created_at: "2026-09-01T00:00:00Z",
});

describe("listeazaCursuri", () => {
  it("o pagină plină + un rând în plus ⇒ cursorul pe ULTIMUL rând afișat; total din numărare", async () => {
    server.raspunde("courses", "select", {
      data: [
        curs(ID_1, "A"),
        curs(ID_2, "B"),
        curs(ID_3, "C"),
        curs("x4", "D"),
        curs("x5", "E"),
        curs("x6", "F"),
      ],
    });
    server.raspunde("courses", "select", { count: 42 });

    const r = await listeazaCursuri(ORG_ID, filtreCursuriSchema.parse({ limita: 5 }));

    expect(r.randuri).toHaveLength(5);
    expect(r.total).toBe(42);
    expect(r.sortare).toEqual({ cheie: "denumire", directie: "asc" });
    expect(r.urmatorulCursor).not.toBeNull();
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "E", id: "x5" });

    const [lista, numarare] = server.apeluriPe("courses");
    expect(areOrgSiNesters(lista)).toBe(true);
    expect(areOrgSiNesters(numarare)).toBe(true);
    expect(limita(lista)).toBe(6);
    expect(argumente(lista, "order")).toEqual([
      ["denumire", { ascending: true, nullsFirst: false }],
      ["id", { ascending: true }],
    ]);
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
  });

  it("ultima pagină (fără rând în plus) ⇒ fără cursor", async () => {
    server.raspunde("courses", "select", { data: [curs(ID_1, "A")] });
    server.raspunde("courses", "select", { count: 1 });
    const r = await listeazaCursuri(ORG_ID, filtreCursuriSchema.parse({ limita: 5 }));
    expect(r.urmatorulCursor).toBeNull();
  });

  it("filtrele (publicate, căutare) se aplică IDENTIC pe listă și pe numărare", async () => {
    server.raspunde("courses", "select", { data: [] });
    server.raspunde("courses", "select", { count: 0 });

    const r = await listeazaCursuri(
      ORG_ID,
      filtreCursuriSchema.parse({ cauta: "50%_ssm", doar_publicate: "da" }),
    );

    expect(r).toMatchObject({ randuri: [], total: 0, urmatorulCursor: null });
    for (const apel of server.apeluriPe("courses")) {
      expect(areFiltru(apel, "eq", "publicat", true)).toBe(true);
      const [or] = argumente(apel, "or") ?? [];
      // `%` tastat de om e scos, `_` e scăpat (`\_`, dublat în ghilimelele
      // PostgREST): niciunul nu mai e joker.
      const tipar = String.raw`"%50 \\_ssm%"`;
      expect(or?.[0]).toBe(`denumire.ilike.${tipar},cod.ilike.${tipar}`);
    }
  });

  it("cursorul primit adaugă predicatul keyset pe coloana sortării cerute", async () => {
    server.raspunde("courses", "select", { data: [] });
    server.raspunde("courses", "select", { count: 0 });
    const cursor = codificaCursor({ valoare: "ssm", id: ID_1 });

    const r = await listeazaCursuri(ORG_ID, filtreCursuriSchema.parse({ sort: "-cod", cursor }));

    expect(r.sortare).toEqual({ cheie: "cod", directie: "desc" });
    const [lista, numarare] = server.apeluriPe("courses");
    expect(argumente(lista, "or")).toEqual([[`cod.lt."ssm",and(cod.eq."ssm",id.lt."${ID_1}")`]]);
    // Numărarea nu se paginează.
    expect(argumente(numarare, "or")).toEqual([]);
  });

  it("o sortare necunoscută din URL cade tăcut pe denumire", async () => {
    server.raspunde("courses", "select", { data: [] });
    server.raspunde("courses", "select", { count: 0 });
    const r = await listeazaCursuri(ORG_ID, filtreCursuriSchema.parse({ sort: "parola" }));
    expect(r.sortare).toEqual({ cheie: "denumire", directie: "asc" });
  });

  it("eroarea listei sau a numărării se aruncă", async () => {
    server.raspunde("courses", "select", { data: [] });
    server.raspunde("courses", "select", { error: eroarePostgrest("42501") });
    await expect(listeazaCursuri(ORG_ID, filtreCursuriSchema.parse({}))).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("listeazaMateriale", () => {
  it("filtrul de fel și căutarea pe titlu/cod; cursorul pe sortarea după fel", async () => {
    const rand = (id: string, fel: string) => ({ id, cod: "m", titlu: "T", fel });
    server.raspunde("course_materials", "select", {
      data: [
        rand(ID_1, "pdf"),
        rand(ID_2, "pdf"),
        rand(ID_3, "video"),
        rand("x4", "video"),
        rand("x5", "video"),
        rand("x6", "video"),
      ],
    });
    server.raspunde("course_materials", "select", { count: 6 });

    const r = await listeazaMateriale(
      ORG_ID,
      filtreMaterialeSchema.parse({ fel: "video", cauta: "foc", sort: "fel", limita: 5 }),
    );

    expect(r.randuri).toHaveLength(5);
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "video", id: "x5" });
    for (const apel of server.apeluriPe("course_materials")) {
      expect(areOrgSiNesters(apel)).toBe(true);
      expect(areFiltru(apel, "eq", "fel", "video")).toBe(true);
      expect(argumente(apel, "or")?.[0]?.[0]).toBe('titlu.ilike."%foc%",cod.ilike."%foc%"');
    }
  });
});

describe("listeazaInrolari", () => {
  const inrolare = (id: string, termen: string | null) => ({
    id,
    termen,
    status: "neinceput",
    employee_id: ID_1,
  });

  it("restanțele: deschise ȘI cu termen trecut, pe listă și pe numărare", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T09:00:00Z"));
    server.raspunde("course_enrollments", "select", { data: [] });
    server.raspunde("course_enrollments", "select", { count: 0 });

    await listeazaInrolari(
      ORG_ID,
      filtreInrolariSchema.parse({ doar_restante: "da", curs: ID_2, angajat: ID_3 }),
    );
    vi.useRealTimers();

    for (const apel of server.apeluriPe("course_enrollments")) {
      expect(areOrgSiNesters(apel)).toBe(true);
      expect(areFiltru(apel, "in", "status", ["neinceput", "in_curs"])).toBe(true);
      expect(areFiltru(apel, "lt", "termen", "2026-10-02")).toBe(true);
      expect(areFiltru(apel, "eq", "course_id", ID_2)).toBe(true);
      expect(areFiltru(apel, "eq", "employee_id", ID_3)).toBe(true);
    }
  });

  it("implicit sortează după termen crescător, cu termenele goale la coadă", async () => {
    server.raspunde("course_enrollments", "select", { data: [] });
    server.raspunde("course_enrollments", "select", { count: 0 });
    await listeazaInrolari(ORG_ID, filtreInrolariSchema.parse({}));
    const [lista] = server.apeluriPe("course_enrollments");
    expect(argumente(lista, "order")?.[0]).toEqual([
      "termen",
      { ascending: true, nullsFirst: false },
    ]);
  });

  it("pagina care se termină pe o înrolare FĂRĂ termen are continuare", async () => {
    // De la 0085 termenul poate fi NULL; cursorul pe `ultim.termen` se anula,
    // iar rândurile de după nu se mai puteau vedea, deși `total` le număra.
    server.raspunde("course_enrollments", "select", {
      data: [
        inrolare(ID_1, "2026-10-01"),
        inrolare(ID_2, "2026-10-05"),
        inrolare(ID_3, null),
        inrolare("x4", null),
        inrolare("x5", null),
        inrolare("x6", null),
      ],
    });
    server.raspunde("course_enrollments", "select", { count: 9 });

    const r = await listeazaInrolari(ORG_ID, filtreInrolariSchema.parse({ limita: 5 }));

    expect(r.randuri).toHaveLength(5);
    expect(r.urmatorulCursor).not.toBeNull();
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "", id: "x5" });
  });

  it("după o înrolare fără termen: pagina următoare cere doar termenele NULL, după id", async () => {
    server.raspunde("course_enrollments", "select", { data: [] });
    server.raspunde("course_enrollments", "select", { count: 0 });
    await listeazaInrolari(
      ORG_ID,
      filtreInrolariSchema.parse({ cursor: codificaCursor({ valoare: "", id: ID_3 }) }),
    );
    const [lista] = server.apeluriPe("course_enrollments");
    expect(argumente(lista, "or")?.[0]).toEqual([`and(termen.is.null,id.gt."${ID_3}")`]);
  });

  it("după o înrolare cu termen: pagina următoare cere și termenele NULL de la coadă", async () => {
    server.raspunde("course_enrollments", "select", { data: [] });
    server.raspunde("course_enrollments", "select", { count: 0 });
    await listeazaInrolari(
      ORG_ID,
      filtreInrolariSchema.parse({ cursor: codificaCursor({ valoare: "2026-10-05", id: ID_2 }) }),
    );
    const [lista] = server.apeluriPe("course_enrollments");
    expect(String(argumente(lista, "or")?.[0]?.[0])).toMatch(/,termen\.is\.null$/u);
  });
});

describe("citirile unui singur rând", () => {
  it.each([
    ["citesteCurs", citesteCurs, "courses", "id", true],
    ["citesteMaterial", citesteMaterial, "course_materials", "id", true],
    ["citesteVersiune", citesteVersiune, "course_material_versions", "id", true],
    ["citesteInrolare", citesteInrolare, "course_enrollments", "id", true],
    ["citesteLectieInrolare", citesteLectieInrolare, "course_enrollment_items", "id", true],
    // Dovada imutabilă NU are `deleted_at`: filtrul ar da 42703.
    ["dovadaInrolarii", dovadaInrolarii, "course_completion_records", "enrollment_id", false],
  ] as const)(
    "%s: id + organizație, `deleted_at` = %s, null când lipsește",
    async (_n, fn, tabela, col, sters) => {
      server.raspunde(tabela, "select", { data: { id: ID_2 } });
      expect(await fn(ORG_ID, ID_2)).toEqual({ id: ID_2 });
      server.raspunde(tabela, "select", { data: null });
      expect(await fn(ORG_ID, ID_2)).toBeNull();

      const [apel] = server.apeluriPe(tabela);
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "eq", col, ID_2)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(sters);
      expect(apel?.terminal).toBe("maybeSingle");

      server.raspunde(tabela, "select", { error: eroarePostgrest("42703") });
      await expect(fn(ORG_ID, ID_2)).rejects.toMatchObject({ code: "42703" });
    },
  );
});

describe("listele plafonate", () => {
  it.each([
    [
      "versiunileMaterialului",
      () => versiunileMaterialului(ORG_ID, ID_1),
      "course_material_versions",
      "material_id",
      200,
      true,
    ],
    [
      "lectiileInrolarii",
      () => lectiileInrolarii(ORG_ID, ID_1),
      "course_enrollment_items",
      "enrollment_id",
      500,
      true,
    ],
    [
      "regulileCursului",
      () => regulileCursului(ORG_ID, ID_1),
      "course_assignment_rules",
      "course_id",
      200,
      true,
    ],
    [
      "incercarileLectiei",
      () => incercarileLectiei(ORG_ID, ID_1),
      "course_quiz_attempts",
      "enrollment_item_id",
      100,
      false,
    ],
  ] as const)(
    "%s: organizație + părinte, plafon %s sub max_rows, gol ⇒ []",
    async (_n, fn, tabela, col, plafon, sters) => {
      server.raspunde(tabela, "select", { data: null });
      expect(await fn()).toEqual([]);
      const [apel] = server.apeluriPe(tabela);
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "eq", col, ID_1)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(sters);
      expect(limita(apel)).toBe(plafon);
    },
  );

  it("materialeDisponibile: doar active și nesterse, alfabetic, plafon 500", async () => {
    server.raspunde("course_materials", "select", { data: [{ id: ID_1 }] });
    expect(await materialeDisponibile(ORG_ID)).toEqual([{ id: ID_1 }]);
    const [apel] = server.apeluriPe("course_materials");
    expect(areOrgSiNesters(apel)).toBe(true);
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
    expect(limita(apel)).toBe(500);
  });

  it("tinteRegula: departamentele nesterse ale organizației", async () => {
    server.raspunde("departments", "select", { data: [{ id: ID_1, denumire: "Producție" }] });
    expect(await tinteRegula(ORG_ID)).toEqual({
      departamente: [{ id: ID_1, denumire: "Producție" }],
    });
    expect(areOrgSiNesters(server.apeluriPe("departments")[0])).toBe(true);
  });
});

describe("lectiileCursului", () => {
  it("aplatizează materialul și versiunea curentă; materialul ascuns de RLS devine „—”", async () => {
    server.raspunde("course_items", "select", {
      data: [
        {
          id: ID_1,
          ordine: 1,
          obligatoriu: true,
          material_id: ID_2,
          course_materials: {
            titlu: "Film SSM",
            fel: "video",
            sursa: "fisier",
            treapta_dovada: "parcurgere",
            versiune_curenta_id: ID_3,
            course_material_versions: { durata_secunde: 480 },
          },
        },
        { id: ID_2, ordine: 2, obligatoriu: false, material_id: ID_3, course_materials: null },
      ],
    });

    const r = await lectiileCursului(ORG_ID, ID_1);

    expect(r).toEqual([
      {
        id: ID_1,
        ordine: 1,
        obligatoriu: true,
        material_id: ID_2,
        titlu: "Film SSM",
        fel: "video",
        sursa: "fisier",
        treapta_dovada: "parcurgere",
        are_versiune: true,
        durata_secunde: 480,
      },
      {
        id: ID_2,
        ordine: 2,
        obligatoriu: false,
        material_id: ID_3,
        titlu: "—",
        fel: "pdf",
        sursa: "fisier",
        treapta_dovada: "bifa",
        are_versiune: false,
        durata_secunde: null,
      },
    ]);
    const [apel] = server.apeluriPe("course_items");
    expect(areOrgSiNesters(apel)).toBe(true);
    expect(areFiltru(apel, "eq", "course_id", ID_1)).toBe(true);
    expect(argumente(apel, "order")).toEqual([["ordine", { ascending: true }]]);
  });
});

describe("cursurileMele și restanteDinCursuri", () => {
  it("doar înrolările persoanei, fără cele anulate; cursul ascuns cade pe valori sigure", async () => {
    server.raspunde("course_enrollments", "select", {
      data: [
        {
          id: ID_1,
          status: "in_curs",
          courses: { denumire: "SSM", descriere: "d", obligatoriu: false, prag_avertizare_zile: 7 },
        },
        { id: ID_2, status: "neinceput", courses: null },
      ],
    });

    const r = await cursurileMele(ORG_ID, ID_3);

    expect(r).toEqual([
      {
        inrolare: { id: ID_1, status: "in_curs" },
        denumire: "SSM",
        descriere: "d",
        obligatoriu: false,
        prag_avertizare_zile: 7,
      },
      {
        inrolare: { id: ID_2, status: "neinceput" },
        denumire: "—",
        descriere: null,
        obligatoriu: true,
        prag_avertizare_zile: 30,
      },
    ]);
    const [apel] = server.apeluriPe("course_enrollments");
    expect(areOrgSiNesters(apel)).toBe(true);
    // Explicit, chiar dacă RLS ar restrânge: un cont `all` n-are voie să vadă firma.
    expect(areFiltru(apel, "eq", "employee_id", ID_3)).toBe(true);
    expect(areFiltru(apel, "neq", "status", "anulat")).toBe(true);
    expect(limita(apel)).toBe(200);
  });

  const cu = (status: RandInrolare["status"], termen: string | null): CursulMeu => ({
    inrolare: { status, termen } as RandInrolare,
    denumire: "x",
    descriere: null,
    obligatoriu: true,
    prag_avertizare_zile: 30,
  });

  it.each([
    ["listă goală", [], 0, null],
    [
      "doar finalizate/expirate/anulate",
      [cu("finalizat", "2026-10-10"), cu("expirat", null), cu("anulat", "2026-10-03")],
      0,
      null,
    ],
    [
      "cel mai apropiat termen viitor, nu cel trecut",
      [cu("in_curs", "2026-09-01"), cu("neinceput", "2026-10-20"), cu("neinceput", "2026-10-05")],
      3,
      "2026-10-05",
    ],
    [
      "toate restante ⇒ cel mai vechi",
      [cu("in_curs", "2026-09-10"), cu("neinceput", "2026-08-01")],
      2,
      "2026-08-01",
    ],
    [
      "termenul de azi contează ca viitor",
      [cu("in_curs", "2026-10-02"), cu("in_curs", "2026-09-01")],
      2,
      "2026-10-02",
    ],
    [
      "deschise fără termen se numără, dar n-au termen",
      [cu("in_curs", null), cu("neinceput", null)],
      2,
      null,
    ],
  ] as const)("%s", (_caz, cursuri, deFacut, termen) => {
    expect(restanteDinCursuri(cursuri, "2026-10-02")).toEqual({
      deFacut,
      celMaiApropiatTermen: termen,
    });
  });
});

describe("angajații", () => {
  it("angajatiPentruAtribuire: fișe active/suspendate/preaviz, `full_name` mapat pe `nume`", async () => {
    server.raspunde("employees", "select", {
      data: [
        { id: ID_1, full_name: "Ionescu Ana", department_id: ID_2, cod_cor: "251401" },
        { id: ID_2, full_name: "", department_id: null, cod_cor: null },
      ],
    });
    expect(await angajatiPentruAtribuire(ORG_ID)).toEqual([
      { id: ID_1, nume: "Ionescu Ana", department_id: ID_2, cod_cor: "251401" },
      { id: ID_2, nume: "—", department_id: null, cod_cor: null },
    ]);
    const [apel] = server.apeluriPe("employees");
    expect(areOrgSiNesters(apel)).toBe(true);
    expect(areFiltru(apel, "in", "status", ["activ", "suspendat", "preaviz"])).toBe(true);
    expect(apel?.coloane).toBe("id, full_name, department_id, cod_cor");
    expect(limita(apel)).toBe(500);
  });

  it("numeAngajati: listă goală ⇒ nicio interogare", async () => {
    expect((await numeAngajati(ORG_ID, [])).size).toBe(0);
    expect(server.apeluri).toHaveLength(0);
  });

  it("numeAngajati: identificatorii se deduplică și se plafonează la 500", async () => {
    server.raspunde("employees", "select", {
      data: [
        { id: ID_1, full_name: "Ana", deleted_at: null },
        { id: ID_2, full_name: "", deleted_at: "2026-01-01T00:00:00Z" },
      ],
    });
    const ids = [ID_1, ID_1, ID_2, ...Array.from({ length: 600 }, (_, i) => `id-${String(i)}`)];

    const r = await numeAngajati(ORG_ID, ids);

    // `deleted_at` vine cu numele: fișa ștearsă rămâne în stadiu, dar fără link.
    expect([...r]).toEqual([
      [ID_1, { nume: "Ana", deleted_at: null }],
      [ID_2, { nume: "—", deleted_at: "2026-01-01T00:00:00Z" }],
    ]);
    const [apel] = server.apeluriPe("employees");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    const lista = argumente(apel, "in")?.[0]?.[1] as string[];
    expect(lista).toHaveLength(500);
    expect(lista.slice(0, 2)).toEqual([ID_1, ID_2]);
  });
});

describe("testul grilă", () => {
  it("intrebarileVersiunii: păstrează doar întrebările și opțiunile bine formate, fără cheie", async () => {
    server.raspunde("course_material_versions", "select", {
      data: {
        intrebari: [
          {
            id: "q1",
            text: "Ce?",
            optiuni: [{ id: "a", text: "A" }, { id: 2, text: "B" }, null],
            corect: "a",
          },
          { id: "q2", text: "Fără opțiuni" },
          { id: 3, text: "id numeric" },
          "șir",
          null,
        ],
      },
    });

    const r = await intrebarileVersiunii(ORG_ID, ID_1);

    expect(r).toEqual([
      { id: "q1", text: "Ce?", optiuni: [{ id: "a", text: "A" }] },
      { id: "q2", text: "Fără opțiuni", optiuni: [] },
    ]);
    const [apel] = server.apeluriPe("course_material_versions");
    expect(areOrgSiNesters(apel)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(server.apeluriPe("course_answer_keys")).toHaveLength(0);
  });

  it.each([[null], [{ intrebari: null }], [{ intrebari: { q1: 1 } }]])(
    "intrebarileVersiunii: conținut lipsă sau nelistă (%j) ⇒ []",
    async (data) => {
      server.raspunde("course_material_versions", "select", { data });
      expect(await intrebarileVersiunii(ORG_ID, ID_1)).toEqual([]);
    },
  );

  it.each([
    [{ chei: { q1: "a", q2: 3, q3: null, q4: "b" } }, { q1: "a", q4: "b" }],
    [{ chei: null }, {}],
    [null, {}],
  ])("cheiaVersiunii(%j) ⇒ doar perechile text", async (data, asteptat) => {
    server.raspunde("course_answer_keys", "select", { data });
    expect(await cheiaVersiunii(ORG_ID, ID_1)).toEqual(asteptat);
    const [apel] = server.apeluriPe("course_answer_keys");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "version_id", ID_1)).toBe(true);
  });
});

describe("conformitatea", () => {
  it("cheieCelula leagă angajatul de curs fără ambiguitate", () => {
    expect(cheieCelula(ID_1, ID_2)).toBe(`${ID_1}|${ID_2}`);
    expect(cheieCelula(ID_1, ID_2)).not.toBe(cheieCelula(ID_2, ID_1));
  });

  it("cursuriObligatoriiNepublicate: numără lecțiile nesterse pe fiecare curs, zero inclus", async () => {
    server.raspunde("courses", "select", {
      data: [
        { id: ID_1, denumire: "A" },
        { id: ID_2, denumire: "B" },
      ],
    });
    server.raspunde("course_items", "select", { data: [{ course_id: ID_1 }, { course_id: ID_1 }] });

    expect(await cursuriObligatoriiNepublicate(ORG_ID)).toEqual([
      { id: ID_1, denumire: "A", lectii: 2 },
      { id: ID_2, denumire: "B", lectii: 0 },
    ]);
    const [cursuri] = server.apeluriPe("courses");
    expect(areOrgSiNesters(cursuri)).toBe(true);
    expect(areFiltru(cursuri, "eq", "obligatoriu", true)).toBe(true);
    expect(areFiltru(cursuri, "eq", "activ", true)).toBe(true);
    expect(areFiltru(cursuri, "eq", "publicat", false)).toBe(true);
    const [lectii] = server.apeluriPe("course_items");
    expect(areOrgSiNesters(lectii)).toBe(true);
    expect(areFiltru(lectii, "in", "course_id", [ID_1, ID_2])).toBe(true);
  });

  it("cursuriObligatoriiNepublicate: niciun curs ⇒ fără a doua interogare", async () => {
    server.raspunde("courses", "select", { data: [] });
    expect(await cursuriObligatoriiNepublicate(ORG_ID)).toEqual([]);
    expect(server.apeluriPe("course_items")).toHaveLength(0);
  });

  it("matriceConformitate: ciclul cel mai mare câștigă celula; pragul vine de pe curs", async () => {
    server.raspunde("employees", "select", { data: [{ id: ID_1, full_name: "Ana" }] });
    server.raspunde("courses", "select", {
      data: [
        { id: ID_2, denumire: "SSM", prag_avertizare_zile: 14 },
        { id: ID_3, denumire: "PSI", prag_avertizare_zile: 30 },
      ],
    });
    server.raspunde("course_enrollments", "select", {
      data: [
        {
          employee_id: ID_1,
          course_id: ID_2,
          status: "in_curs",
          termen: "2026-11-01",
          expira_la: null,
          ciclu: 2,
        },
        {
          employee_id: ID_1,
          course_id: ID_2,
          status: "finalizat",
          termen: null,
          expira_la: "2026-10-01",
          ciclu: 1,
        },
      ],
    });

    const r = await matriceConformitate(ORG_ID);

    expect(r.cursuri.map((c) => c.id)).toEqual([ID_2, ID_3]);
    expect([...r.celule]).toEqual([
      [
        cheieCelula(ID_1, ID_2),
        { status: "in_curs", termen: "2026-11-01", expiraLa: null, pragAvertizareZile: 14 },
      ],
    ]);
    const [cursuri] = server.apeluriPe("courses");
    expect(areOrgSiNesters(cursuri)).toBe(true);
    expect(areFiltru(cursuri, "eq", "obligatoriu", true)).toBe(true);
    expect(areFiltru(cursuri, "eq", "publicat", true)).toBe(true);
    expect(limita(cursuri)).toBe(50);
    const [inrolari] = server.apeluriPe("course_enrollments");
    expect(areOrgSiNesters(inrolari)).toBe(true);
    expect(areFiltru(inrolari, "in", "course_id", [ID_2, ID_3])).toBe(true);
    expect(areFiltru(inrolari, "neq", "status", "anulat")).toBe(true);
    expect(argumente(inrolari, "order")).toEqual([["ciclu", { ascending: false }]]);
  });

  it("matriceConformitate: fără cursuri obligatorii ⇒ fără citirea înrolărilor; angajații plafonați la 100", async () => {
    server.raspunde("employees", "select", {
      data: Array.from({ length: 120 }, (_, i) => ({ id: `e${String(i)}`, full_name: "X" })),
    });
    server.raspunde("courses", "select", { data: [] });

    const r = await matriceConformitate(ORG_ID);

    expect(r.angajati).toHaveLength(100);
    expect(r.celule.size).toBe(0);
    expect(server.apeluriPe("course_enrollments")).toHaveLength(0);
  });
});
