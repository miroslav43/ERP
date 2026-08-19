// src/app/(app)/angajati/[id]/date-sensibile.tsx
"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Eye, ShieldAlert } from "lucide-react";

import { dezvaluieDateSensibile } from "../actions";

const SECUNDE_AFISARE = 45;

interface Proprietati {
  readonly employeeId: string;
  readonly cnpUltimele4: string | null;
  readonly ibanUltimele4: string | null;
  readonly banca: string | null;
}

interface RezultatDezvaluire {
  readonly valoare: string;
}

function esteRezultatDezvaluire(valoare: unknown): valoare is RezultatDezvaluire {
  return (
    typeof valoare === "object" &&
    valoare !== null &&
    "valoare" in valoare &&
    typeof (valoare as { valoare: unknown }).valoare === "string"
  );
}

export function DateSensibile({ employeeId, cnpUltimele4, ibanUltimele4, banca }: Proprietati) {
  const [motiv, setMotiv] = useState("");
  const [dezvaluit, setDezvaluit] = useState<{ camp: "cnp" | "iban"; valoare: string } | null>(
    null,
  );
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();
  const idMotiv = useId();

  useEffect(() => {
    if (dezvaluit === null) return;
    const ceas = setTimeout(() => {
      setDezvaluit(null);
    }, SECUNDE_AFISARE * 1000);
    return () => {
      clearTimeout(ceas);
    };
  }, [dezvaluit]);

  function cere(camp: "cnp" | "iban"): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await dezvaluieDateSensibile({ employee_id: employeeId, camp, motiv });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        setDezvaluit(null);
        return;
      }
      if (!esteRezultatDezvaluire(rezultat.data)) {
        setEroare("Răspuns neașteptat de la server.");
        setDezvaluit(null);
        return;
      }
      setDezvaluit({ camp, valoare: rezultat.data.valoare });
    });
  }

  return (
    <section
      aria-labelledby="titlu-date-sensibile"
      className="rounded-lg border border-warning/40 bg-surface p-5 shadow-sm"
    >
      <h2 id="titlu-date-sensibile" className="mb-1 flex items-center gap-2 text-lg font-medium">
        <ShieldAlert aria-hidden="true" className="size-5 text-foreground" />
        Date de identificare
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        CNP-ul și IBAN-ul sunt păstrate criptat. Fiecare consultare este înregistrată în jurnalul de
        audit, împreună cu motivul pe care îl introduceți mai jos.
      </p>

      <dl className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">CNP</dt>
          <dd className="mt-0.5 font-mono text-sm">
            {cnpUltimele4 === null ? "necompletat" : `•••••••••${cnpUltimele4}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">IBAN</dt>
          <dd className="mt-0.5 font-mono text-sm">
            {ibanUltimele4 === null ? "necompletat" : `RO•• •••• •••• ${ibanUltimele4}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">Bancă</dt>
          <dd className="mt-0.5 text-sm">{banca ?? "—"}</dd>
        </div>
      </dl>

      <div className="max-w-md">
        <label htmlFor={idMotiv} className="block text-sm font-medium">
          Motivul consultării
        </label>
        <input
          id={idMotiv}
          value={motiv}
          onChange={(eveniment) => {
            setMotiv(eveniment.target.value);
          }}
          aria-describedby={`${idMotiv}-ajutor`}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Ex. întocmire adeverință de venit"
        />
        <p id={`${idMotiv}-ajutor`} className="mt-1 text-xs text-muted-foreground">
          Minimum 5 caractere. Motivul rămâne în jurnal.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            cere("cnp");
          }}
          disabled={inCurs || motiv.trim().length < 5 || cnpUltimele4 === null}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-foreground"
        >
          <Eye aria-hidden="true" className="size-4" />
          Dezvăluie CNP
        </button>
        <button
          type="button"
          onClick={() => {
            cere("iban");
          }}
          disabled={inCurs || motiv.trim().length < 5 || ibanUltimele4 === null}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-foreground"
        >
          <Eye aria-hidden="true" className="size-4" />
          Dezvăluie IBAN
        </button>
      </div>

      <div aria-live="polite" className="mt-3 min-h-10 text-sm">
        {inCurs ? <p>Se verifică dreptul de acces…</p> : null}
        {eroare !== null ? <p className="text-danger">{eroare}</p> : null}
        {dezvaluit !== null ? (
          <p className="font-mono text-base">
            {dezvaluit.camp === "cnp" ? "CNP: " : "IBAN: "}
            {dezvaluit.valoare}
            <span className="ml-2 font-sans text-xs text-muted-foreground">
              (se ascunde automat după {String(SECUNDE_AFISARE)} de secunde)
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
