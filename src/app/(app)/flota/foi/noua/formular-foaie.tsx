"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { creeazaFoaie } from "../../actions";

interface VehiculOptiune {
  readonly id: string;
  readonly nr_inmatriculare: string;
  readonly km_curent: number;
}

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

export function FormularFoaie({
  vehicule,
  angajati,
}: {
  readonly vehicule: readonly VehiculOptiune[];
  readonly angajati: readonly AngajatOptiune[];
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [vehiculId, setVehiculId] = useState(vehicule[0]?.id ?? "");

  const id = {
    vehicul: useId(),
    sofer: useId(),
    plecare: useId(),
    km: useId(),
    traseu: useId(),
    scop: useId(),
  };

  /**
   * Kilometrajul sugerat vine din `vehicles.km_curent`, care e ridicat la fiecare
   * aprobare de foaie — adică e chiar ultimul kilometraj cunoscut. Îl arătăm ca
   * valoare implicită editabilă, nu blocată: șoferul poate avea un motiv real să
   * îl corecteze în sus, iar în jos oricum îl refuză baza.
   */
  const kmSugerat = vehicule.find((v) => v.id === vehiculId)?.km_curent ?? 0;

  function trimite(formular: FormData): void {
    setEroare(null);
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };

    porneste(async () => {
      const rezultat = await creeazaFoaie({
        vehicle_id: String(formular.get("vehicle_id") ?? ""),
        employee_id: String(formular.get("employee_id") ?? ""),
        plecare_la: String(formular.get("plecare_la") ?? ""),
        km_plecare: Number(formular.get("km_plecare") ?? 0),
        traseu: text("traseu"),
        scop: text("scop"),
        observatii: null,
      });

      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push(`/flota/foi/${rezultat.data.id}`);
    });
  }

  return (
    <form action={trimite} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={id.vehicul} className="text-sm font-medium">
            Vehicul
          </label>
          <select
            id={id.vehicul}
            name="vehicle_id"
            required
            value={vehiculId}
            onChange={(e) => {
              setVehiculId(e.target.value);
            }}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          >
            {vehicule.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nr_inmatriculare}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.sofer} className="text-sm font-medium">
            Șofer
          </label>
          <select
            id={id.sofer}
            name="employee_id"
            required
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          >
            {angajati.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name ?? a.marca} ({a.marca})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.plecare} className="text-sm font-medium">
            Plecare
          </label>
          <input
            id={id.plecare}
            name="plecare_la"
            type="datetime-local"
            required
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.km} className="text-sm font-medium">
            Kilometraj la plecare
          </label>
          <input
            // `key` forțează remontarea la schimbarea vehiculului, ca valoarea
            // implicită să se actualizeze — un `defaultValue` nou nu ar face-o.
            key={vehiculId}
            id={id.km}
            name="km_plecare"
            type="number"
            min={0}
            required
            defaultValue={kmSugerat}
            aria-describedby={`${id.km}-ajutor`}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
          <p id={`${id.km}-ajutor`} className="text-muted-foreground text-xs">
            Ultimul kilometraj cunoscut: {kmSugerat.toLocaleString("ro-RO")} km.
          </p>
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={id.traseu} className="text-sm font-medium">
            Traseu
          </label>
          <input
            id={id.traseu}
            name="traseu"
            maxLength={500}
            placeholder="Cluj-Napoca – Turda – Cluj-Napoca"
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={id.scop} className="text-sm font-medium">
            Scopul deplasării
          </label>
          <input
            id={id.scop}
            name="scop"
            maxLength={500}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se salvează…" : "Salvează ciorna"}
        </button>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-sm">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
