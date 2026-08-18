"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { inregistreazaInstruireBloc } from "../../actions";
import { ETICHETE_DOMENIU } from "../../etichete";

interface TipOptiune {
  readonly id: string;
  readonly denumire: string;
  readonly domeniu: "ssm" | "psi";
}

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/**
 * Înregistrare în bloc: un tip, o dată, N angajați — un singur `.insert([...])`
 * cu N rânduri (o instrucțiune ⇒ totul sau nimic).
 */
export function FormularInstruireBloc({
  tipuri,
  angajati,
}: {
  readonly tipuri: readonly TipOptiune[];
  readonly angajati: readonly AngajatOptiune[];
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [selectati, setSelectati] = useState<ReadonlySet<string>>(new Set());
  const [cauta, setCauta] = useState("");

  const id = {
    tip: useId(),
    data: useId(),
    durata: useId(),
    lectorAngajat: useId(),
    lectorExtern: useId(),
    tematica: useId(),
    materiale: useId(),
    punctaj: useId(),
    observatii: useId(),
    cauta: useId(),
  };

  const angajatiFiltrati = useMemo(() => {
    const text = cauta.trim().toLowerCase();
    if (text.length === 0) return angajati;
    return angajati.filter(
      (a) => (a.full_name ?? "").toLowerCase().includes(text) || a.marca.toLowerCase().includes(text),
    );
  }, [angajati, cauta]);

  function comuta(id: string): void {
    setSelectati((prev) => {
      const nou = new Set(prev);
      if (nou.has(id)) nou.delete(id);
      else nou.add(id);
      return nou;
    });
  }

  function selecteazaToti(): void {
    setSelectati(new Set(angajatiFiltrati.map((a) => a.id)));
  }

  function trimite(formular: FormData): void {
    setEroare(null);
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };
    const numar = (cheie: string) => {
      const v = text(cheie);
      return v === null ? null : Number(v);
    };

    if (selectati.size === 0) {
      setEroare("Alegeți cel puțin un angajat.");
      return;
    }

    porneste(async () => {
      const rezultat = await inregistreazaInstruireBloc({
        training_type_id: String(formular.get("training_type_id") ?? ""),
        data_instruirii: String(formular.get("data_instruirii") ?? ""),
        durata_ore: Number(formular.get("durata_ore") ?? 0),
        lector_employee_id: text("lector_employee_id"),
        lector_extern: text("lector_extern"),
        tematica: text("tematica"),
        materiale: text("materiale"),
        test_punctaj: numar("test_punctaj"),
        observatii: text("observatii"),
        employee_ids: [...selectati],
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push("/ssm/instruiri");
    });
  }

  return (
    <form action={trimite} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={id.tip} className="text-sm font-medium">
            Tip instruire
          </label>
          <select
            id={id.tip}
            name="training_type_id"
            required
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          >
            {tipuri.map((t) => (
              <option key={t.id} value={t.id}>
                [{ETICHETE_DOMENIU[t.domeniu]}] {t.denumire}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.data} className="text-sm font-medium">
            Data instruirii
          </label>
          <input
            id={id.data}
            name="data_instruirii"
            type="date"
            required
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.durata} className="text-sm font-medium">
            Durata (ore)
          </label>
          <input
            id={id.durata}
            name="durata_ore"
            type="number"
            min={0}
            step="0.5"
            defaultValue={2}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.punctaj} className="text-sm font-medium">
            Punctaj test (opțional)
          </label>
          <input
            id={id.punctaj}
            name="test_punctaj"
            type="number"
            min={0}
            max={100}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.lectorAngajat} className="text-sm font-medium">
            Lector — angajat propriu (opțional)
          </label>
          <select
            id={id.lectorAngajat}
            name="lector_employee_id"
            defaultValue=""
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {angajati.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name ?? a.marca}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.lectorExtern} className="text-sm font-medium">
            Lector extern (opțional)
          </label>
          <input
            id={id.lectorExtern}
            name="lector_extern"
            maxLength={120}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={id.tematica} className="text-sm font-medium">
            Tematică
          </label>
          <textarea
            id={id.tematica}
            name="tematica"
            rows={2}
            maxLength={2000}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.materiale} className="text-sm font-medium">
            Materiale folosite
          </label>
          <input
            id={id.materiale}
            name="materiale"
            maxLength={500}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.observatii} className="text-sm font-medium">
            Observații
          </label>
          <input
            id={id.observatii}
            name="observatii"
            maxLength={1000}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <fieldset className="space-y-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">
          Angajați ({selectati.size} selectați din {angajati.length})
        </legend>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={id.cauta} className="sr-only">
            Caută angajat
          </label>
          <input
            id={id.cauta}
            type="search"
            placeholder="Caută angajat"
            value={cauta}
            onChange={(e) => {
              setCauta(e.target.value);
            }}
            className="min-w-56 flex-1 rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={selecteazaToti}
            className="rounded-md border border-foreground/60 px-3 py-1.5 text-sm hover:bg-surface"
          >
            Selectează toți cei afișați
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectati(new Set());
            }}
            className="rounded-md border border-foreground/60 px-3 py-1.5 text-sm hover:bg-surface"
          >
            Golește selecția
          </button>
        </div>

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {angajatiFiltrati.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">Niciun angajat nu se potrivește căutării.</p>
          ) : (
            angajatiFiltrati.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface"
              >
                <input
                  type="checkbox"
                  checked={selectati.has(a.id)}
                  onChange={() => {
                    comuta(a.id);
                  }}
                />
                {a.full_name ?? "—"} <span className="text-muted-foreground">({a.marca})</span>
              </label>
            ))
          )}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={inCurs}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          {inCurs ? "Se salvează…" : "Înregistrează instruirea"}
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
