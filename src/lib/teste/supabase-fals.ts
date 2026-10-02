// src/lib/teste/supabase-fals.ts
//
// Clientul Supabase FALS al testelor de acțiuni și de citiri. Folosit DOAR din
// fișiere `*.test.ts` — nu se importă niciodată din cod de producție.
//
// De ce un singur fals comun, nu câte unul scris de mână în fiecare test (ca în
// `src/lib/push/coada.test.ts` sau `concedii/suspendare-contract.test.ts`): cele
// 221 de `createAction` din `src/app/(app)/**/actions.ts` folosesc aceleași
// lanțuri PostgREST (`.from().update().eq().select().maybeSingle()`), iar un
// fals rescris de 30 de ori ar fi 30 de locuri în care testul poate minți.
//
// Două principii:
//
//   1. ÎNREGISTREAZĂ tot. Fiecare `from(...)` devine un `ApelFals` în
//      `apeluri`, cu operația, payload-ul, coloanele și TOATE filtrele în
//      ordinea în care au fost chemate. Testul verifică apoi că `.eq(
//      "organization_id", ...)` chiar a fost pus, că `.select()` vine după
//      `.update()` (capcana 17), că `.is("deleted_at", null)` nu lipsește.
//
//   2. E STRICT. Un apel pentru care testul n-a programat un răspuns ARUNCĂ, cu
//      tabela și operația în mesaj. Un fals care întoarce tăcut `{data: null}`
//      ar face ca o acțiune care citește tabela greșită să treacă testul.
//      Excepție: `rpc("log_audit_event")`, chemat de `createAction` la fiecare
//      refuz și succes — răspunde implicit cu succes, ca testele să nu-l
//      programeze de fiecare dată (se poate totuși programa, ex. un eșec).

export type OperatieFalsa = "select" | "insert" | "update" | "upsert" | "delete";

export type Filtru = Readonly<{ metoda: string; argumente: readonly unknown[] }>;

export type ApelFals = {
  readonly tabela: string;
  operatie: OperatieFalsa;
  payload: unknown;
  /** Coloanele din `.select(...)` al unei CITIRI. */
  coloane: string | undefined;
  /** Opțiunile lui `.select(..., {count, head})` sau `.upsert(..., {onConflict})`. */
  optiuni: unknown;
  /** Coloanele din `.select(...)` chemat DUPĂ o scriere (`RETURNING`). */
  selectDupaScriere: string | undefined;
  readonly filtre: Filtru[];
  /** Cum s-a încheiat lanțul: `await` direct, `.single()` sau `.maybeSingle()`. */
  terminal: "await" | "single" | "maybeSingle" | "csv" | undefined;
};

export type RezultatFals = Readonly<{
  data?: unknown;
  error?: unknown;
  count?: number | null;
}>;

export type ApelRpc = Readonly<{ nume: string; argumente: unknown }>;
export type ApelStocare = Readonly<{
  bucket: string;
  metoda: string;
  argumente: readonly unknown[];
}>;
export type ApelAuth = Readonly<{ metoda: string; argumente: readonly unknown[] }>;

/** Metode de lanț care NU sunt filtre: nu se înregistrează în `filtre`. */
const MODIFICATORI_NEUTRI = new Set(["returns", "overrideTypes", "abortSignal", "throwOnError"]);

const RPC_IMPLICITE: ReadonlySet<string> = new Set(["log_audit_event"]);

/**
 * Eroare cu forma pe care o recunoaște `isPostgrestError`
 * (`src/lib/actions/errors.ts`): `code` și `message` șiruri, plus cheia
 * `details` — fără ea, eroarea cade pe ramura EROARE_INTERNA.
 */
export function eroarePostgrest(
  code: string,
  message = `eroare simulată ${code}.`,
  details: string | null = null,
): { code: string; message: string; details: string | null; hint: null; name: string } {
  return { code, message, details, hint: null, name: "PostgrestError" };
}

export type ClientFals = ReturnType<typeof clientFals>;

/**
 * Construiește un client fals nou. Fiecare test își face unul (sau îl
 * primește gata făcut din `configureazaActiunea`, `@/lib/teste/actiune`).
 *
 *   const fals = clientFals();
 *   fals.raspunde("payroll_periods", "update", { data: { id, status: "inchis" } });
 *   await inchidePerioada({ id });
 *   const [apel] = fals.apeluriPe("payroll_periods", "update");
 *   expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
 */
export function clientFals() {
  const apeluri: ApelFals[] = [];
  const apeluriRpc: ApelRpc[] = [];
  const apeluriStocare: ApelStocare[] = [];
  const apeluriAuth: ApelAuth[] = [];

  const cozi = new Map<string, RezultatFals[]>();
  const coziRpc = new Map<string, RezultatFals[]>();
  const coziStocare = new Map<string, RezultatFals[]>();
  const coziAuth = new Map<string, RezultatFals[]>();

  const pune = (harta: Map<string, RezultatFals[]>, cheie: string, rezultat: RezultatFals) => {
    const coada = harta.get(cheie) ?? [];
    coada.push(rezultat);
    harta.set(cheie, coada);
  };
  const ia = (harta: Map<string, RezultatFals[]>, ...chei: string[]): RezultatFals | undefined => {
    for (const cheie of chei) {
      const coada = harta.get(cheie);
      if (coada !== undefined && coada.length > 0) return coada.shift();
    }
    return undefined;
  };
  const normalizeaza = (r: RezultatFals) => ({
    data: r.data === undefined ? null : r.data,
    error: r.error === undefined ? null : r.error,
    count: r.count === undefined ? null : r.count,
    status: r.error === undefined || r.error === null ? 200 : 400,
    statusText: "",
  });

  function lant(tabela: string) {
    const apel: ApelFals = {
      tabela,
      operatie: "select",
      payload: undefined,
      coloane: undefined,
      optiuni: undefined,
      selectDupaScriere: undefined,
      filtre: [],
      terminal: undefined,
    };
    apeluri.push(apel);
    let operatieScriere = false;

    const finalizeaza = (terminal: NonNullable<ApelFals["terminal"]>) => {
      apel.terminal = terminal;
      const rezultat = ia(cozi, `${tabela}:${apel.operatie}`, tabela);
      if (rezultat === undefined) {
        return Promise.reject(
          new Error(
            `clientFals: niciun răspuns programat pentru ${tabela}:${apel.operatie} ` +
              `(filtre: ${apel.filtre.map((f) => `${f.metoda}(${JSON.stringify(f.argumente)})`).join(", ") || "—"}). ` +
              `Adaugă fals.raspunde("${tabela}", "${apel.operatie}", {...}) în test.`,
          ),
        );
      }
      return Promise.resolve(normalizeaza(rezultat));
    };

    const proxy: object = new Proxy(
      {},
      {
        get(_tinta, prop) {
          if (typeof prop === "symbol") return undefined;
          if (prop === "then") {
            return (rezolva: (v: unknown) => unknown, respinge?: (e: unknown) => unknown) =>
              finalizeaza("await").then(rezolva, respinge);
          }
          if (prop === "single" || prop === "maybeSingle" || prop === "csv") {
            return () => finalizeaza(prop);
          }
          if (prop === "insert" || prop === "update" || prop === "upsert" || prop === "delete") {
            return (payload?: unknown, optiuni?: unknown) => {
              apel.operatie = prop;
              apel.payload = prop === "delete" ? undefined : payload;
              apel.optiuni = prop === "delete" ? payload : optiuni;
              operatieScriere = true;
              return proxy;
            };
          }
          if (prop === "select") {
            return (coloane?: string, optiuni?: unknown) => {
              if (operatieScriere) {
                apel.selectDupaScriere = coloane ?? "*";
              } else {
                apel.coloane = coloane ?? "*";
                apel.optiuni = optiuni;
              }
              return proxy;
            };
          }
          return (...argumente: unknown[]) => {
            if (!MODIFICATORI_NEUTRI.has(prop)) apel.filtre.push({ metoda: prop, argumente });
            return proxy;
          };
        },
      },
    );
    return proxy;
  }

  const stocare = {
    from(bucket: string) {
      return new Proxy(
        {},
        {
          get(_tinta, prop) {
            if (typeof prop === "symbol" || prop === "then") return undefined;
            return (...argumente: unknown[]) => {
              apeluriStocare.push({ bucket, metoda: prop, argumente });
              const rezultat = ia(coziStocare, `${bucket}:${prop}`);
              if (rezultat === undefined) {
                return Promise.reject(
                  new Error(
                    `clientFals: niciun răspuns programat pentru storage ${bucket}.${prop}(). ` +
                      `Adaugă fals.raspundeStocare("${bucket}", "${prop}", {...}).`,
                  ),
                );
              }
              return Promise.resolve(normalizeaza(rezultat));
            };
          },
        },
      );
    },
  };

  const auth = (prefix: string): object =>
    new Proxy(
      {},
      {
        get(_tinta, prop) {
          if (typeof prop === "symbol" || prop === "then") return undefined;
          if (prop === "admin" && prefix === "") return auth("admin.");
          const metoda = `${prefix}${prop}`;
          return (...argumente: unknown[]) => {
            apeluriAuth.push({ metoda, argumente });
            const rezultat = ia(coziAuth, metoda);
            if (rezultat === undefined) {
              return Promise.reject(
                new Error(
                  `clientFals: niciun răspuns programat pentru auth.${metoda}(). ` +
                    `Adaugă fals.raspundeAuth("${metoda}", {...}).`,
                ),
              );
            }
            return Promise.resolve(normalizeaza(rezultat));
          };
        },
      },
    );

  const client = {
    from: (tabela: string) => lant(tabela),
    rpc(nume: string, argumente?: unknown) {
      apeluriRpc.push({ nume, argumente });
      const rezultat = ia(coziRpc, nume);
      if (rezultat !== undefined) return Promise.resolve(normalizeaza(rezultat));
      if (RPC_IMPLICITE.has(nume)) return Promise.resolve(normalizeaza({}));
      return Promise.reject(
        new Error(
          `clientFals: niciun răspuns programat pentru rpc("${nume}"). ` +
            `Adaugă fals.raspundeRpc("${nume}", {...}).`,
        ),
      );
    },
    storage: stocare,
    auth: auth(""),
  };

  return {
    /**
     * Clientul propriu-zis. Tipat `never` ca să poată fi pasat oriunde se
     * cere un `ServerSupabase` / `AdminSupabase` fără `as` la fiecare apel.
     */
    client: client as never,
    apeluri,
    apeluriRpc,
    apeluriStocare,
    apeluriAuth,

    /**
     * Programează răspunsul URMĂTORULUI apel pe tabelă. Cu `operatie`, se
     * potrivește doar pe ea (`"update"`, `"select"`...); fără, pe orice
     * operație. Răspunsurile se consumă în ordinea programării (FIFO).
     */
    raspunde(tabela: string, operatie: OperatieFalsa | undefined, rezultat: RezultatFals): void {
      pune(cozi, operatie === undefined ? tabela : `${tabela}:${operatie}`, rezultat);
    },
    raspundeRpc(nume: string, rezultat: RezultatFals): void {
      pune(coziRpc, nume, rezultat);
    },
    raspundeStocare(bucket: string, metoda: string, rezultat: RezultatFals): void {
      pune(coziStocare, `${bucket}:${metoda}`, rezultat);
    },
    /** `metoda` e numele metodei (`"getUser"`) sau, pentru admin, `"admin.inviteUserByEmail"`. */
    raspundeAuth(metoda: string, rezultat: RezultatFals): void {
      pune(coziAuth, metoda, rezultat);
    },

    /** Apelurile pe o tabelă, opțional doar cele cu o anumită operație. */
    apeluriPe(tabela: string, operatie?: OperatieFalsa): ApelFals[] {
      return apeluri.filter(
        (a) => a.tabela === tabela && (operatie === undefined || a.operatie === operatie),
      );
    },
    /** Rândurile de audit scrise prin `rpc("log_audit_event")`, în ordine. */
    audituri(): Record<string, unknown>[] {
      return apeluriRpc
        .filter((a) => a.nume === "log_audit_event")
        .map((a) => a.argumente as Record<string, unknown>);
    },
    /** Câte cozi programate au rămas neconsumate — util ca să prinzi un apel care NU s-a făcut. */
    neconsumate(): string[] {
      const ramase: string[] = [];
      for (const [harta, eticheta] of [
        [cozi, "from"],
        [coziRpc, "rpc"],
        [coziStocare, "storage"],
        [coziAuth, "auth"],
      ] as const) {
        for (const [cheie, coada] of harta) {
          if (coada.length > 0) ramase.push(`${eticheta} ${cheie} ×${coada.length}`);
        }
      }
      return ramase;
    },
  };
}

/**
 * Adevărat dacă apelul are filtrul `metoda(coloana, valoare?)`. Fără `valoare`,
 * verifică doar metoda și coloana. Comparația valorii e structurală
 * (`JSON.stringify`), ca `.in("status", ["a", "b"])` să se poată verifica.
 */
export function areFiltru(
  apel: ApelFals | undefined,
  metoda: string,
  coloana: string,
  ...valoare: [] | [unknown]
): boolean {
  if (apel === undefined) return false;
  return apel.filtre.some(
    (f) =>
      f.metoda === metoda &&
      f.argumente[0] === coloana &&
      (valoare.length === 0 || JSON.stringify(f.argumente[1]) === JSON.stringify(valoare[0])),
  );
}
