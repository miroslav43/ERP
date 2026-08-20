// src/app/(app)/angajati/[id]/formular-evaluare-noua.tsx
"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { creeazaEvaluare } from "../../evaluari/actions";

interface Criteriu {
  readonly cod: string;
  readonly denumire: string;
  readonly scala_max: number;
}

interface Sablon {
  readonly id: string;
  readonly denumire: string;
  readonly criterii: readonly Criteriu[];
}

interface Proprietati {
  readonly employeeId: string;
  readonly sabloane: readonly Sablon[];
}

export function FormularEvaluareNoua({ employeeId, sabloane }: Proprietati) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [sablonId, setSablonId] = useState(sabloane[0]?.id ?? "");
  const [scoruri, setScoruri] = useState<Record<string, number>>({});
  const [comentarii, setComentarii] = useState<Record<string, string>>({});
  const idSablon = useId();
  const idData = useId();
  const idConcluzie = useId();
  const idStatus = useId();

  const sablonAles = sabloane.find((s) => s.id === sablonId) ?? null;

  function trimite(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      if (sablonAles === null) {
        setEroare("Alegeți un șablon.");
        return;
      }
      const rezultat = await creeazaEvaluare({
        employee_id: employeeId,
        template_id: sablonAles.id,
        data_evaluarii: String(fd.get("data_evaluarii") ?? ""),
        raspunsuri: sablonAles.criterii.map((criteriu) => ({
          criteriu_cod: criteriu.cod,
          scor: scoruri[criteriu.cod] ?? 0,
          comentariu:
            comentarii[criteriu.cod] === undefined || comentarii[criteriu.cod] === ""
              ? null
              : comentarii[criteriu.cod],
        })),
        concluzie: String(fd.get("concluzie") ?? ""),
        status: String(fd.get("status") ?? "finalizat"),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setDeschis(false);
      setScoruri({});
      setComentarii({});
      router.refresh();
    });
  }

  if (sabloane.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Niciun șablon de evaluare încă.{" "}
        <Link href="/evaluari/sabloane" className="text-primary underline underline-offset-2">
          Creați unul
        </Link>{" "}
        înainte de a evalua un angajat.
      </p>
    );
  }

  if (!deschis) {
    return (
      <button
        type="button"
        onClick={() => {
          setDeschis(true);
        }}
        className="border-foreground/60 hover:bg-surface mt-3 rounded-md border px-3 py-1.5 text-sm font-medium"
      >
        Evaluare nouă
      </button>
    );
  }

  return (
    <form action={trimite} className="border-border mt-3 grid gap-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={idSablon} className="text-sm">
            Șablon
          </label>
          <select
            id={idSablon}
            value={sablonId}
            onChange={(eveniment) => {
              setSablonId(eveniment.target.value);
              setScoruri({});
              setComentarii({});
            }}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          >
            {sabloane.map((sablon) => (
              <option key={sablon.id} value={sablon.id}>
                {sablon.denumire}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idData} className="text-sm">
            Data evaluării
          </label>
          <input
            id={idData}
            name="data_evaluarii"
            type="date"
            required
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {sablonAles !== null ? (
        <div className="border-border space-y-3 rounded-md border p-3">
          {sablonAles.criterii.map((criteriu) => (
            <div key={criteriu.cod} className="grid gap-2 sm:grid-cols-[1fr_auto_2fr] sm:items-center">
              <span className="text-sm font-medium">{criteriu.denumire}</span>
              <input
                type="number"
                min={0}
                max={criteriu.scala_max}
                value={scoruri[criteriu.cod] ?? 0}
                onChange={(eveniment) => {
                  setScoruri((precedente) => ({
                    ...precedente,
                    [criteriu.cod]: Number(eveniment.target.value),
                  }));
                }}
                aria-label={`Scor pentru ${criteriu.denumire} (0-${String(criteriu.scala_max)})`}
                className="border-foreground/60 w-20 rounded-md border px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="Comentariu (opțional)"
                value={comentarii[criteriu.cod] ?? ""}
                onChange={(eveniment) => {
                  setComentarii((precedente) => ({
                    ...precedente,
                    [criteriu.cod]: eveniment.target.value,
                  }));
                }}
                aria-label={`Comentariu pentru ${criteriu.denumire}`}
                className="border-foreground/60 rounded-md border px-2 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor={idConcluzie} className="text-sm">
          Concluzie generală
        </label>
        <textarea
          id={idConcluzie}
          name="concluzie"
          rows={3}
          maxLength={4000}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idStatus} className="text-sm">
          Stare
        </label>
        <select
          id={idStatus}
          name="status"
          defaultValue="finalizat"
          className="border-foreground/60 w-40 rounded-md border px-3 py-2 text-sm"
        >
          <option value="draft">Ciornă</option>
          <option value="finalizat">Finalizată</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se salvează…" : "Salvează evaluarea"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDeschis(false);
            setEroare(null);
          }}
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          Renunță
        </button>
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-sm">
          {eroare}
        </p>
      )}
    </form>
  );
}
