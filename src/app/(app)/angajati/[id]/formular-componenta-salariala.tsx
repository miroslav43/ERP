// src/app/(app)/angajati/[id]/formular-componenta-salariala.tsx
"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

import { asociazaComponenta } from "./componente-actions";

interface SablonOptiune {
  readonly id: string;
  readonly denumire: string;
  readonly kind: string;
}

interface Proprietati {
  readonly employeeId: string;
  readonly sabloane: readonly SablonOptiune[];
}

/** `kind`-ul componentei se derivă din șablonul ales — nu se alege liber, ca
 * să nu se poată trimite o combinație interzisă de constrângerea din bază
 * (spor_procent ⇒ procent obligatoriu, restul ⇒ sumă obligatorie). */
export function FormularComponentaSalariala({ employeeId, sabloane }: Proprietati) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [sablonAlesId, setSablonAlesId] = useState(sabloane[0]?.id ?? "");
  const idSablon = useId();
  const idProcent = useId();
  const idSuma = useId();
  const idValabilDeLa = useId();
  const idValabilPana = useId();
  const idObservatii = useId();

  const sablonAles = sabloane.find((s) => s.id === sablonAlesId) ?? null;
  const esteProcentual = sablonAles?.kind === "spor_procent";

  function trimite(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      if (sablonAles === null) {
        setEroare("Alegeți un șablon.");
        return;
      }
      const procent = String(fd.get("procent") ?? "");
      const suma = String(fd.get("suma") ?? "");
      const valabilPana = String(fd.get("valabil_pana") ?? "");
      const rezultat = await asociazaComponenta({
        employee_id: employeeId,
        component_type_id: sablonAles.id,
        kind: sablonAles.kind,
        procent: esteProcentual ? (procent === "" ? null : Number(procent)) : null,
        suma: esteProcentual ? null : suma === "" ? null : Number(suma),
        valabil_de_la: String(fd.get("valabil_de_la") ?? ""),
        valabil_pana: valabilPana === "" ? null : valabilPana,
        observatii: String(fd.get("observatii") ?? ""),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setDeschis(false);
      router.refresh();
    });
  }

  if (sabloane.length === 0) {
    return (
      <p className="text-muted-foreground text-corp">
        Niciun șablon de spor sau primă definit încă.{" "}
        <Link href="/salarizare/componente" className="text-primary underline underline-offset-2">
          Creați unul
        </Link>{" "}
        înainte de a-l putea asocia unui angajat.
      </p>
    );
  }

  if (!deschis) {
    return (
      <Buton
        varianta="secundar"
        className="mt-3"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Spor sau primă nouă
      </Buton>
    );
  }

  return (
    <form
      action={trimite}
      className="border-border rounded-control mt-3 grid gap-3 border p-3 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={idSablon} className="text-corp">
          Șablon
        </label>
        <select
          id={idSablon}
          name="component_type_id"
          value={sablonAlesId}
          onChange={(eveniment) => {
            setSablonAlesId(eveniment.target.value);
          }}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          {sabloane.map((sablon) => (
            <option key={sablon.id} value={sablon.id}>
              {sablon.denumire}
            </option>
          ))}
        </select>
      </div>
      {esteProcentual ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={idProcent} className="text-corp">
            Procent din salariul de bază (%)
          </label>
          <input
            id={idProcent}
            name="procent"
            type="number"
            step="0.01"
            min={0}
            max={300}
            required
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor={idSuma} className="text-corp">
            Sumă fixă (lei)
          </label>
          <input
            id={idSuma}
            name="suma"
            type="number"
            step="0.01"
            min={0}
            required
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor={idValabilDeLa} className="text-corp">
          Valabil de la
        </label>
        <input
          id={idValabilDeLa}
          name="valabil_de_la"
          type="date"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idValabilPana} className="text-corp">
          Valabil până la (opțional)
        </label>
        <input
          id={idValabilPana}
          name="valabil_pana"
          type="date"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={idObservatii} className="text-corp">
          Observații
        </label>
        <input
          id={idObservatii}
          name="observatii"
          type="text"
          maxLength={500}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          Adaugă
        </Buton>
        <Buton
          varianta="link"
          onClick={() => {
            setDeschis(false);
            setEroare(null);
          }}
        >
          Renunță
        </Buton>
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-corp sm:col-span-2">
          {eroare}
        </p>
      )}
    </form>
  );
}
