"use client";

import { useId, useState, useTransition } from "react";

import { salveazaIstoricVenit } from "../actions";

interface AngajatOptiune {
  readonly employee_id: string;
  readonly full_name: string;
  readonly marca: string;
}

export function FormularIstoricVenit({
  angajati,
}: {
  readonly angajati: readonly AngajatOptiune[];
}) {
  const idAngajat = useId();
  const idAn = useId();
  const idLuna = useId();
  const idBrut = useId();
  const idDrepturi = useId();
  const idZile = useId();
  const [seTrimite, porneste] = useTransition();
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [eroare, setEroare] = useState<string | null>(null);

  function trimite(formular: FormData): void {
    setMesaj(null);
    setEroare(null);
    porneste(async () => {
      const rezultat = await salveazaIstoricVenit({
        employee_id: formular.get("employee_id"),
        an: formular.get("an"),
        luna: formular.get("luna"),
        venit_brut: formular.get("venit_brut"),
        drepturi_salariale: formular.get("drepturi_salariale"),
        zile_lucrate: formular.get("zile_lucrate"),
        sursa: formular.get("sursa"),
      });
      if (rezultat.ok) {
        setMesaj(
          "Rândul a fost salvat. O lună introdusă de două ori se actualizează, nu se dublează.",
        );
      } else {
        setEroare(rezultat.error.message);
      }
    });
  }

  const camp = "border-foreground/60 rounded-md border px-3 py-2 text-sm";

  return (
    <form action={trimite} className="border-border space-y-4 rounded-lg border p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 sm:col-span-3">
          <label htmlFor={idAngajat} className="text-sm">
            Angajat
          </label>
          <select id={idAngajat} name="employee_id" required className={camp}>
            {angajati.map((a) => (
              <option key={a.employee_id} value={a.employee_id}>
                {a.full_name || a.marca}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idAn} className="text-sm">
            An
          </label>
          <input
            id={idAn}
            name="an"
            type="number"
            min={2000}
            max={2100}
            required
            className={camp}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idLuna} className="text-sm">
            Luna
          </label>
          <input id={idLuna} name="luna" type="number" min={1} max={12} required className={camp} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idZile} className="text-sm">
            Zile lucrate
          </label>
          <input
            id={idZile}
            name="zile_lucrate"
            type="number"
            step="0.5"
            min={0}
            max={31}
            required
            className={camp}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idBrut} className="text-sm">
            Venit brut (lei)
          </label>
          <input
            id={idBrut}
            name="venit_brut"
            type="number"
            step="0.01"
            min={0}
            required
            className={camp}
          />
          <p className="text-muted-foreground text-xs">Baza indemnizației de concediu medical.</p>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={idDrepturi} className="text-sm">
            Drepturi salariale (lei)
          </label>
          <input
            id={idDrepturi}
            name="drepturi_salariale"
            type="number"
            step="0.01"
            min={0}
            required
            className={camp}
          />
          <p className="text-muted-foreground text-xs">
            Salariu de bază plus sporurile <strong>permanente</strong>, fără primele ocazionale.
            Baza indemnizației de concediu de odihnă.
          </p>
        </div>
      </div>

      <input type="hidden" name="sursa" value="introdus manual" />

      <button
        type="submit"
        disabled={seTrimite || angajati.length === 0}
        className="bg-foreground text-background rounded-md px-4 py-2 text-sm disabled:opacity-50"
      >
        {seTrimite ? "Se salvează…" : "Salvează luna"}
      </button>

      {mesaj !== null ? <p className="text-success text-sm">{mesaj}</p> : null}
      {eroare !== null ? <p className="text-danger text-sm">{eroare}</p> : null}
    </form>
  );
}
