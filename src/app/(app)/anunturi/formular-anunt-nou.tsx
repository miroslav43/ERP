"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { creeazaAnunt } from "./actions";

export function FormularAnuntNou() {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idTitlu = useId();
  const idContinut = useId();
  const idExpira = useId();
  const idFixat = useId();

  function trimite(formular: FormData, publicaAcum: boolean): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await creeazaAnunt({
        titlu: String(formular.get("titlu") ?? ""),
        continut: String(formular.get("continut") ?? ""),
        fixat: formular.get("fixat") === "on",
        publica_acum: publicaAcum,
        expira_la: (() => {
          const v = String(formular.get("expira_la") ?? "").trim();
          return v.length === 0 ? null : new Date(`${v}T23:59:59`).toISOString();
        })(),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push(`/anunturi/${rezultat.data.id}`);
    });
  }

  return (
    <form className="border-border space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Anunț nou</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={idTitlu} className="text-sm">
          Titlu
        </label>
        <input
          id={idTitlu}
          name="titlu"
          required
          maxLength={200}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idContinut} className="text-sm">
          Conținut
        </label>
        <textarea
          id={idContinut}
          name="continut"
          required
          rows={4}
          maxLength={10000}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={idExpira} className="text-sm">
            Expiră la (opțional)
          </label>
          <input
            id={idExpira}
            name="expira_la"
            type="date"
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <label htmlFor={idFixat} className="flex items-center gap-2 pb-2 text-sm">
          <input id={idFixat} type="checkbox" name="fixat" />
          Fixează în capul listei
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={inCurs}
          onClick={(e) => {
            trimite(new FormData(e.currentTarget.form ?? undefined), true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se publică…" : "Publică"}
        </button>
        <button
          type="button"
          disabled={inCurs}
          onClick={(e) => {
            trimite(new FormData(e.currentTarget.form ?? undefined), false);
          }}
          className="border-foreground/60 hover:bg-surface rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          Salvează ca ciornă
        </button>
        {eroare === null ? null : (
          <p role="alert" className="text-danger w-full text-sm">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
