"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Buton } from "@/components/ui/buton";
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

const CLASA_CAMP = "mt-1 w-full rounded-control border border-foreground/60 px-3 py-2 text-corp";

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
            <label htmlFor="edit-denumire" className="text-corp block font-medium">
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
            <label htmlFor="edit-numar" className="text-corp block font-medium">
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
            <label htmlFor="edit-serie" className="text-corp block font-medium">
              Serie
            </label>
            <input id="edit-serie" type="text" className={CLASA_CAMP} {...register("serie")} />
          </div>
          <div>
            <label htmlFor="edit-model" className="text-corp block font-medium">
              Model
            </label>
            <input id="edit-model" type="text" className={CLASA_CAMP} {...register("model")} />
          </div>
          <div>
            <label htmlFor="edit-producator" className="text-corp block font-medium">
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
            <label htmlFor="edit-categorie" className="text-corp block font-medium">
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
            <label htmlFor="edit-data-achizitie" className="text-corp block font-medium">
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
            <label htmlFor="edit-valoare" className="text-corp block font-medium">
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
            <label htmlFor="edit-garantie" className="text-corp block font-medium">
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
            <label htmlFor="edit-stare" className="text-corp block font-medium">
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
            <label htmlFor="edit-locatie" className="text-corp block font-medium">
              Locație
            </label>
            <input id="edit-locatie" type="text" className={CLASA_CAMP} {...register("locatie")} />
          </div>
        </div>

        <div>
          <label htmlFor="edit-observatii" className="text-corp block font-medium">
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
            <p className="border-danger bg-danger/8 text-danger rounded-control text-corp border p-3">
              {eroare}
            </p>
          ) : null}
        </div>

        <div className="flex gap-3">
          <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
            Salvează modificările
          </Buton>
          <Buton
            varianta="secundar"
            onClick={() => {
              setModEditare(false);
            }}
            disabled={inCurs}
          >
            Renunță
          </Buton>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <div aria-live="polite">
        {eroare !== null ? (
          <p className="border-danger bg-danger/8 text-danger rounded-control text-corp border p-3">
            {eroare}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Buton
          varianta="secundar"
          onClick={() => {
            setModEditare(true);
          }}
        >
          Editează datele obiectului
        </Buton>
        {poateCasa && !confirmaCasare ? (
          <Buton
            varianta="distructiv"
            onClick={() => {
              setConfirmaCasare(true);
            }}
          >
            Casează obiectul
          </Buton>
        ) : null}
      </div>

      {confirmaCasare ? (
        <div className="border-danger bg-danger/8 rounded-control border p-4">
          <p className="text-danger text-corp">
            Obiectul trece definitiv în starea „Casat” și nu mai poate fi predat unui angajat.
            Rămâne în evidența organizației permanent — istoricul de predări-primiri nu se poate
            șterge.
          </p>
          <div className="mt-3 flex gap-3">
            <Buton varianta="distructiv" onClick={caseaza} inCurs={inCurs} textInCurs="Se casează…">
              Confirmă casarea
            </Buton>
            <Buton
              varianta="secundar"
              onClick={() => {
                setConfirmaCasare(false);
              }}
              disabled={inCurs}
            >
              Renunță
            </Buton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
