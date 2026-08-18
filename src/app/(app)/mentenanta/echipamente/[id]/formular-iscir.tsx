"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { adaugaAutorizatieIscir } from "../../actions";

export function FormularIscir({ equipmentId }: { readonly equipmentId: string }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idNumar = useId();
  const idTip = useId();
  const idEmitent = useId();
  const idEmisLa = useId();
  const idValabilPana = useId();
  const idScadentaVerificare = useId();
  const idConditii = useId();

  function trimite(formular: FormData): void {
    setEroare(null);
    const gol = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };

    porneste(async () => {
      const rezultat = await adaugaAutorizatieIscir({
        equipment_id: equipmentId,
        numar: String(formular.get("numar") ?? ""),
        tip: String(formular.get("tip") ?? ""),
        emitent: gol("emitent") ?? "ISCIR",
        emis_la: gol("emis_la"),
        valabil_pana: String(formular.get("valabil_pana") ?? ""),
        scadenta_verificare_tehnica: gol("scadenta_verificare_tehnica"),
        conditii: gol("conditii"),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      action={trimite}
      className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <p className="text-sm font-medium sm:col-span-2 lg:col-span-3">Autorizație ISCIR nouă</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={idNumar} className="text-sm">
          Număr
        </label>
        <input
          id={idNumar}
          name="numar"
          required
          maxLength={80}
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idTip} className="text-sm">
          Tip
        </label>
        <input
          id={idTip}
          name="tip"
          required
          maxLength={80}
          placeholder="Ex. macara, stivuitor, cazan"
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idEmitent} className="text-sm">
          Emitent
        </label>
        <input
          id={idEmitent}
          name="emitent"
          defaultValue="ISCIR"
          maxLength={120}
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idEmisLa} className="text-sm">
          Emisă la
        </label>
        <input
          id={idEmisLa}
          name="emis_la"
          type="date"
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idValabilPana} className="text-sm">
          Valabilă până la
        </label>
        <input
          id={idValabilPana}
          name="valabil_pana"
          type="date"
          required
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idScadentaVerificare} className="text-sm">
          Scadența verificării tehnice
        </label>
        <input
          id={idScadentaVerificare}
          name="scadenta_verificare_tehnica"
          type="date"
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
        <label htmlFor={idConditii} className="text-sm">
          Condiții
        </label>
        <textarea
          id={idConditii}
          name="conditii"
          rows={2}
          maxLength={1000}
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={inCurs}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          {inCurs ? "Se salvează…" : "Salvează autorizația"}
        </button>
        {eroare === null ? null : (
          <p role="alert" className="text-sm text-danger">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
