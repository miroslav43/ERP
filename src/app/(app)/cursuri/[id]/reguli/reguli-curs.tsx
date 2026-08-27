"use client";

// src/app/(app)/cursuri/[id]/reguli/reguli-curs.tsx
//
// Un criteriu pe regulă, ales dintr-o listă scurtă. Nu un motor de reguli cu
// operatori și paranteze: combinațiile se fac adăugând reguli, iar cinci ramuri
// disjuncte se verifică dintr-o privire — un `and`/`or` compus, nu.

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Workflow } from "lucide-react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { StareGoala } from "@/components/ui/stare-goala";
import { clasaControl } from "@/components/ui/camp";
import { arataToast } from "@/components/ui/toast";
import type { AngajatOptiune, OptiuneDenumita, RandRegula } from "@/lib/queries/cursuri";
import type { CursCriteriu } from "@/schemas/cursuri";
import { CURS_CRITERIU } from "@/schemas/cursuri";

import { aplicaRegulile, creeazaRegula, stergeRegula } from "../../actions";

const ETICHETE_CRITERIU: Readonly<Record<CursCriteriu, string>> = {
  toti: "Toți angajații",
  departament: "Un departament",
  functie: "O funcție",
  rol: "Un rol în aplicație",
  angajat: "O persoană anume",
};

const ROLURI = ["org_admin", "manager", "hr", "employee"] as const;
const ETICHETE_ROL: Readonly<Record<string, string>> = {
  org_admin: "Administrator organizație",
  manager: "Manager",
  hr: "Resurse umane",
  employee: "Angajat",
};

interface Proprietati {
  readonly cursId: string;
  readonly denumire: string;
  readonly reguli: readonly RandRegula[];
  readonly departamente: readonly OptiuneDenumita[];
  readonly functii: readonly OptiuneDenumita[];
  readonly angajati: readonly AngajatOptiune[];
  readonly poateEdita: boolean;
}

export function ReguliCurs({
  cursId,
  denumire,
  reguli,
  departamente,
  functii,
  angajati,
  poateEdita,
}: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [criteriu, setCriteriu] = useState<CursCriteriu>("toti");
  const [tinta, setTinta] = useState("");
  const [decalaj, setDecalaj] = useState("0");
  const [eroare, setEroare] = useState<string | null>(null);
  const [confirmaAplicarea, setConfirmaAplicarea] = useState(false);

  const numeTinta = useCallback(
    (regula: RandRegula): string => {
      switch (regula.criteriu) {
        case "toti":
          return "toți angajații";
        case "departament":
          return departamente.find((d) => d.id === regula.department_id)?.denumire ?? "—";
        case "functie":
          return functii.find((f) => f.id === regula.job_position_id)?.denumire ?? "—";
        case "rol":
          return ETICHETE_ROL[regula.rol ?? ""] ?? regula.rol ?? "—";
        case "angajat":
          return angajati.find((a) => a.id === regula.employee_id)?.nume ?? "—";
      }
    },
    [angajati, departamente, functii],
  );

  const ruleaza = useCallback(
    (operatie: () => Promise<{ ok: boolean; error?: { message: string } }>, reusita: string) => {
      setEroare(null);
      porneste(async () => {
        const rezultat = await operatie();
        if (!rezultat.ok) {
          setEroare(rezultat.error?.message ?? "Operațiunea nu a reușit.");
          return;
        }
        arataToast({ fel: "reusita", text: reusita });
        router.refresh();
      });
    },
    [router],
  );

  const adauga = useCallback((): void => {
    ruleaza(
      () =>
        creeazaRegula({
          course_id: cursId,
          criteriu,
          department_id: criteriu === "departament" ? tinta : null,
          job_position_id: criteriu === "functie" ? tinta : null,
          rol: criteriu === "rol" ? tinta : null,
          employee_id: criteriu === "angajat" ? tinta : null,
          decalaj_zile: decalaj,
          termen_zile: null,
        }),
      "Regula a fost adăugată.",
    );
    setTinta("");
  }, [criteriu, cursId, decalaj, ruleaza, tinta]);

  const optiuniTinta =
    criteriu === "departament"
      ? departamente.map((d) => ({ id: d.id, text: d.denumire }))
      : criteriu === "functie"
        ? functii.map((f) => ({ id: f.id, text: f.denumire }))
        : criteriu === "angajat"
          ? angajati.map((a) => ({ id: a.id, text: a.nume }))
          : criteriu === "rol"
            ? ROLURI.map((r) => ({ id: r, text: ETICHETE_ROL[r] ?? r }))
            : [];

  return (
    <div className="space-y-4">
      {eroare === null ? null : (
        <Callout fel="eroare" titlu="Regula nu s-a aplicat">
          {eroare}
        </Callout>
      )}

      <Callout fel="informativ" titlu="Când se aplică">
        Regulile rulează automat în fiecare noapte și prind și angajații care apar între timp — de
        asta există: un om nou primește instructajul fără să și-l amintească nimeni. Cine are deja
        cursul nu se re-înrolează.
      </Callout>

      {reguli.length === 0 ? (
        <StareGoala
          fel="initiala"
          compact
          pictograma={Workflow}
          titlu="Nicio regulă"
          descriere="Fără reguli, cursul se atribuie doar manual."
        />
      ) : (
        <ul className="divide-border border-border rounded-panou divide-y border">
          {reguli.map((regula) => (
            <li key={regula.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {ETICHETE_CRITERIU[regula.criteriu]}
                  {regula.criteriu === "toti" ? "" : `: ${numeTinta(regula)}`}
                </p>
                <p className="text-muted-foreground text-nota">
                  {regula.decalaj_zile === 0
                    ? "Se atribuie imediat."
                    : `Se atribuie la ${String(regula.decalaj_zile)} zile de la angajare.`}
                </p>
              </div>
              {poateEdita ? (
                <Buton
                  varianta="tertiar"
                  marime="iconita"
                  aria-label={`Șterge regula „${ETICHETE_CRITERIU[regula.criteriu]}”`}
                  disabled={inCurs}
                  onClick={() => {
                    ruleaza(() => stergeRegula({ id: regula.id }), "Regula a fost ștearsă.");
                  }}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Buton>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {poateEdita ? (
        <section
          aria-labelledby="titlu-regula-noua"
          className="border-border rounded-panou space-y-3 border p-4"
        >
          <h2 id="titlu-regula-noua" className="text-sectiune font-medium">
            Regulă nouă
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-eticheta text-muted-foreground uppercase">Cine</span>
              <select
                value={criteriu}
                className={clasaControl()}
                onChange={(e) => {
                  setCriteriu(e.target.value as CursCriteriu);
                  // Ținta se golește la schimbarea criteriului: altfel ar pleca
                  // la server un departament pe o regulă de funcție, iar
                  // CHECK-ul disjunct ar respinge-o cu 23514.
                  setTinta("");
                }}
              >
                {CURS_CRITERIU.map((c) => (
                  <option key={c} value={c}>
                    {ETICHETE_CRITERIU[c]}
                  </option>
                ))}
              </select>
            </label>

            {criteriu === "toti" ? null : (
              <label className="flex flex-col gap-1">
                <span className="text-eticheta text-muted-foreground uppercase">Care</span>
                <select
                  value={tinta}
                  className={clasaControl()}
                  onChange={(e) => {
                    setTinta(e.target.value);
                  }}
                >
                  <option value="">— alegeți —</option>
                  {optiuniTinta.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.text}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-eticheta text-muted-foreground uppercase">
                Decalaj de la angajare (zile)
              </span>
              <input
                type="number"
                min={0}
                max={365}
                value={decalaj}
                className={clasaControl()}
                onChange={(e) => {
                  setDecalaj(e.target.value);
                }}
              />
            </label>
          </div>

          <BaraActiuni eticheta="Reguli de atribuire">
            <Buton
              varianta="secundar"
              disabled={inCurs || (criteriu !== "toti" && tinta === "")}
              onClick={adauga}
            >
              Adaugă regula
            </Buton>
            <Buton
              varianta="primar"
              disabled={inCurs || reguli.length === 0}
              onClick={() => {
                setConfirmaAplicarea(true);
              }}
            >
              Aplică acum
            </Buton>
          </BaraActiuni>
        </section>
      ) : null}

      <ConfirmareActiune
        deschis={confirmaAplicarea}
        laInchidere={() => {
          setConfirmaAplicarea(false);
        }}
        titlu={`Aplicați regulile pentru „${denumire}”?`}
        consecinta="Fiecare persoană care se potrivește și nu are deja cursul primește o înrolare și o notificare. Cine îl are deja e sărit."
        cifre={[{ eticheta: "Reguli active", valoare: String(reguli.length) }]}
        etichetaConfirmare="Aplică"
        inCurs={inCurs}
        laConfirmare={() => {
          setConfirmaAplicarea(false);
          ruleaza(() => aplicaRegulile({ course_id: cursId }), "Regulile au fost aplicate.");
        }}
      />
    </div>
  );
}
