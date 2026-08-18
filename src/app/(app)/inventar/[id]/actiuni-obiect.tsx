"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { STARI_OBIECT } from "@/schemas/inventory";
import { ETICHETE_STARE } from "../etichete";
import { actualizeazaObiect, caseazaObiect } from "../actions";

interface OptiuneCategorie {
  readonly id: string;
  readonly denumire: string;
}

interface ObiectEditabil {
  readonly id: string;
  readonly denumire: string;
  readonly numar_inventar: string;
  readonly serie: string | null;
  readonly model: string | null;
  readonly producator: string | null;
  readonly category_id: string | null;
  readonly data_achizitie: string | null;
  readonly valoare: number | null;
  readonly garantie_expira: string | null;
  readonly stare: string;
  readonly locatie: string | null;
  readonly observatii: string | null;
}

interface Proprietati {
  readonly obiect: ObiectEditabil;
  readonly categorii: readonly OptiuneCategorie[];
  /** Fals dacă obiectul e deja casat sau are o predare deschisă. */
  readonly poateCasa: boolean;
}

interface ValoriEditare {
  denumire: string;
  numar_inventar: string;
  serie: string;
  model: string;
  producator: string;
  category_id: string;
  data_achizitie: string;
  valoare: string;
  garantie_expira: string;
  stare: string;
  locatie: string;
  observatii: string;
}

const CLASA_CAMP =
  "mt-1 w-full rounded-md border border-foreground/60 px-3 py-2 text-sm";

function laText(valoare: string | null): string {
  return valoare ?? "";
}

export function ActiuniObiect({ obiect, categorii, poateCasa }: Proprietati) {
  const router = useRouter();
  const [modEditare, setModEditare] = useState(false);
  const [confirmaCasare, setConfirmaCasare] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<ValoriEditare>({
    defaultValues: {
      denumire: obiect.denumire,
      numar_inventar: obiect.numar_inventar,
      serie: laText(obiect.serie),
      model: laText(obiect.model),
      producator: laText(obiect.producator),
      category_id: obiect.category_id ?? "",
      data_achizitie: laText(obiect.data_achizitie),
      valoare: obiect.valoare === null ? "" : String(obiect.valoare),
      garantie_expira: laText(obiect.garantie_expira),
      stare: obiect.stare,
      locatie: laText(obiect.locatie),
      observatii: laText(obiect.observatii),
    },
  });

  function salveaza(valori: ValoriEditare): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await actualizeazaObiect({ id: obiect.id, ...valori });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setModEditare(false);
      router.refresh();
    });
  }

  function caseaza(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await caseazaObiect({ id: obiect.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        setConfirmaCasare(false);
        return;
      }
      setConfirmaCasare(false);
      router.refresh();
    });
  }

  if (modEditare) {
    return (
      <form onSubmit={handleSubmit(salveaza)} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="edit-denumire" className="block text-sm font-medium">
              Denumire
            </label>
            <input
              id="edit-denumire"
              type="text"
              className={CLASA_CAMP}
              {...register("denumire", { required: true })}
            />
          </div>
          <div>
            <label htmlFor="edit-numar" className="block text-sm font-medium">
              Număr de inventar
            </label>
            <input
              id="edit-numar"
              type="text"
              className={CLASA_CAMP}
              {...register("numar_inventar", { required: true })}
            />
          </div>
          <div>
            <label htmlFor="edit-serie" className="block text-sm font-medium">
              Serie
            </label>
            <input id="edit-serie" type="text" className={CLASA_CAMP} {...register("serie")} />
          </div>
          <div>
            <label htmlFor="edit-model" className="block text-sm font-medium">
              Model
            </label>
            <input id="edit-model" type="text" className={CLASA_CAMP} {...register("model")} />
          </div>
          <div>
            <label htmlFor="edit-producator" className="block text-sm font-medium">
              Producător
            </label>
            <input
              id="edit-producator"
              type="text"
              className={CLASA_CAMP}
              {...register("producator")}
            />
          </div>
          <div>
            <label htmlFor="edit-categorie" className="block text-sm font-medium">
              Categorie
            </label>
            <select id="edit-categorie" className={CLASA_CAMP} {...register("category_id")}>
              <option value="">Necategorizat</option>
              {categorii.map((optiune) => (
                <option key={optiune.id} value={optiune.id}>
                  {optiune.denumire}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-data-achizitie" className="block text-sm font-medium">
              Data achiziției
            </label>
            <input
              id="edit-data-achizitie"
              type="date"
              className={CLASA_CAMP}
              {...register("data_achizitie")}
            />
          </div>
          <div>
            <label htmlFor="edit-valoare" className="block text-sm font-medium">
              Valoare (lei)
            </label>
            <input
              id="edit-valoare"
              type="number"
              step="0.01"
              min="0"
              className={CLASA_CAMP}
              {...register("valoare")}
            />
          </div>
          <div>
            <label htmlFor="edit-garantie" className="block text-sm font-medium">
              Garanția expiră la
            </label>
            <input
              id="edit-garantie"
              type="date"
              className={CLASA_CAMP}
              {...register("garantie_expira")}
            />
          </div>
          <div>
            <label htmlFor="edit-stare" className="block text-sm font-medium">
              Stare fizică
            </label>
            <select id="edit-stare" className={CLASA_CAMP} {...register("stare")}>
              {STARI_OBIECT.map((valoare) => (
                <option key={valoare} value={valoare}>
                  {ETICHETE_STARE[valoare]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-locatie" className="block text-sm font-medium">
              Locație
            </label>
            <input
              id="edit-locatie"
              type="text"
              className={CLASA_CAMP}
              {...register("locatie")}
            />
          </div>
        </div>

        <div>
          <label htmlFor="edit-observatii" className="block text-sm font-medium">
            Observații
          </label>
          <textarea
            id="edit-observatii"
            rows={3}
            className={CLASA_CAMP}
            {...register("observatii")}
          />
        </div>

        <div aria-live="polite">
          {eroare !== null ? (
            <p className="rounded-md border border-danger bg-danger/8 p-3 text-sm text-danger">
              {eroare}
            </p>
          ) : null}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={inCurs}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
          >
            {inCurs ? "Se salvează…" : "Salvează modificările"}
          </button>
          <button
            type="button"
            onClick={() => {
              setModEditare(false);
            }}
            disabled={inCurs}
            className="rounded-md border border-foreground/60 px-4 py-2 text-sm font-medium hover:bg-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
          >
            Renunță
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <div aria-live="polite">
        {eroare !== null ? (
          <p className="rounded-md border border-danger bg-danger/8 p-3 text-sm text-danger">
            {eroare}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setModEditare(true);
          }}
          className="rounded-md border border-foreground/60 px-4 py-2 text-sm font-medium hover:bg-surface"
        >
          Editează datele obiectului
        </button>
        {poateCasa && !confirmaCasare ? (
          <button
            type="button"
            onClick={() => {
              setConfirmaCasare(true);
            }}
            className="rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-danger hover:text-danger-foreground"
          >
            Casează obiectul
          </button>
        ) : null}
      </div>

      {confirmaCasare ? (
        <div className="rounded-md border border-danger bg-danger/8 p-4">
          <p className="text-sm text-danger">
            Obiectul trece definitiv în starea „Casat” și nu mai poate fi predat unui angajat.
            Rămâne în evidența organizației permanent — istoricul de predări-primiri nu se poate
            șterge.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={caseaza}
              disabled={inCurs}
              className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-danger disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
            >
              {inCurs ? "Se casează…" : "Confirmă casarea"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmaCasare(false);
              }}
              disabled={inCurs}
              className="rounded-md border border-foreground/60 px-4 py-2 text-sm font-medium hover:bg-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
            >
              Renunță
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
