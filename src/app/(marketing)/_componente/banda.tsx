import type { ReactNode } from "react";

/**
 * Învelișul unei benzi de landing. Se folosește de nouăsprezece ori, și e
 * singurul loc unde se decid fundalul, ritmul vertical și grila.
 *
 * Ritmul paginii NU e purtat de alternanța de fundal — cerneala apare în exact
 * patru locuri, și în fiecare înseamnă același lucru: ce nu se vede și ce nu
 * există. Contra-ritmul îl poartă densitatea: registru, expunere, demonstrație.
 */
type Fundal = "hartie" | "cerneala";
type Inaltime = "scurta" | "medie" | "inalta";

const INALTIMI: Readonly<Record<Inaltime, string>> = {
  scurta: "py-10 sm:py-14",
  medie: "py-16 sm:py-24",
  inalta: "py-20 sm:py-32",
};

export function Banda({
  id,
  fundal = "hartie",
  inaltime = "medie",
  supratitlu,
  titlu,
  lead,
  aliniereTitlu = "stanga",
  children,
}: {
  id?: string;
  fundal?: Fundal;
  inaltime?: Inaltime;
  supratitlu?: string;
  titlu?: string;
  lead?: string;
  aliniereTitlu?: "stanga" | "larg";
  children?: ReactNode;
}) {
  const cerneala = fundal === "cerneala";
  return (
    <section
      id={id}
      className={`scroll-mt-20 ${
        cerneala ? "mk-cerneala bg-mk-cerneala text-mk-text-inv" : "bg-mk-hartie text-mk-text"
      }`}
    >
      <div className="max-w-mk mx-auto w-full px-[clamp(1rem,4vw,2.5rem)]">
        {/* Granița dintre benzi e o riglă care se oprește la marginea grilei,
            ca liniile unui tabel — nu o dungă pe toată lățimea ecranului. */}
        <div
          className={`border-t ${cerneala ? "border-mk-rigla-inv" : "border-mk-rigla"} ${INALTIMI[inaltime]}`}
        >
          {(supratitlu !== undefined || titlu !== undefined) && (
            <header className={aliniereTitlu === "larg" ? "max-w-[28ch]" : "max-w-[46ch]"}>
              {supratitlu !== undefined && (
                <p
                  className={`font-mk-date text-[0.6875rem] font-medium tracking-[0.14em] uppercase ${
                    cerneala ? "text-mk-text-inv-slab" : "text-mk-text-slab"
                  }`}
                >
                  {supratitlu}
                </p>
              )}
              {titlu !== undefined && (
                <h2 className="font-mk-display mt-3 text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.04] font-semibold tracking-[-0.015em] text-balance">
                  {titlu}
                </h2>
              )}
            </header>
          )}
          {lead !== undefined && (
            <p
              className={`mt-5 max-w-[62ch] text-[1.0625rem] leading-[1.6] text-pretty ${
                cerneala ? "text-mk-text-inv-slab" : "text-mk-text-slab"
              }`}
            >
              {lead}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

/** Eticheta mono de 11px, folosită pentru coduri, actori și stări. */
export function EticheteMono({
  children,
  ton = "slab",
}: {
  children: ReactNode;
  ton?: "slab" | "tare";
}) {
  return (
    <span
      className={`font-mk-date text-[0.6875rem] font-medium tracking-[0.14em] uppercase ${
        ton === "slab" ? "text-mk-text-slab" : ""
      }`}
    >
      {children}
    </span>
  );
}
