"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { salveazaZiPontaj } from "@/app/(app)/pontaj/actions";
import { Buton } from "@/components/ui/buton";

/**
 * Completarea unei singure zile de pontaj, pentru telefon.
 *
 * În aplicația mare, aceleași date se introduc într-o foaie colectivă cu o
 * coloană pe zi și un rând pe angajat — o formă care pe un ecran de telefon fie
 * se derulează orizontal, fie își strivește celulele. Aici e o zi, patru
 * câmpuri, un buton.
 *
 * Orele de noapte nu apar: se calculează din interval de către bază, iar un
 * câmp în plus pentru un caz rar mută costul asupra tuturor celorlalți.
 */

const CLASA_CAMP =
  "mt-1 min-h-11 w-full rounded-control border border-foreground/60 bg-background px-3 py-2 text-corp";

export function FormularZi({
  data,
  oreInitiale,
  suplimentareInitiale,
  observatiiInitiale,
}: {
  readonly data: string;
  readonly oreInitiale: string;
  readonly suplimentareInitiale: string;
  readonly observatiiInitiale: string;
}) {
  const router = useRouter();
  const [ore, setOre] = useState(oreInitiale);
  const [suplimentare, setSuplimentare] = useState(suplimentareInitiale);
  const [observatii, setObservatii] = useState(observatiiInitiale);
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const idOre = useId();
  const idSuplimentare = useId();
  const idObservatii = useId();

  function salveaza(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await salveazaZiPontaj({
        // `null` = pentru mine. Acțiunea rezolvă fișa pe server: un identificator
        // venit din formular ar putea fi al altcuiva.
        employee_id: null,
        data,
        ora_inceput: null,
        ora_sfarsit: null,
        ore_lucrate: ore,
        ore_suplimentare: suplimentare,
        ore_noapte: 0,
        tip_zi: null,
        observatii: observatii.length === 0 ? null : observatii,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push("/portal/pontajul-meu");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(eveniment) => {
        eveniment.preventDefault();
      }}
      className="space-y-4"
      noValidate
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={idOre} className="text-foreground text-corp font-medium">
            Ore lucrate
          </label>
          <input
            id={idOre}
            type="number"
            inputMode="decimal"
            min={0}
            max={24}
            step={0.5}
            value={ore}
            onChange={(e) => {
              setOre(e.target.value);
            }}
            className={CLASA_CAMP}
          />
        </div>
        <div>
          <label htmlFor={idSuplimentare} className="text-foreground text-corp font-medium">
            Din care suplimentare
          </label>
          <input
            id={idSuplimentare}
            type="number"
            inputMode="decimal"
            min={0}
            max={24}
            step={0.5}
            value={suplimentare}
            onChange={(e) => {
              setSuplimentare(e.target.value);
            }}
            className={CLASA_CAMP}
          />
        </div>
      </div>

      <div>
        <label htmlFor={idObservatii} className="text-foreground text-corp font-medium">
          Observații <span className="text-muted-foreground font-normal">(opțional)</span>
        </label>
        <textarea
          id={idObservatii}
          value={observatii}
          rows={2}
          maxLength={1000}
          onChange={(e) => {
            setObservatii(e.target.value);
          }}
          className={`${CLASA_CAMP} min-h-20`}
        />
      </div>

      {eroare === null ? null : (
        <p
          role="alert"
          aria-live="assertive"
          className="border-danger/40 bg-danger/10 text-foreground rounded-control text-corp border p-3"
        >
          {eroare}
        </p>
      )}

      <Buton
        varianta="primar"
        className="w-full"
        inCurs={inCurs}
        textInCurs="Se salvează…"
        onClick={salveaza}
      >
        Salvează ziua
      </Buton>
    </form>
  );
}
