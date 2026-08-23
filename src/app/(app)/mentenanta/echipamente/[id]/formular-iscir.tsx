"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
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
      className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <p className="text-corp font-medium sm:col-span-2 lg:col-span-3">Autorizație ISCIR nouă</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={idNumar} className="text-corp">
          Număr
        </label>
        <input
          id={idNumar}
          name="numar"
          required
          maxLength={80}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idTip} className="text-corp">
          Tip
        </label>
        <input
          id={idTip}
          name="tip"
          required
          maxLength={80}
          placeholder="Ex. macara, stivuitor, cazan"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idEmitent} className="text-corp">
          Emitent
        </label>
        <input
          id={idEmitent}
          name="emitent"
          defaultValue="ISCIR"
          maxLength={120}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idEmisLa} className="text-corp">
          Emisă la
        </label>
        <input
          id={idEmisLa}
          name="emis_la"
          type="date"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idValabilPana} className="text-corp">
          Valabilă până la
        </label>
        <input
          id={idValabilPana}
          name="valabil_pana"
          type="date"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idScadentaVerificare} className="text-corp">
          Scadența verificării tehnice
        </label>
        <input
          id={idScadentaVerificare}
          name="scadenta_verificare_tehnica"
          type="date"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
        <label htmlFor={idConditii} className="text-corp">
          Condiții
        </label>
        <textarea
          id={idConditii}
          name="conditii"
          rows={2}
          maxLength={1000}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          Salvează autorizația
        </Buton>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
