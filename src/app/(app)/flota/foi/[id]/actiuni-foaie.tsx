"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
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
          className="border-danger/40 bg-danger/8 text-danger rounded-panou text-corp border p-3"
        >
          {eroare}
        </p>
      )}
      {avertisment === null ? null : (
        <p
          role="status"
          className="border-warning/40 bg-warning/12 text-foreground rounded-panou text-corp border p-3"
        >
          {avertisment}
        </p>
      )}

      {sePoateModifica ? (
        <form
          action={inchide}
          className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-3"
        >
          <p className="text-corp font-medium sm:col-span-3">
            Închide cursa și trimite spre aprobare
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor={idSosire} className="text-corp">
              Sosire
            </label>
            <input
              id={idSosire}
              name="sosire_la"
              type="datetime-local"
              required
              min={plecareLa.slice(0, 16)}
              defaultValue={sosireLa?.slice(0, 16)}
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idKm} className="text-corp">
              Kilometraj la sosire
            </label>
            <input
              id={idKm}
              name="km_sosire"
              type="number"
              min={kmPlecare}
              required
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se trimite…">
              Trimite spre aprobare
            </Buton>
          </div>
        </form>
      ) : null}

      {status === "aprobat" ? null : (
        <form
          action={alimenteaza}
          className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-4"
        >
          <p className="text-corp font-medium sm:col-span-4">Adaugă o alimentare</p>
          <div className="flex flex-col gap-1">
            <label htmlFor={idCand} className="text-corp">
              Când
            </label>
            <input
              id={idCand}
              name="alimentat_la"
              type="datetime-local"
              required
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idLitri} className="text-corp">
              Litri
            </label>
            <input
              id={idLitri}
              name="litri"
              type="number"
              min="0.01"
              step="0.01"
              required
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idCost} className="text-corp">
              Cost (lei)
            </label>
            <input
              id={idCost}
              name="cost"
              type="number"
              min="0"
              step="0.01"
              required
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idStatie} className="text-corp">
              Stație
            </label>
            <input
              id={idStatie}
              name="statie"
              maxLength={120}
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="sm:col-span-4">
            <Buton type="submit" varianta="secundar" inCurs={inCurs} textInCurs="Se salvează…">
              Adaugă alimentarea
            </Buton>
          </div>
        </form>
      )}
    </section>
  );
}
