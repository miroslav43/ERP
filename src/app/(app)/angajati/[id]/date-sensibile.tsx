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
      className="border-warning/40 bg-surface rounded-panou shadow-ridicat border p-5"
    >
      <h2
        id="titlu-date-sensibile"
        className="text-sectiune mb-1 flex items-center gap-2 font-medium"
      >
        <ShieldAlert aria-hidden="true" className="text-foreground size-5" />
        Date de identificare
      </h2>
      <p className="text-muted-foreground text-corp mb-4">
        CNP-ul și IBAN-ul sunt păstrate criptat. Fiecare consultare este înregistrată în jurnalul de
        audit, împreună cu motivul pe care îl introduceți mai jos.
      </p>

      <dl className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-nota tracking-wide uppercase">CNP</dt>
          <dd className="text-corp mt-0.5 font-mono">
            {cnpUltimele4 === null ? "necompletat" : `•••••••••${cnpUltimele4}`}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-nota tracking-wide uppercase">IBAN</dt>
          <dd className="text-corp mt-0.5 font-mono">
            {ibanUltimele4 === null ? "necompletat" : `RO•• •••• •••• ${ibanUltimele4}`}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-nota tracking-wide uppercase">Bancă</dt>
          <dd className="text-corp mt-0.5">{banca ?? "—"}</dd>
        </div>
      </dl>

      <div className="max-w-md">
        <label htmlFor={idMotiv} className="text-corp block font-medium">
          Motivul consultării
        </label>
        <input
          id={idMotiv}
          value={motiv}
          onChange={(eveniment) => {
            setMotiv(eveniment.target.value);
          }}
          aria-describedby={`${idMotiv}-ajutor`}
          className="border-border bg-background rounded-control text-corp mt-1 w-full border px-3 py-2"
          placeholder="Ex. întocmire adeverință de venit"
        />
        <p id={`${idMotiv}-ajutor`} className="text-muted-foreground text-nota mt-1">
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
          className="border-border bg-background disabled:bg-surface disabled:text-muted-foreground rounded-control text-corp inline-flex items-center gap-2 border px-3 py-2 font-medium disabled:cursor-not-allowed"
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
          className="border-border bg-background disabled:bg-surface disabled:text-muted-foreground rounded-control text-corp inline-flex items-center gap-2 border px-3 py-2 font-medium disabled:cursor-not-allowed"
        >
          <Eye aria-hidden="true" className="size-4" />
          Dezvăluie IBAN
        </button>
      </div>

      <div aria-live="polite" className="text-corp mt-3 min-h-10">
        {inCurs ? <p>Se verifică dreptul de acces…</p> : null}
        {eroare !== null ? <p className="text-danger">{eroare}</p> : null}
        {dezvaluit !== null ? (
          <p className="text-sectiune font-mono">
            {dezvaluit.camp === "cnp" ? "CNP: " : "IBAN: "}
            {dezvaluit.valoare}
            <span className="text-muted-foreground text-nota ml-2 font-sans">
              (se ascunde automat după {String(SECUNDE_AFISARE)} de secunde)
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
