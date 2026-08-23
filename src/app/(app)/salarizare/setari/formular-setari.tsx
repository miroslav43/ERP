"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

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
  const idSporWeekend = useId();
  const idSporSarbatoare = useId();
  const idCasaSanatate = useId();
  const idFunctieDeclarant = useId();
  const idOreSupl = useId();
  const idTichet = useId();
  const idSalariuMinim = useId();

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
        procent_spor_weekend: Number(formular.get("procent_spor_weekend")),
        procent_spor_sarbatoare: Number(formular.get("procent_spor_sarbatoare")),
        casa_sanatate_angajator: String(formular.get("casa_sanatate_angajator") ?? ""),
        functie_declarant: String(formular.get("functie_declarant") ?? "Administrator"),
        procent_ore_suplimentare: Number(formular.get("procent_ore_suplimentare")),
        valoare_tichet_masa: Number(formular.get("valoare_tichet_masa")),
        tichete_impozabile: formular.get("tichete_impozabile") === "on",
        tichete_supuse_cass: formular.get("tichete_supuse_cass") === "on",
        salariu_minim_brut: formular.get("salariu_minim_brut"),
        aplica_minim_contributii: formular.get("aplica_minim_contributii") === "on",
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
    <form action={trimite} className="border-border rounded-panou space-y-6 border p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={idValabilDeLa} className="text-corp">
            Valabil de la
          </label>
          <input
            id={idValabilDeLa}
            name="valabil_de_la"
            type="date"
            required
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idCas} className="text-corp">
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
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idCass} className="text-corp">
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
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idImpozit} className="text-corp">
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
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idCam} className="text-corp">
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
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idNorma} className="text-corp">
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
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idSporNoapte} className="text-corp">
            Spor de noapte (fracție)
          </label>
          <input
            id={idSporNoapte}
            name="procent_spor_noapte"
            type="number"
            step="0.01"
            min={0}
            defaultValue={setariCurente?.procent_spor_noapte ?? 0.25}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idSporWeekend} className="text-corp">
            Spor repaus săptămânal (fracție)
          </label>
          <input
            id={idSporWeekend}
            name="procent_spor_weekend"
            type="number"
            step="0.01"
            min={0}
            defaultValue={setariCurente?.procent_spor_weekend ?? 1}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
          <p className="text-muted-foreground text-nota">
            Codul Muncii art. 137 alin. (2): minimum 100% (adică 1), dacă munca nu e compensată cu
            timp liber. Formularul trimitea până acum 0 în locul acestui câmp, iar sâmbăta se plătea
            la tarif simplu.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idSporSarbatoare} className="text-corp">
            Spor sărbătoare legală (fracție)
          </label>
          <input
            id={idSporSarbatoare}
            name="procent_spor_sarbatoare"
            type="number"
            step="0.01"
            min={0}
            defaultValue={setariCurente?.procent_spor_sarbatoare ?? 1}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
          <p className="text-muted-foreground text-nota">
            Codul Muncii art. 142 alin. (2): minimum 100%. Fără el, calculul cădea pe sporul de
            repaus.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idCasaSanatate} className="text-corp">
            Casa de asigurări de sănătate (D112)
          </label>
          <input
            id={idCasaSanatate}
            name="casa_sanatate_angajator"
            type="text"
            maxLength={10}
            placeholder="TM"
            defaultValue={setariCurente?.casa_sanatate_angajator ?? ""}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2 uppercase"
          />
          <p className="text-muted-foreground text-nota">
            Codul din nomenclatorul CNAS, care trebuie să COINCIDĂ cu județul sediului social — TM
            pentru Timiș, CJ pentru Cluj. ANAF respinge Declarația 112 fără el.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idFunctieDeclarant} className="text-corp">
            Funcția declarantului (D112)
          </label>
          <input
            id={idFunctieDeclarant}
            name="functie_declarant"
            type="text"
            maxLength={50}
            defaultValue={setariCurente?.functie_declarant ?? "Administrator"}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
          <p className="text-muted-foreground text-nota">
            Calitatea celui care semnează declarația: administrator, contabil șef, împuternicit.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idOreSupl} className="text-corp">
            Spor ore suplimentare (fracție)
          </label>
          <input
            id={idOreSupl}
            name="procent_ore_suplimentare"
            type="number"
            step="0.01"
            min={0}
            defaultValue={setariCurente?.procent_ore_suplimentare ?? 0.75}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idTichet} className="text-corp">
            Valoare tichet de masă (lei)
          </label>
          <input
            id={idTichet}
            name="valoare_tichet_masa"
            type="number"
            step="0.01"
            min={0}
            defaultValue={setariCurente?.valoare_tichet_masa ?? 0}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idSalariuMinim} className="text-corp">
            Salariu minim brut (lei)
          </label>
          <input
            id={idSalariuMinim}
            name="salariu_minim_brut"
            type="number"
            step="0.01"
            min={0}
            defaultValue={setariCurente?.salariu_minim_brut ?? 0}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
          <p className="text-muted-foreground text-nota">
            Pragul minim al bazei de contribuții. Se confirmă cu contabilul — valoarea se schimbă
            prin hotărâre de guvern, iar minimele sectoriale diferă.
          </p>
        </div>
      </div>

      <div className="text-corp flex flex-wrap gap-6">
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
            name="aplica_minim_contributii"
            defaultChecked={setariCurente?.aplica_minim_contributii ?? false}
          />
          Ridică baza de contribuții la salariul minim
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
        <p className="text-corp font-medium">Praguri de deducere personală</p>
        <div className="overflow-x-auto">
          <table className="text-corp w-full">
            <thead className="text-muted-foreground text-nota text-left">
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
                      className="border-foreground/60 rounded-control w-24 border px-2 py-1"
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
                      className="border-foreground/60 rounded-control w-24 border px-2 py-1"
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
                      className="border-foreground/60 rounded-control w-32 border px-2 py-1"
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
                      className="border-foreground/60 rounded-control w-32 border px-2 py-1"
                    />
                  </td>
                  <td className="py-1">
                    <Buton
                      varianta="distructiv"
                      onClick={() => {
                        setPraguri((anterior) => anterior.filter((p) => p.cheie !== prag.cheie));
                      }}
                      disabled={praguri.length <= 1}
                    >
                      Șterge
                    </Buton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Buton
          varianta="secundar"
          onClick={() => {
            setPraguri((anterior) => [...anterior, pragGol()]);
          }}
        >
          Adaugă prag
        </Buton>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          Salvează o versiune nouă
        </Buton>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroare}
          </p>
        )}
        {reusit ? (
          <p role="status" className="text-foreground text-corp">
            Setările au fost salvate ca versiune nouă.
          </p>
        ) : null}
      </div>
    </form>
  );
}
