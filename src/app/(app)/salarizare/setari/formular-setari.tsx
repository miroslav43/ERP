"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { salveazaSetari } from "../actions";
import type { SetariSalarizare } from "@/lib/queries/payroll";

interface RandPrag {
  readonly cheie: number;
  readonly nr_persoane_intretinere_min: string;
  readonly nr_persoane_intretinere_max: string;
  readonly venit_brut_max: string;
  readonly valoare: string;
}

let urmatoareaCheie = 0;
function pragGol(): RandPrag {
  urmatoareaCheie += 1;
  return {
    cheie: urmatoareaCheie,
    nr_persoane_intretinere_min: "0",
    nr_persoane_intretinere_max: "0",
    venit_brut_max: "",
    valoare: "",
  };
}

export function FormularSetari({
  setariCurente,
}: {
  readonly setariCurente: SetariSalarizare | null;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [reusit, setReusit] = useState(false);
  const [praguri, setPraguri] = useState<readonly RandPrag[]>(() =>
    setariCurente !== null && setariCurente.praguri.length > 0
      ? setariCurente.praguri.map((p) => ({
          cheie: (urmatoareaCheie += 1),
          nr_persoane_intretinere_min: String(p.nr_persoane_intretinere_min),
          nr_persoane_intretinere_max:
            p.nr_persoane_intretinere_max === null ? "" : String(p.nr_persoane_intretinere_max),
          venit_brut_max: String(p.venit_brut_max),
          valoare: String(p.valoare),
        }))
      : [pragGol()],
  );

  const idValabilDeLa = useId();
  const idCas = useId();
  const idCass = useId();
  const idImpozit = useId();
  const idCam = useId();
  const idNorma = useId();
  const idSporNoapte = useId();
  const idOreSupl = useId();
  const idTichet = useId();

  function actualizeazaPrag(cheie: number, camp: keyof RandPrag, valoare: string): void {
    setPraguri((anterior) =>
      anterior.map((p) => (p.cheie === cheie ? { ...p, [camp]: valoare } : p)),
    );
  }

  function trimite(formular: FormData): void {
    setEroare(null);
    setReusit(false);
    porneste(async () => {
      const rezultat = await salveazaSetari({
        valabil_de_la: String(formular.get("valabil_de_la") ?? ""),
        cota_cas: Number(formular.get("cota_cas")),
        cota_cass: Number(formular.get("cota_cass")),
        cota_impozit: Number(formular.get("cota_impozit")),
        cota_cam_angajator: Number(formular.get("cota_cam_angajator")),
        norma_zilnica_ore: Number(formular.get("norma_zilnica_ore")),
        procent_spor_noapte: Number(formular.get("procent_spor_noapte")),
        procent_spor_weekend: 0,
        procent_ore_suplimentare: Number(formular.get("procent_ore_suplimentare")),
        valoare_tichet_masa: Number(formular.get("valoare_tichet_masa")),
        tichete_impozabile: formular.get("tichete_impozabile") === "on",
        tichete_supuse_cass: formular.get("tichete_supuse_cass") === "on",
        rotunjire_lei: formular.get("rotunjire_lei") === "on",
        praguri: praguri.map((p) => ({
          nr_persoane_intretinere_min: Number(p.nr_persoane_intretinere_min),
          nr_persoane_intretinere_max:
            p.nr_persoane_intretinere_max.trim() === ""
              ? null
              : Number(p.nr_persoane_intretinere_max),
          venit_brut_max: Number(p.venit_brut_max),
          valoare: Number(p.valoare),
        })),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setReusit(true);
      router.refresh();
    });
  }

  return (
    <form action={trimite} className="border-border space-y-6 rounded-lg border p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={idValabilDeLa} className="text-sm">
            Valabil de la
          </label>
          <input
            id={idValabilDeLa}
            name="valabil_de_la"
            type="date"
            required
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idCas} className="text-sm">
            Cota CAS (fracție, ex. 0,25)
          </label>
          <input
            id={idCas}
            name="cota_cas"
            type="number"
            step="0.0001"
            min={0}
            max={1}
            required
            defaultValue={setariCurente?.cota_cas}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idCass} className="text-sm">
            Cota CASS
          </label>
          <input
            id={idCass}
            name="cota_cass"
            type="number"
            step="0.0001"
            min={0}
            max={1}
            required
            defaultValue={setariCurente?.cota_cass}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idImpozit} className="text-sm">
            Cota de impozit
          </label>
          <input
            id={idImpozit}
            name="cota_impozit"
            type="number"
            step="0.0001"
            min={0}
            max={1}
            required
            defaultValue={setariCurente?.cota_impozit}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idCam} className="text-sm">
            Cota CAM (angajator)
          </label>
          <input
            id={idCam}
            name="cota_cam_angajator"
            type="number"
            step="0.0001"
            min={0}
            max={1}
            required
            defaultValue={setariCurente?.cota_cam_angajator}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idNorma} className="text-sm">
            Normă zilnică (ore)
          </label>
          <input
            id={idNorma}
            name="norma_zilnica_ore"
            type="number"
            step="0.5"
            min={1}
            required
            defaultValue={setariCurente?.norma_zilnica_ore ?? 8}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idSporNoapte} className="text-sm">
            Spor de noapte (fracție)
          </label>
          <input
            id={idSporNoapte}
            name="procent_spor_noapte"
            type="number"
            step="0.01"
            min={0}
            defaultValue={setariCurente?.procent_spor_noapte ?? 0.25}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idOreSupl} className="text-sm">
            Spor ore suplimentare (fracție)
          </label>
          <input
            id={idOreSupl}
            name="procent_ore_suplimentare"
            type="number"
            step="0.01"
            min={0}
            defaultValue={setariCurente?.procent_ore_suplimentare ?? 0.75}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idTichet} className="text-sm">
            Valoare tichet de masă (lei)
          </label>
          <input
            id={idTichet}
            name="valoare_tichet_masa"
            type="number"
            step="0.01"
            min={0}
            defaultValue={setariCurente?.valoare_tichet_masa ?? 0}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="tichete_impozabile"
            defaultChecked={setariCurente?.tichete_impozabile ?? false}
          />
          Tichetele intră în baza de impozit
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="tichete_supuse_cass"
            defaultChecked={setariCurente?.tichete_supuse_cass ?? false}
          />
          Tichetele intră în baza CASS (nu și în cea CAS)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="rotunjire_lei"
            defaultChecked={setariCurente?.rotunjire_lei ?? false}
          />
          Rotunjire la leu întreg
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Praguri de deducere personală</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left text-xs">
              <tr>
                <th className="py-1 pr-2 font-medium">Persoane (min)</th>
                <th className="py-1 pr-2 font-medium">Persoane (max, gol = fără plafon)</th>
                <th className="py-1 pr-2 font-medium">Venit brut maxim (lei)</th>
                <th className="py-1 pr-2 font-medium">Deducere (lei)</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {praguri.map((prag) => (
                <tr key={prag.cheie}>
                  <td className="py-1 pr-2">
                    <input
                      type="number"
                      min={0}
                      value={prag.nr_persoane_intretinere_min}
                      onChange={(e) => {
                        actualizeazaPrag(prag.cheie, "nr_persoane_intretinere_min", e.target.value);
                      }}
                      className="border-foreground/60 w-24 rounded-md border px-2 py-1"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="number"
                      min={0}
                      value={prag.nr_persoane_intretinere_max}
                      onChange={(e) => {
                        actualizeazaPrag(prag.cheie, "nr_persoane_intretinere_max", e.target.value);
                      }}
                      className="border-foreground/60 w-24 rounded-md border px-2 py-1"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={prag.venit_brut_max}
                      onChange={(e) => {
                        actualizeazaPrag(prag.cheie, "venit_brut_max", e.target.value);
                      }}
                      required
                      className="border-foreground/60 w-32 rounded-md border px-2 py-1"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={prag.valoare}
                      onChange={(e) => {
                        actualizeazaPrag(prag.cheie, "valoare", e.target.value);
                      }}
                      required
                      className="border-foreground/60 w-32 rounded-md border px-2 py-1"
                    />
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPraguri((anterior) => anterior.filter((p) => p.cheie !== prag.cheie));
                      }}
                      disabled={praguri.length <= 1}
                      className="text-danger text-xs disabled:opacity-40"
                    >
                      Șterge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => {
            setPraguri((anterior) => [...anterior, pragGol()]);
          }}
          className="border-foreground/60 hover:bg-surface rounded-md border px-3 py-1.5 text-sm"
        >
          Adaugă prag
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se salvează…" : "Salvează o versiune nouă"}
        </button>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-sm">
            {eroare}
          </p>
        )}
        {reusit ? (
          <p role="status" className="text-foreground text-sm">
            Setările au fost salvate ca versiune nouă.
          </p>
        ) : null}
      </div>
    </form>
  );
}
