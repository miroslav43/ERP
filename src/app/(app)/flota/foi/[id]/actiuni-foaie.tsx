"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { StatusFoaie } from "@/schemas/fleet";

import { adaugaAlimentare, trimiteFoaie } from "../../actions";

/**
 * Închiderea cursei și alimentările.
 *
 * O foaie aprobată nu se mai atinge: triggerul o refuză, cu mesaj în română.
 * Ascundem formularele ca omul să nu apese degeaba, dar regula rămâne în bază —
 * ascunderea nu e barieră.
 */
export function ActiuniFoaie({
  id,
  status,
  kmPlecare,
  plecareLa,
  sosireLa,
}: {
  readonly id: string;
  readonly status: StatusFoaie;
  readonly kmPlecare: number;
  readonly plecareLa: string;
  readonly sosireLa: string | null;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [avertisment, setAvertisment] = useState<string | null>(null);

  const idSosire = useId();
  const idKm = useId();
  const idLitri = useId();
  const idCost = useId();
  const idStatie = useId();
  const idCand = useId();

  const sePoateModifica = status === "draft" || status === "respins";

  function inchide(formular: FormData): void {
    setEroare(null);
    setAvertisment(null);
    porneste(async () => {
      const rezultat = await trimiteFoaie({
        id,
        sosire_la: String(formular.get("sosire_la") ?? ""),
        km_sosire: Number(formular.get("km_sosire") ?? 0),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      // Saltul de kilometraj nu e o eroare — foaia s-a salvat. E o observație pe
      // care cineva trebuie să o explice, din ecranul de anomalii.
      setAvertisment(rezultat.data.anomalie);
      router.refresh();
    });
  }

  function alimenteaza(formular: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await adaugaAlimentare({
        trip_sheet_id: id,
        litri: Number(formular.get("litri") ?? 0),
        cost: Number(formular.get("cost") ?? 0),
        statie: String(formular.get("statie") ?? "").trim() || null,
        numar_bon: null,
        alimentat_la: String(formular.get("alimentat_la") ?? ""),
        plin: false,
        observatii: null,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section aria-label="Acțiuni" className="space-y-4">
      {eroare === null ? null : (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {eroare}
        </p>
      )}
      {avertisment === null ? null : (
        <p
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {avertisment}
        </p>
      )}

      {sePoateModifica ? (
        <form
          action={inchide}
          className="grid gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-3 dark:border-zinc-800"
        >
          <p className="text-sm font-medium sm:col-span-3">Închide cursa și trimite spre aprobare</p>
          <div className="flex flex-col gap-1">
            <label htmlFor={idSosire} className="text-sm">
              Sosire
            </label>
            <input
              id={idSosire}
              name="sosire_la"
              type="datetime-local"
              required
              min={plecareLa.slice(0, 16)}
              defaultValue={sosireLa?.slice(0, 16)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idKm} className="text-sm">
              Kilometraj la sosire
            </label>
            <input
              id={idKm}
              name="km_sosire"
              type="number"
              min={kmPlecare}
              required
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={inCurs}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {inCurs ? "Se trimite…" : "Trimite spre aprobare"}
            </button>
          </div>
        </form>
      ) : null}

      {status === "aprobat" ? null : (
        <form
          action={alimenteaza}
          className="grid gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-4 dark:border-zinc-800"
        >
          <p className="text-sm font-medium sm:col-span-4">Adaugă o alimentare</p>
          <div className="flex flex-col gap-1">
            <label htmlFor={idCand} className="text-sm">
              Când
            </label>
            <input
              id={idCand}
              name="alimentat_la"
              type="datetime-local"
              required
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idLitri} className="text-sm">
              Litri
            </label>
            <input
              id={idLitri}
              name="litri"
              type="number"
              min="0.01"
              step="0.01"
              required
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
              required
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idStatie} className="text-sm">
              Stație
            </label>
            <input
              id={idStatie}
              name="statie"
              maxLength={120}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="sm:col-span-4">
            <button
              type="submit"
              disabled={inCurs}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {inCurs ? "Se salvează…" : "Adaugă alimentarea"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
