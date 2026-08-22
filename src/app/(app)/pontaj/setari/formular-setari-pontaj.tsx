"use client";

import { useId, useState, useTransition } from "react";

import type { SetariPontajComplete } from "@/lib/queries/attendance";

import { salveazaSetariPontaj } from "./actions";

const CAMP = "border-foreground/60 rounded-md border px-3 py-2 text-sm";

/**
 * Fiecare câmp are o descriere sub el, nu doar o etichetă. Sunt parametri de
 * dreptul muncii: cine îi completează trebuie să știe CE anume confirmă, nu
 * doar unde să scrie o cifră.
 */
function Numeric({
  nume,
  eticheta,
  descriere,
  implicit,
  pas = "0.01",
  minim = 0,
  maxim,
}: {
  readonly nume: string;
  readonly eticheta: string;
  readonly descriere: string;
  readonly implicit: number | undefined;
  readonly pas?: string;
  readonly minim?: number;
  readonly maxim?: number;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm">
        {eticheta}
      </label>
      <input
        id={id}
        name={nume}
        type="number"
        step={pas}
        min={minim}
        max={maxim}
        defaultValue={implicit}
        required
        className={CAMP}
      />
      <p className="text-muted-foreground text-xs">{descriere}</p>
    </div>
  );
}

export function FormularSetariPontaj({
  setariCurente,
}: {
  readonly setariCurente: SetariPontajComplete | null;
}) {
  const idDeLa = useId();
  const idNoapteStart = useId();
  const idNoapteSfarsit = useId();
  const idObservatii = useId();
  const [seTrimite, porneste] = useTransition();
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [eroare, setEroare] = useState<string | null>(null);

  function trimite(formular: FormData): void {
    setMesaj(null);
    setEroare(null);
    porneste(async () => {
      const rezultat = await salveazaSetariPontaj({
        valabil_de_la: formular.get("valabil_de_la"),
        ore_pe_zi: formular.get("ore_pe_zi"),
        ore_pe_saptamana: formular.get("ore_pe_saptamana"),
        ore_maxime_saptamanale: formular.get("ore_maxime_saptamanale"),
        perioada_referinta_luni: formular.get("perioada_referinta_luni"),
        repaus_zilnic_minim_ore: formular.get("repaus_zilnic_minim_ore"),
        repaus_saptamanal_minim_ore: formular.get("repaus_saptamanal_minim_ore"),
        spor_suplimentare_procent: formular.get("spor_suplimentare_procent"),
        spor_noapte_procent: formular.get("spor_noapte_procent"),
        spor_weekend_procent: formular.get("spor_weekend_procent"),
        spor_sarbatoare_procent: formular.get("spor_sarbatoare_procent"),
        noapte_start: formular.get("noapte_start"),
        noapte_sfarsit: formular.get("noapte_sfarsit"),
        prag_ore_noapte: formular.get("prag_ore_noapte"),
        termen_compensare_suplimentare_zile: formular.get("termen_compensare_suplimentare_zile"),
        termen_compensare_sarbatoare_zile: formular.get("termen_compensare_sarbatoare_zile"),
        pauza_masa_minute: formular.get("pauza_masa_minute"),
        pauza_masa_inclusa_in_program: formular.get("pauza_masa_inclusa_in_program") === "on",
        pauza_obligatorie_peste_ore: formular.get("pauza_obligatorie_peste_ore"),
        observatii_juridice: formular.get("observatii_juridice"),
      });
      if (rezultat.ok) setMesaj("Versiunea a fost salvată.");
      else setEroare(rezultat.error.message);
    });
  }

  return (
    <form action={trimite} className="border-border space-y-6 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={idDeLa} className="text-sm">
          În vigoare de la
        </label>
        <input id={idDeLa} name="valabil_de_la" type="date" required className={CAMP} />
        <p className="text-muted-foreground text-xs">
          Lunile calculate înainte de această dată rămân pe versiunea anterioară.
        </p>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Timp de lucru</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Numeric
            nume="ore_pe_zi"
            eticheta="Ore pe zi"
            descriere="Norma zilnică obișnuită."
            implicit={setariCurente?.ore_pe_zi}
            maxim={24}
          />
          <Numeric
            nume="ore_pe_saptamana"
            eticheta="Ore pe săptămână"
            descriere="Norma săptămânală obișnuită."
            implicit={setariCurente?.ore_pe_saptamana}
            maxim={168}
          />
          <Numeric
            nume="ore_maxime_saptamanale"
            eticheta="Maxim săptămânal cu ore suplimentare"
            descriere="Limita legală, inclusiv suplimentarele."
            implicit={setariCurente?.ore_maxime_saptamanale}
            maxim={168}
          />
          <Numeric
            nume="perioada_referinta_luni"
            eticheta="Perioada de referință (luni)"
            descriere="Intervalul pe care se face media săptămânală."
            implicit={setariCurente?.perioada_referinta_luni}
            pas="1"
            minim={1}
            maxim={12}
          />
          <Numeric
            nume="repaus_zilnic_minim_ore"
            eticheta="Repaus zilnic minim (ore)"
            descriere="Între sfârșitul unei zile și începutul următoarei."
            implicit={setariCurente?.repaus_zilnic_minim_ore}
            maxim={24}
          />
          <Numeric
            nume="repaus_saptamanal_minim_ore"
            eticheta="Repaus săptămânal minim (ore)"
            descriere="Neîntrerupt, în fiecare săptămână."
            implicit={setariCurente?.repaus_saptamanal_minim_ore}
            maxim={168}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Sporuri</legend>
        <p className="text-muted-foreground text-xs">
          Procente de la 0 la 300, <strong>nu</strong> fracții. Setările de salarizare folosesc
          fracții (0,25 pentru 25%); aici scara e alta, iar confuzia ar înmulți sporurile cu o sută.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Numeric
            nume="spor_suplimentare_procent"
            eticheta="Spor ore suplimentare (%)"
            descriere="Peste tariful orar, pentru orele care depășesc norma."
            implicit={setariCurente?.spor_suplimentare_procent}
            maxim={300}
          />
          <Numeric
            nume="spor_noapte_procent"
            eticheta="Spor de noapte (%)"
            descriere="Pentru orele din intervalul nocturn."
            implicit={setariCurente?.spor_noapte_procent}
            maxim={300}
          />
          <Numeric
            nume="spor_weekend_procent"
            eticheta="Spor repaus săptămânal (%)"
            descriere="Pentru munca într-o zi de repaus."
            implicit={setariCurente?.spor_weekend_procent}
            maxim={300}
          />
          <Numeric
            nume="spor_sarbatoare_procent"
            eticheta="Spor sărbătoare legală (%)"
            descriere="Pentru munca într-o sărbătoare, când nu se dă zi liberă."
            implicit={setariCurente?.spor_sarbatoare_procent}
            maxim={300}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Munca de noapte</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={idNoapteStart} className="text-sm">
              Începutul intervalului
            </label>
            <input
              id={idNoapteStart}
              name="noapte_start"
              type="time"
              defaultValue={setariCurente?.noapte_start.slice(0, 5)}
              required
              className={CAMP}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idNoapteSfarsit} className="text-sm">
              Sfârșitul intervalului
            </label>
            <input
              id={idNoapteSfarsit}
              name="noapte_sfarsit"
              type="time"
              defaultValue={setariCurente?.noapte_sfarsit.slice(0, 5)}
              required
              className={CAMP}
            />
          </div>
          <Numeric
            nume="prag_ore_noapte"
            eticheta="Prag ore de noapte"
            descriere="Minimul de ore nocturne dintr-o zi pentru a da drept la spor. Zero = fără prag."
            implicit={setariCurente?.prag_ore_noapte}
            maxim={12}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Compensare și pauze</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Numeric
            nume="termen_compensare_suplimentare_zile"
            eticheta="Termen compensare ore suplimentare (zile)"
            descriere="După expirare, orele se plătesc obligatoriu cu spor."
            implicit={setariCurente?.termen_compensare_suplimentare_zile}
            pas="1"
            maxim={365}
          />
          <Numeric
            nume="termen_compensare_sarbatoare_zile"
            eticheta="Termen acordare zi liberă pentru sărbătoare (zile)"
            descriere="După expirare se plătește sporul."
            implicit={setariCurente?.termen_compensare_sarbatoare_zile}
            pas="1"
            maxim={365}
          />
          <Numeric
            nume="pauza_masa_minute"
            eticheta="Pauză de masă (minute)"
            descriere="Durata pauzei obligatorii."
            implicit={setariCurente?.pauza_masa_minute}
            pas="1"
            maxim={240}
          />
          <Numeric
            nume="pauza_obligatorie_peste_ore"
            eticheta="Pauza devine obligatorie peste (ore)"
            descriere="Durata zilei de la care pauza e impusă."
            implicit={setariCurente?.pauza_obligatorie_peste_ore}
            maxim={24}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="pauza_masa_inclusa_in_program"
            defaultChecked={setariCurente?.pauza_masa_inclusa_in_program ?? false}
          />
          Pauza de masă e inclusă în programul plătit
        </label>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor={idObservatii} className="text-sm">
          Observații juridice
        </label>
        <textarea
          id={idObservatii}
          name="observatii_juridice"
          rows={3}
          defaultValue={setariCurente?.observatii_juridice ?? ""}
          className={CAMP}
        />
        <p className="text-muted-foreground text-xs">
          Cine a confirmat valorile și pe ce temei. Peste un an, cifra fără sursă nu mai poate fi
          apărată.
        </p>
      </div>

      <button
        type="submit"
        disabled={seTrimite}
        className="bg-foreground text-background rounded-md px-4 py-2 text-sm disabled:opacity-50"
      >
        {seTrimite ? "Se salvează…" : "Salvează versiunea"}
      </button>

      {mesaj !== null ? <p className="text-success text-sm">{mesaj}</p> : null}
      {eroare !== null ? <p className="text-danger text-sm">{eroare}</p> : null}
    </form>
  );
}
