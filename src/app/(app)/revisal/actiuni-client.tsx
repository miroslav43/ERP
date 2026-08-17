// src/app/(app)/revisal/actiuni-client.tsx
"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { exportaEvenimente, marcheazaTransmis } from "./actions";

export function ActiuniEveniment(props: {
  readonly evenimentId: string;
  readonly numeAngajat: string;
  readonly azi: string;
}) {
  const router = useRouter();
  const idData = useId();
  const idNumar = useId();
  const [deschis, setDeschis] = useState(false);
  const [mesaj, setMesaj] = useState<{ tip: "eroare" | "succes"; text: string } | null>(null);
  const [inCurs, startTransition] = useTransition();

  function trimite(formular: FormData) {
    const transmisLa = String(formular.get("transmisLa") ?? "");
    const numarInregistrare = String(formular.get("numarInregistrare") ?? "");
    startTransition(async () => {
      const rezultat = await marcheazaTransmis({
        evenimentId: props.evenimentId,
        transmisLa,
        numarInregistrare,
      });
      if (rezultat.ok) {
        setMesaj({ tip: "succes", text: "Evenimentul a fost marcat ca transmis." });
        setDeschis(false);
        router.refresh();
      } else {
        setMesaj({ tip: "eroare", text: rezultat.error.message });
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setDeschis((valoare) => !valoare)}
        aria-expanded={deschis}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        Marchează transmis
      </button>

      {deschis ? (
        <form action={trimite} className="space-y-2 rounded-md bg-slate-50 p-3">
          <p className="text-xs text-slate-600">Transmitere pentru {props.numeAngajat}</p>
          <div>
            <label htmlFor={idData} className="block text-xs font-medium text-slate-700">
              Data transmiterii
            </label>
            <input
              id={idData}
              name="transmisLa"
              type="date"
              required
              max={props.azi}
              defaultValue={props.azi}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label htmlFor={idNumar} className="block text-xs font-medium text-slate-700">
              Număr de înregistrare ITM
            </label>
            <input
              id={idNumar}
              name="numarInregistrare"
              type="text"
              required
              maxLength={60}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={inCurs}
            className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {inCurs ? "Se salvează…" : "Confirmă transmiterea"}
          </button>
        </form>
      ) : null}

      <p
        aria-live="polite"
        className={`text-xs ${mesaj?.tip === "eroare" ? "text-red-700" : "text-emerald-700"}`}
      >
        {mesaj?.text ?? ""}
      </p>
    </div>
  );
}

export function ButonExport() {
  const [mesaj, setMesaj] = useState<string>("");
  const [inCurs, startTransition] = useTransition();

  function descarca() {
    startTransition(async () => {
      const rezultat = await exportaEvenimente({ doarNetransmise: true });
      if (!rezultat.ok) {
        setMesaj(rezultat.error.message);
        return;
      }
      const blocante = rezultat.data.probleme.filter((p) => p.blocant).length;
      const url = URL.createObjectURL(
        new Blob([rezultat.data.continut], { type: "text/csv;charset=utf-8" }),
      );
      const legatura = document.createElement("a");
      legatura.href = url;
      legatura.download = rezultat.data.numeFisier;
      legatura.click();
      URL.revokeObjectURL(url);
      setMesaj(
        `S-au exportat ${rezultat.data.totalIntrari} evenimente; ${rezultat.data.gataDeTransmis} sunt complete, ${blocante} au date lipsă.`,
      );
    });
  }

  return (
    <span className="ml-auto flex items-center gap-3">
      <button
        type="button"
        onClick={descarca}
        disabled={inCurs}
        className="rounded-md bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-300 disabled:opacity-60"
      >
        {inCurs ? "Se pregătește…" : "Descarcă listing (CSV)"}
      </button>
      <span aria-live="polite" className="text-xs text-slate-600">
        {mesaj}
      </span>
    </span>
  );
}
