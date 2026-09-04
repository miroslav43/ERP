// src/lib/push/coada.test.ts
import { describe, expect, it, vi, afterEach } from "vitest";

import type { AdminSupabase } from "@/lib/supabase/admin";

import * as expoModule from "./expo";
import { golesteCoada, MAX_INCERCARI } from "./coada";

// Mock parțial: `trimiteLot` rămâne implementarea REALĂ (deleagă la
// `actual.trimiteLot`) pentru toate testele care mimează rețeaua prin
// `mockExpo`/`stubGlobal("fetch", ...)`. Un singur test (mai jos, „lot mai
// scurt") suprascrie explicit un răspuns, ca să exercite o formă
// (`rezultate.length < randuri.length`) pe care `trimiteLot` de azi n-o
// produce niciodată singur — vezi comentariul de acolo.
vi.mock("./expo", async (importActual) => {
  const actual = await importActual<typeof import("./expo")>();
  return { ...actual, trimiteLot: vi.fn(actual.trimiteLot) };
});

type Rand = {
  id: string;
  incercari: number;
  jeton: string;
  dispozitiv_id: string;
  titlu: string;
  corp: string | null;
  link: string | null;
};

type ConfigClientFals = {
  /** Ce întoarce `db.rpc("push_ia_din_coada", ...)`. `undefined` ⇒ `[]`. */
  randuriRpc?: Rand[] | null;
  eroareRpc?: { message: string } | null;
  /** Id-uri de `push_livrari` a căror scriere trebuie să eșueze. */
  scrieriPushLivrariEsuate?: ReadonlySet<string>;
  /** Id-uri de `dispozitive_push` a căror retragere (UPDATE) trebuie să eșueze. */
  retrageriEsuate?: ReadonlySet<string>;
  /**
   * Id-uri de dispozitive DEJA retrase înainte de această rulare — simulează
   * cursa cu alt rând din același lot sau cu `/api/dispozitive`:
   * `.is("deleted_at", null)` nu mai potrivește nimic, deci `retras` iese
   * `null`, FĂRĂ eroare.
   */
  dejaRetrase?: ReadonlySet<string>;
  /** Dacă scrierea în `audit_logs` trebuie să eșueze. */
  auditEsueaza?: boolean;

  /*
   * Citirile de context (`contextePeDispozitiv` → `contexteDestinatar`).
   * Implicit, `dispozitive_push` întoarce câte un rând pentru FIECARE id cerut,
   * al aceluiași `user-1` din `org-1` — forma în care testele vechi n-aveau
   * nevoie să știe de ele.
   */
  dispozitive?: readonly { id: string; user_id: string; organization_id: string }[];
  eroareCitireDispozitive?: { message: string };
  /** `leave_requests`: cererea → fișa solicitantului. */
  cereri?: readonly { id: string; employee_id: string }[];
  /** `tickets`: tichetul → fișa solicitantului. */
  tichete?: readonly { id: string; solicitant_employee_id: string | null }[];
  /** `employees`: fișa → contul. */
  fise?: readonly { id: string; user_id: string | null }[];
};

/**
 * Un lanț `.select().in().in().is()` care se rezolvă la `{ data, error }`.
 *
 * PostgREST întoarce același obiect indiferent câte filtre s-au pus, deci
 * fake-ul acceptă orice ordine și orice număr de filtre și le ignoră pe toate
 * în afară de cel pe `id` — singurul de care depinde ce se întoarce. Filtrul pe
 * `organization_id` e verificat SEPARAT, de testul care îl cere explicit.
 */
function lantCitire<T extends { id: string }>(
  randuri: readonly T[],
  jurnal?: { filtre: { coloana: string; valori: readonly string[] }[] },
) {
  const construieste = (rezultat: readonly T[]) => {
    const nod = {
      in(coloana: string, valori: readonly string[]) {
        jurnal?.filtre.push({ coloana, valori });
        return coloana === "id"
          ? construieste(rezultat.filter((r) => valori.includes(r.id)))
          : construieste(rezultat);
      },
      is(_coloana: string, _valoare: null) {
        return construieste(rezultat);
      },
      then<R>(rezolva: (v: { data: readonly T[]; error: null }) => R): Promise<R> {
        return Promise.resolve(rezolva({ data: rezultat, error: null }));
      },
    };
    return nod;
  };
  return construieste(randuri);
}

/**
 * Client fals: expune doar ce folosește `golesteCoada`. Un mock al întregului
 * `SupabaseClient` ar fi de zece ori mai lung și ar testa biblioteca, nu codul.
 *
 * Suprafața a crescut față de runda 1 (era doar `.update().eq()` pe
 * `push_livrari`): `golesteCoada` verifică acum `error` la fiecare scriere și
 * scrie explicit auditul retragerii, deci fake-ul trebuie să poată SIMULA un
 * eșec de scriere pe fiecare tabelă, nu doar să înregistreze succesul.
 */
function clientFals(config: ConfigClientFals = {}) {
  const actualizari: { id: string; date: Record<string, unknown> }[] = [];
  const retrase: string[] = [];
  const audituri: Record<string, unknown>[] = [];
  const apeluriRpc: { nume: string; args: unknown }[] = [];
  const jurnalCereri = { filtre: [] as { coloana: string; valori: readonly string[] }[] };

  return {
    actualizari,
    retrase,
    audituri,
    apeluriRpc,
    jurnalCereri,
    rpc: (nume: string, args: unknown) => {
      apeluriRpc.push({ nume, args });
      if (config.eroareRpc) return Promise.resolve({ data: null, error: config.eroareRpc });
      return Promise.resolve({
        data: config.randuriRpc === undefined ? [] : config.randuriRpc,
        error: null,
      });
    },
    from(tabela: string) {
      if (tabela === "push_livrari") {
        return {
          update(date: Record<string, unknown>) {
            return {
              eq(_coloana: string, id: string) {
                if (config.scrieriPushLivrariEsuate?.has(id)) {
                  return Promise.resolve({ error: { message: "scriere eșuată (simulat)." } });
                }
                actualizari.push({ id, date });
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      if (tabela === "dispozitive_push") {
        return {
          select(_coloane: string) {
            return {
              in(_coloana: string, ids: readonly string[]) {
                if (config.eroareCitireDispozitive !== undefined) {
                  return Promise.resolve({ data: null, error: config.eroareCitireDispozitive });
                }
                const randuri =
                  config.dispozitive ??
                  ids.map((id) => ({ id, user_id: "user-1", organization_id: "org-1" }));
                return Promise.resolve({
                  data: randuri.filter((d) => ids.includes(d.id)),
                  error: null,
                });
              },
            };
          },
          update(_date: Record<string, unknown>) {
            return {
              eq(_coloana: string, id: string) {
                return {
                  is(_coloana2: string, _valoare: null) {
                    return {
                      select(_coloane: string) {
                        return {
                          maybeSingle() {
                            if (config.retrageriEsuate?.has(id)) {
                              return Promise.resolve({
                                data: null,
                                error: { message: "retragere eșuată (simulat)." },
                              });
                            }
                            if (config.dejaRetrase?.has(id)) {
                              return Promise.resolve({ data: null, error: null });
                            }
                            retrase.push(id);
                            return Promise.resolve({
                              data: { organization_id: "org-1", user_id: "user-1" },
                              error: null,
                            });
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (tabela === "audit_logs") {
        return {
          insert(rand: Record<string, unknown>) {
            audituri.push(rand);
            if (config.auditEsueaza) {
              return Promise.resolve({ error: { message: "audit eșuat (simulat)." } });
            }
            return Promise.resolve({ error: null });
          },
        };
      }
      if (tabela === "leave_requests") {
        return { select: (_c: string) => lantCitire(config.cereri ?? [], jurnalCereri) };
      }
      if (tabela === "tickets") {
        return { select: (_c: string) => lantCitire(config.tichete ?? []) };
      }
      if (tabela === "employees") {
        return { select: (_c: string) => lantCitire(config.fise ?? []) };
      }
      throw new Error(`clientFals: tabelă neașteptată „${tabela}”.`);
    },
  };
}

function rand(peste: Partial<Rand> = {}): Rand {
  return {
    id: "l1",
    // Reflectă valoarea DEJA incrementată de `push_ia_din_coada` la preluare
    // (0122, secțiunea 5b, Runda 2) — un rând claimat pentru prima oară vine
    // din RPC cu `incercari = 1`, nu `0`. `golesteCoada` nu mai adaugă un
    // `+ 1` în TypeScript.
    incercari: 1,
    jeton: "ExponentPushToken[a]",
    dispozitiv_id: "d1",
    titlu: "Concediu aprobat.",
    corp: null,
    link: "/portal/concediile-mele",
    ...peste,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(expoModule.trimiteLot).mockClear();
});

function mockExpo(bilete: unknown[]): void {
  vi.stubGlobal("fetch", () =>
    Promise.resolve(
      new Response(JSON.stringify({ data: bilete }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("golesteCoada", () => {
  it("coada goală nu cheamă rețeaua", async () => {
    const apeluri: unknown[] = [];
    vi.stubGlobal("fetch", (...a: unknown[]) => {
      apeluri.push(a);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    const db = clientFals({ randuriRpc: [] });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport).toEqual({ luate: 0, trimise: 0, esuate: 0, abandonate: 0, jetoaneRetrase: 0 });
    expect(apeluri).toHaveLength(0);
  });

  it("`data: null` de la rpc se tratează ca array gol, nu ca excepție", async () => {
    const apeluri: unknown[] = [];
    vi.stubGlobal("fetch", (...a: unknown[]) => {
      apeluri.push(a);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    // `randuriRpc: null` explicit — distinct de `undefined` (⇒ `[]` în fake),
    // exact forma pe care `db.rpc(...)` o poate întoarce real când n-are
    // niciun rând de dat.
    const db = clientFals({ randuriRpc: null });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport).toEqual({ luate: 0, trimise: 0, esuate: 0, abandonate: 0, jetoaneRetrase: 0 });
    expect(apeluri).toHaveLength(0);
  });

  it("trimite plafonul și MAX_INCERCARI explicit către rpc", async () => {
    // GARDA CUPLAJULUI cu `p_max_incercari` din 0122. Funcția SQL are un
    // implicit (5), dar sursa de adevăr e `MAX_INCERCARI` de aici — iar
    // singurul lucru care leagă cele două valori e argumentul de mai jos.
    // Fără testul ăsta, cineva poate scoate `p_max_incercari` din apel și
    // nimic nu cade: baza ar folosi tăcut implicitul ei, care poate să nu
    // mai fie aceeași valoare. Pragul din SQL e păzit separat, din partea
    // cealaltă, de verificarea (21) din tests/rls/proba-push.sql.
    const db = clientFals({ randuriRpc: [] });
    await golesteCoada(db as unknown as AdminSupabase, 42);
    expect(db.apeluriRpc).toHaveLength(1);
    expect(db.apeluriRpc[0]?.nume).toBe("push_ia_din_coada");
    expect(db.apeluriRpc[0]?.args).toEqual({ p_plafon: 42, p_max_incercari: MAX_INCERCARI });
  });

  it("o eroare de la rpc se propagă ca excepție, cu mesaj în română", async () => {
    const db = clientFals({ eroareRpc: { message: "conexiune refuzată" } });
    await expect(golesteCoada(db as unknown as AdminSupabase)).rejects.toThrow(
      "Preluarea din coadă a eșuat: conexiune refuzată.",
    );
  });

  it("marchează trimis rândul livrat", async () => {
    mockExpo([{ status: "ok", id: "x" }]);
    const db = clientFals({ randuriRpc: [rand()] });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.trimise).toBe(1);
    expect(db.actualizari[0]?.date.stare).toBe("trimis");
    expect(db.actualizari[0]?.date.trimis_la).toEqual(expect.any(String));
  });

  it("un jeton mort retrage dispozitivul, scrie auditul și abandonează rândul", async () => {
    mockExpo([{ status: "error", details: { error: "DeviceNotRegistered" } }]);
    const db = clientFals({ randuriRpc: [rand()] });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.jetoaneRetrase).toBe(1);
    expect(raport.abandonate).toBe(1);
    expect(db.retrase).toEqual(["d1"]);
    expect(db.actualizari[0]?.date.stare).toBe("abandonat");
    // Auditul manual e obligatoriu (src/lib/supabase/admin.ts): triggerul
    // generic ar scrie actor_id = auth.uid(), NULL sub service_role oricum —
    // aici actor_id rămâne EXPLICIT null, fiindcă nu există niciun om care a
    // acționat (Expo a confirmat un telefon mort, nu o predare).
    expect(db.audituri).toHaveLength(1);
    expect(db.audituri[0]).toMatchObject({
      organization_id: "org-1",
      actor_id: null,
      action: "delete",
      entity_type: "dispozitive_push",
      entity_id: "d1",
    });
  });

  it("dispozitiv deja retras (cursă benignă): rândul se abandonează, dar fără o nouă retragere sau un nou audit", async () => {
    mockExpo([{ status: "error", details: { error: "DeviceNotRegistered" } }]);
    const db = clientFals({ randuriRpc: [rand()], dejaRetrase: new Set(["d1"]) });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.jetoaneRetrase).toBe(0);
    expect(raport.abandonate).toBe(1);
    expect(db.retrase).toEqual([]);
    expect(db.audituri).toHaveLength(0);
    expect(db.actualizari[0]?.date.stare).toBe("abandonat");
  });

  it("retragerea dispozitivului eșuează: rândul tot se abandonează, dar nu se numără ca jeton retras", async () => {
    mockExpo([{ status: "error", details: { error: "DeviceNotRegistered" } }]);
    const spyEroare = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = clientFals({ randuriRpc: [rand()], retrageriEsuate: new Set(["d1"]) });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.jetoaneRetrase).toBe(0);
    expect(raport.abandonate).toBe(1);
    expect(db.retrase).toEqual([]);
    expect(db.audituri).toHaveLength(0);
    expect(spyEroare).toHaveBeenCalled();
    spyEroare.mockRestore();
  });

  it("o eroare obișnuită lasă rândul reîncercabil, fără să scrie incercari din TypeScript", async () => {
    mockExpo([{ status: "error", message: "boom", details: { error: "MessageTooBig" } }]);
    // `incercari: 2` simulează a doua preluare a aceluiași rând (deja
    // incrementat de SQL, de la 1 la 2). Runda 3: `golesteCoada` nu mai scrie
    // `incercari` DELOC înapoi — SQL-ul a scris deja exact această valoare, iar
    // o rescriere de-aici ar risca să suprascrie cu o valoare stagnantă
    // incrementul unei preluări concurente mai noi (minor găsit în revizuire).
    const db = clientFals({ randuriRpc: [rand({ incercari: 2 })] });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.esuate).toBe(1);
    expect(db.actualizari[0]?.date.stare).toBe("in_asteptare");
    expect(db.actualizari[0]?.date.eroare).toBe("boom");
    expect(db.actualizari[0]?.date).not.toHaveProperty("incercari");
  });

  it("abandonează după MAX_INCERCARI, fără să scrie incercari din TypeScript", async () => {
    mockExpo([{ status: "error", message: "boom", details: { error: "MessageTooBig" } }]);
    // `incercari: MAX_INCERCARI` — valoarea vine DEJA la prag din preluare
    // (SQL incrementează la fiecare claim, 0122 secțiunea 5b).
    const db = clientFals({ randuriRpc: [rand({ incercari: MAX_INCERCARI })] });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.abandonate).toBe(1);
    expect(db.actualizari[0]?.date.stare).toBe("abandonat");
    expect(db.actualizari[0]?.date).not.toHaveProperty("incercari");
  });

  it("o scriere de stare eșuată nu se numără ca succes și nu blochează restul lotului", async () => {
    mockExpo([
      { status: "error", message: "boom", details: { error: "MessageTooBig" } },
      { status: "ok" },
    ]);
    const spyEroare = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = clientFals({
      randuriRpc: [rand({ id: "l1" }), rand({ id: "l2", dispozitiv_id: "d2" })],
      scrieriPushLivrariEsuate: new Set(["l1"]),
    });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    // l1: scrierea reîncercării a picat — nu se numără nici la `esuate`.
    expect(raport.esuate).toBe(0);
    expect(db.actualizari.some((a) => a.id === "l1")).toBe(false);
    // l2: nealterat de eșecul lui l1 — poziția se potrivește corect.
    expect(raport.trimise).toBe(1);
    expect(db.actualizari.find((a) => a.id === "l2")?.date.stare).toBe("trimis");
    expect(raport.luate).toBe(2);
    // Invarianta raportului: diferența dintre `luate` și suma celorlalte
    // patru contoare e vizibilă (aici 1), nu ascunsă într-un fals succes.
    expect(raport.trimise + raport.esuate + raport.abandonate).toBe(1);
    expect(spyEroare).toHaveBeenCalled();
    spyEroare.mockRestore();
  });

  it("N rânduri cu rezultate amestecate: potrivirea pozițională ține pentru toate", async () => {
    mockExpo([
      { status: "ok" },
      { status: "error", details: { error: "DeviceNotRegistered" } },
      { status: "error", message: "boom", details: { error: "MessageTooBig" } },
    ]);
    const db = clientFals({
      randuriRpc: [
        rand({ id: "l1", dispozitiv_id: "d1" }),
        rand({ id: "l2", dispozitiv_id: "d2" }),
        rand({ id: "l3", dispozitiv_id: "d3", incercari: 1 }),
      ],
    });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport).toEqual({ luate: 3, trimise: 1, esuate: 1, abandonate: 1, jetoaneRetrase: 1 });
    expect(db.actualizari.find((a) => a.id === "l1")?.date.stare).toBe("trimis");
    expect(db.actualizari.find((a) => a.id === "l2")?.date.stare).toBe("abandonat");
    expect(db.actualizari.find((a) => a.id === "l3")?.date.stare).toBe("in_asteptare");
    // Nu se mai scrie deloc `incercari` din TypeScript (Runda 3).
    expect(db.actualizari.find((a) => a.id === "l3")?.date).not.toHaveProperty("incercari");
    // Doar dispozitivul mort (l2 → d2) se retrage — nu d1, nu d3.
    expect(db.retrase).toEqual(["d2"]);
  });

  it("lot mai scurt decât cozile trimise: rândul rămas se tratează ca eroare reîncercabilă, nu se pierde", async () => {
    // `trimiteLot` de azi nu produce niciodată un rezultat mai scurt decât
    // intrarea (fiecare poziție lipsă e umplută de `citesteBilet(undefined)`
    // cu un `{ fel: "eroare" }` explicit) — de-aia forma se simulează direct
    // pe mock-ul funcției, nu prin `mockExpo`/`fetch`. Contractul pozițional
    // cu Task 3 a costat trei runde de reparații tocmai pe cazul ăsta.
    vi.mocked(expoModule.trimiteLot).mockResolvedValueOnce([{ fel: "ok" }]);
    const db = clientFals({
      randuriRpc: [rand({ id: "l1" }), rand({ id: "l2", dispozitiv_id: "d2" })],
    });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.luate).toBe(2);
    expect(raport.trimise).toBe(1);
    expect(db.actualizari.find((a) => a.id === "l1")?.date.stare).toBe("trimis");
    // l2 n-are bilet corespunzător — tratat ca eroare reîncercabilă, NU
    // aruncă și NU indexează greșit restul lotului.
    expect(raport.esuate).toBe(1);
    expect(db.actualizari.find((a) => a.id === "l2")?.date.stare).toBe("in_asteptare");
    expect(db.actualizari.find((a) => a.id === "l2")?.date.eroare).toBe("Fără bilet de la Expo.");
  });
});

/**
 * Contextul de proprietate al legăturii — decizia A din 2026-09-04.
 *
 * Verifică LANȚUL, nu doar `caleaDePortal` (care are propriile teste pure): că
 * `golesteCoada` chiar rezolvă cine deține cererea și chiar trimite rezultatul
 * mai departe în mesajul către Expo.
 */
describe("golesteCoada — traducerea legăturii depinde de destinatar", () => {
  const CERERE = "3f8c1d2e-1111-4222-8333-444455556666";

  /** Calea din primul mesaj trimis către Expo în ultima rulare. */
  function caleaTrimisa(): string {
    const apel = vi.mocked(expoModule.trimiteLot).mock.calls.at(-1);
    const mesaje = apel?.[0];
    if (mesaje === undefined || mesaje[0] === undefined) {
      throw new Error("trimiteLot n-a fost chemat cu niciun mesaj.");
    }
    return mesaje[0].data.cale;
  }

  it("cererea PROPRIE se traduce în ecranul ei", async () => {
    mockExpo([{ status: "ok", id: "b1" }]);
    const db = clientFals({
      randuriRpc: [rand({ link: `/concedii/${CERERE}` })],
      dispozitive: [{ id: "d1", user_id: "user-1", organization_id: "org-1" }],
      cereri: [{ id: CERERE, employee_id: "fisa-1" }],
      fise: [{ id: "fisa-1", user_id: "user-1" }],
    });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.trimise).toBe(1);
    expect(caleaTrimisa()).toBe(`/portal/concediile-mele/${CERERE}`);
  });

  it("cererea ALTCUIVA cade pe cutia poștală, nu pe un 404", async () => {
    // Exact rândurile din `0056:95` (HR) și `0079:338` (aprobatori): aceeași
    // legătură, alt destinatar. Zece din cele 15 din baza vie erau așa.
    mockExpo([{ status: "ok", id: "b1" }]);
    const db = clientFals({
      randuriRpc: [rand({ link: `/concedii/${CERERE}` })],
      dispozitive: [{ id: "d1", user_id: "user-hr", organization_id: "org-1" }],
      cereri: [{ id: CERERE, employee_id: "fisa-1" }],
      fise: [{ id: "fisa-1", user_id: "user-1" }],
    });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    // Notificarea PLEACĂ — se schimbă doar unde aterizează.
    expect(raport.trimise).toBe(1);
    expect(caleaTrimisa()).toBe("/portal/notificarile-mele");
  });

  it("fișa fără cont de utilizator nu se potrivește cu nimeni", async () => {
    // `employees.user_id` e nullable: un angajat fără cont. Fără garda din
    // `utilizatoriiFiselor`, un `undefined` ar fi putut deveni cheie în hartă.
    mockExpo([{ status: "ok", id: "b1" }]);
    const db = clientFals({
      randuriRpc: [rand({ link: `/concedii/${CERERE}` })],
      cereri: [{ id: CERERE, employee_id: "fisa-1" }],
      fise: [{ id: "fisa-1", user_id: null }],
    });
    await golesteCoada(db as unknown as AdminSupabase);
    expect(caleaTrimisa()).toBe("/portal/notificarile-mele");
  });

  it("citirea dispozitivelor picată NU oprește livrarea", async () => {
    // Degradare, nu eșec: contextul iese gol, legătura rămâne netradusă, omul
    // primește mesajul în cutia poștală. O notificare nelivrată ar fi mai rău.
    mockExpo([{ status: "ok", id: "b1" }]);
    const db = clientFals({
      randuriRpc: [rand({ link: `/concedii/${CERERE}` })],
      eroareCitireDispozitive: { message: "citire eșuată (simulat)." },
    });
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.trimise).toBe(1);
    expect(caleaTrimisa()).toBe("/portal/notificarile-mele");
  });

  it("filtrează explicit pe `organization_id` — contractul service_role", async () => {
    // `createAdminSupabase()` ocolește RLS; contractul din
    // `src/lib/supabase/admin.ts` cere ca filtrul de firmă să fie scris de
    // mână. Fără el, un id de cerere ghicit ar traversa granița dintre firme.
    mockExpo([{ status: "ok", id: "b1" }]);
    const db = clientFals({
      randuriRpc: [rand({ link: `/concedii/${CERERE}` })],
      dispozitive: [{ id: "d1", user_id: "user-1", organization_id: "org-9" }],
      cereri: [{ id: CERERE, employee_id: "fisa-1" }],
      fise: [{ id: "fisa-1", user_id: "user-1" }],
    });
    await golesteCoada(db as unknown as AdminSupabase);
    const peOrganizatie = db.jurnalCereri.filtre.find((f) => f.coloana === "organization_id");
    expect(peOrganizatie, "citirea cererilor n-a filtrat pe organization_id").toBeDefined();
    expect(peOrganizatie?.valori).toEqual(["org-9"]);
  });

  it("nu atinge deloc baza pentru legături care nu depind de destinatar", async () => {
    // `/pontaj/saptamana` se traduce din listă. Dacă lotul n-are nicio
    // legătură cu proprietar, cele trei citiri de context nu trebuie făcute.
    mockExpo([{ status: "ok", id: "b1" }]);
    const db = clientFals({ randuriRpc: [rand({ link: "/pontaj/saptamana" })] });
    await golesteCoada(db as unknown as AdminSupabase);
    expect(caleaTrimisa()).toBe("/portal/pontajul-meu/saptamana");
    expect(db.jurnalCereri.filtre).toHaveLength(0);
  });
});
