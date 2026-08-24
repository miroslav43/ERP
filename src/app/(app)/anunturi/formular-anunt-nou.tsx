"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

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
    <form className="border-border rounded-panou space-y-3 border p-4">
      <p className="text-corp font-medium">Anunț nou</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={idTitlu} className="text-corp">
          Titlu
        </label>
        <input
          id={idTitlu}
          name="titlu"
          required
          maxLength={200}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idContinut} className="text-corp">
          Conținut
        </label>
        <textarea
          id={idContinut}
          name="continut"
          required
          rows={4}
          maxLength={10000}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={idExpira} className="text-corp">
            Expiră la (opțional)
          </label>
          <input
            id={idExpira}
            name="expira_la"
            type="date"
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <label htmlFor={idFixat} className="text-corp flex items-center gap-2 pb-2">
          <input id={idFixat} type="checkbox" name="fixat" />
          Fixează în capul listei
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Buton
          varianta="primar"
          inCurs={inCurs}
          textInCurs="Se publică…"
          onClick={(e) => {
            trimite(new FormData(e.currentTarget.form ?? undefined), true);
          }}
        >
          Publică
        </Buton>
        <Buton
          varianta="secundar"
          disabled={inCurs}
          onClick={(e) => {
            trimite(new FormData(e.currentTarget.form ?? undefined), false);
          }}
        >
          Salvează ca ciornă
        </Buton>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp w-full">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
