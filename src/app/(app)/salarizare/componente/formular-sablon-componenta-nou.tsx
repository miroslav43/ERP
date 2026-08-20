// src/app/(app)/salarizare/componente/formular-sablon-componenta-nou.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { TIPURI_COMPONENTA_SALARIALA } from "@/schemas/salary-component";
import { creeazaSablonComponenta } from "./actions";

const ETICHETE_TIP: Record<(typeof TIPURI_COMPONENTA_SALARIALA)[number], string> = {
  spor_procent: "Spor procentual (% din salariul de bază)",
  spor_suma: "Spor — sumă fixă lunară",
  indemnizatie: "Indemnizație",
  prima_recurenta: "Primă recurentă",
  beneficiu_natura: "Beneficiu în natură",
};

export function FormularSablonComponentaNou() {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idCod = useId();
  const idDenumire = useId();
  const idKind = useId();
  const idCodRevisal = useId();

  function trimite(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await creeazaSablonComponenta({
        cod: String(fd.get("cod") ?? ""),
        denumire: String(fd.get("denumire") ?? ""),
        kind: String(fd.get("kind") ?? "spor_procent"),
        impozabil: fd.get("impozabil") === "on",
        intra_in_baza_cas: fd.get("intra_in_baza_cas") === "on",
        intra_in_baza_cass: fd.get("intra_in_baza_cass") === "on",
        cod_revisal: String(fd.get("cod_revisal") ?? ""),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setDeschis(false);
      router.refresh();
    });
  }

  if (!deschis) {
    return (
      <button
        type="button"
        onClick={() => {
          setDeschis(true);
        }}
        className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium"
      >
        Șablon nou
      </button>
    );
  }

  return (
    <form
      action={trimite}
      className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idCod} className="text-sm font-medium">
          Cod intern *
        </label>
        <input
          id={idCod}
          name="cod"
          type="text"
          required
          maxLength={40}
          placeholder="spor_vechime"
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idDenumire} className="text-sm font-medium">
          Denumire *
        </label>
        <input
          id={idDenumire}
          name="denumire"
          type="text"
          required
          maxLength={160}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={idKind} className="text-sm font-medium">
          Tip *
        </label>
        <select
          id={idKind}
          name="kind"
          required
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        >
          {TIPURI_COMPONENTA_SALARIALA.map((tip) => (
            <option key={tip} value={tip}>
              {ETICHETE_TIP[tip]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idCodRevisal} className="text-sm font-medium">
          Cod REVISAL
        </label>
        <input
          id={idCodRevisal}
          name="cod_revisal"
          type="text"
          maxLength={40}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <div className="flex items-center gap-2">
          <input
            id="impozabil"
            name="impozabil"
            type="checkbox"
            defaultChecked
            className="border-border size-4 rounded"
          />
          <label htmlFor="impozabil" className="text-sm">
            Impozabil
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="intra_in_baza_cas"
            name="intra_in_baza_cas"
            type="checkbox"
            defaultChecked
            className="border-border size-4 rounded"
          />
          <label htmlFor="intra_in_baza_cas" className="text-sm">
            Intră în baza CAS
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="intra_in_baza_cass"
            name="intra_in_baza_cass"
            type="checkbox"
            defaultChecked
            className="border-border size-4 rounded"
          />
          <label htmlFor="intra_in_baza_cass" className="text-sm">
            Intră în baza CASS
          </label>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se creează…" : "Creează șablonul"}
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
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-sm">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
