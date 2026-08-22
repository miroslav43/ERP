"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { adaugaDocument } from "../actions";

interface TipDocument {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly cere_expirare: boolean;
}

/**
 * Adăugarea ȘI reînnoirea unui document — același formular, aceeași acțiune.
 *
 * Reînnoirea nu are ecran separat fiindcă nu e o operațiune separată: se
 * introduce polița nouă, iar baza decide care e cea curentă, după `expira_la`
 * maxim. Polița veche rămâne în istoric. Un buton „Reînnoiește" ar sugera că
 * cea veche dispare — și ar fi greșit.
 */
export function FormularDocument({
  vehiculId,
  tipuri,
}: {
  readonly vehiculId: string;
  readonly tipuri: readonly TipDocument[];
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [reusit, setReusit] = useState(false);
  const idTip = useId();
  const idNumar = useId();
  const idEmitent = useId();
  const idDeLa = useId();
  const idExpira = useId();
  const idCost = useId();

  function trimite(formular: FormData): void {
    setEroare(null);
    setReusit(false);
    const gol = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };
    const cost = gol("cost");

    porneste(async () => {
      const rezultat = await adaugaDocument({
        vehicle_id: vehiculId,
        document_type_id: String(formular.get("document_type_id") ?? ""),
        numar: gol("numar"),
        emitent: gol("emitent"),
        valabil_de_la: gol("valabil_de_la"),
        expira_la: gol("expira_la"),
        cost: cost === null ? null : Number(cost),
        observatii: null,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setReusit(true);
      router.refresh();
    });
  }

  return (
    <form
      action={trimite}
      className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <p className="text-sm font-medium sm:col-span-2 lg:col-span-3">
        Adaugă sau reînnoiește un document
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor={idTip} className="text-sm">
          Tip document
        </label>
        <select
          id={idTip}
          name="document_type_id"
          required
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        >
          {tipuri.map((t) => (
            <option key={t.id} value={t.id}>
              {t.denumire}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idNumar} className="text-sm">
          Număr
        </label>
        <input
          id={idNumar}
          name="numar"
          maxLength={64}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idEmitent} className="text-sm">
          Emitent
        </label>
        <input
          id={idEmitent}
          name="emitent"
          maxLength={120}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idDeLa} className="text-sm">
          Valabil de la
        </label>
        <input
          id={idDeLa}
          name="valabil_de_la"
          type="date"
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idExpira} className="text-sm">
          Expiră la
        </label>
        <input
          id={idExpira}
          name="expira_la"
          type="date"
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idCost} className="text-sm">
          Cost (lei)
        </label>
        <input
          id={idCost}
          name="cost"
          type="number"
          min="0"
          step="0.01"
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se salvează…" : "Salvează documentul"}
        </button>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-sm">
            {eroare}
          </p>
        )}
        {reusit ? (
          <p role="status" className="text-foreground text-sm">
            Document salvat. Cel cu data de expirare cea mai îndepărtată devine documentul curent.
          </p>
        ) : null}
      </div>
    </form>
  );
}
