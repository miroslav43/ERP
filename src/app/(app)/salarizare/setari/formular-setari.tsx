// src/app/(app)/salarizare/setari/formular-setari.tsx
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import type { ActionResult } from "@/lib/actions/types";
import { cn } from "@/lib/ui/cn";

import { salveazaSetari } from "../actions";
import type { SetariSalarizare } from "@/lib/queries/payroll";

interface RandPrag {
  readonly cheie: number;
  readonly nr_persoane_intretinere_min: string;
  readonly nr_persoane_intretinere_max: string;
  readonly venit_brut_max: string;
  readonly valoare: string;
}

type SetariSalvate = Readonly<{ id: string }>;

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

/**
 * Câmpurile care nu au voie să rămână goale.
 *
 * `Formular` pune `noValidate` pe formular — bulele browserului sunt în engleză
 * și opresc trimiterea înainte ca Zod să apuce să spună ceva mai bun în română.
 * Consecința: `required` nu mai blochează nimic, iar `Number("")` este 0. Cum
 * `cota()` din `schemas/payroll.ts` acceptă 0, o cotă ștearsă din greșeală s-ar
 * fi salvat ca zero, într-o versiune nouă de setări, fără nicio eroare — adică
 * CAS, CASS sau impozit oprite complet pentru toate statele calculate după acea
 * dată. Restul câmpurilor numerice au deja mesaj propriu în română: norma
 * zilnică cere `positive()`, iar data trece prin `regex`.
 */
const COTE_OBLIGATORII: readonly (readonly [string, string])[] = [
  ["cota_cas", "Cota CAS este obligatorie."],
  ["cota_cass", "Cota CASS este obligatorie."],
  ["cota_impozit", "Cota de impozit este obligatorie."],
  ["cota_cam_angajator", "Cota CAM este obligatorie."],
];

export function FormularSetari({
  setariCurente,
}: {
  readonly setariCurente: SetariSalarizare | null;
}) {
  const router = useRouter();
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

  function actualizeazaPrag(cheie: number, camp: keyof RandPrag, valoare: string): void {
    setPraguri((anterior) =>
      anterior.map((p) => (p.cheie === cheie ? { ...p, [camp]: valoare } : p)),
    );
  }

  // `laReusita` intră în dependențele efectului de succes din `Formular`. O
  // funcție nouă la fiecare randare ar reporni efectul după `router.refresh()`,
  // iar notificarea ar apărea de mai multe ori pentru o singură salvare.
  const laReusita = useCallback(() => {
    router.refresh();
  }, [router]);

  /**
   * Numele câmpurilor sunt EXACT cheile lui `setariSalarizareSchema`:
   * `valabil_de_la`, `cota_cas`, `cota_cass`, `cota_impozit`,
   * `cota_cam_angajator`, `norma_zilnica_ore`, `procent_spor_noapte`,
   * `procent_spor_weekend`, `procent_spor_sarbatoare`,
   * `casa_sanatate_angajator`, `functie_declarant`, `procent_ore_suplimentare`,
   * `valoare_tichet_masa`, `tichete_impozabile`, `tichete_supuse_cass`,
   * `salariu_minim_brut`, `aplica_minim_contributii`, `rotunjire_lei` și
   * `praguri`. Pe ele se potrivește harta `fieldErrors` construită de
   * `create-action.ts`; un nume greșit cu o literă face mesajul serverului să
   * dispară fără urmă.
   *
   * `praguri` nu vine din `FormData`, ci din starea grilei de mai jos. Zod pune
   * problemele dintr-un rând de prag tot sub cheia `praguri` (`flattenError`
   * păstrează doar primul segment al căii), deci mesajele lui se afișează o
   * singură dată, deasupra grilei.
   */
  async function trimite(fd: FormData): Promise<ActionResult<SetariSalvate>> {
    const erori: Record<string, readonly string[]> = {};
    for (const [cheie, mesaj] of COTE_OBLIGATORII) {
      const valoare = fd.get(cheie);
      if (typeof valoare !== "string" || valoare.trim() === "") erori[cheie] = [mesaj];
    }
    if (praguri.some((p) => p.venit_brut_max.trim() === "" || p.valoare.trim() === "")) {
      erori["praguri"] = ["Completați venitul brut maxim și deducerea pentru fiecare prag."];
    }
    if (Object.keys(erori).length > 0) {
      return {
        ok: false,
        error: {
          code: "VALIDARE",
          message: "Completați câmpurile marcate.",
          fieldErrors: erori,
          requestId: "validare-client",
        },
      };
    }

    return salveazaSetari({
      valabil_de_la: String(fd.get("valabil_de_la") ?? ""),
      cota_cas: fd.get("cota_cas"),
      cota_cass: fd.get("cota_cass"),
      cota_impozit: fd.get("cota_impozit"),
      cota_cam_angajator: fd.get("cota_cam_angajator"),
      norma_zilnica_ore: fd.get("norma_zilnica_ore"),
      procent_spor_noapte: fd.get("procent_spor_noapte"),
      procent_spor_weekend: fd.get("procent_spor_weekend"),
      procent_spor_sarbatoare: fd.get("procent_spor_sarbatoare"),
      casa_sanatate_angajator: String(fd.get("casa_sanatate_angajator") ?? ""),
      functie_declarant: String(fd.get("functie_declarant") ?? "Administrator"),
      procent_ore_suplimentare: fd.get("procent_ore_suplimentare"),
      valoare_tichet_masa: fd.get("valoare_tichet_masa"),
      tichete_impozabile: fd.get("tichete_impozabile") === "on",
      tichete_supuse_cass: fd.get("tichete_supuse_cass") === "on",
      salariu_minim_brut: fd.get("salariu_minim_brut"),
      aplica_minim_contributii: fd.get("aplica_minim_contributii") === "on",
      rotunjire_lei: fd.get("rotunjire_lei") === "on",
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
  }

  return (
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita="Setările au fost salvate ca versiune nouă."
      className="border-border rounded-panou gap-6 border p-4"
    >
      {(stare) => {
        // Echivalentul lui `valoriTrimise[cheie] ?? valoarea inițială`, pentru
        // bife: după o trimitere respinsă contează dacă cheia a AJUNS în
        // `FormData`, fiindcă o casetă nebifată nu apare deloc acolo. Înainte
        // de prima trimitere, harta e goală și rămâne valoarea din baza de date.
        const bifa = (cheie: string, initial: boolean): boolean =>
          Object.keys(stare.valoriTrimise).length === 0
            ? initial
            : stare.valoriTrimise[cheie] === "on";

        // Zod pune problemele oricărui rând de prag tot sub cheia `praguri`:
        // `flattenError` păstrează doar primul segment al căii.
        const eroriPraguri = stare.erori["praguri"] ?? [];

        return (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Camp
                nume="valabil_de_la"
                eticheta="Valabil de la"
                obligatoriu
                erori={stare.erori["valabil_de_la"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    defaultValue={stare.valoriTrimise["valabil_de_la"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="cota_cas"
                eticheta="Cota CAS (fracție, ex. 0,25)"
                obligatoriu
                erori={stare.erori["cota_cas"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    step="0.0001"
                    min={0}
                    max={1}
                    defaultValue={stare.valoriTrimise["cota_cas"] ?? setariCurente?.cota_cas}
                  />
                )}
              </Camp>

              <Camp
                nume="cota_cass"
                eticheta="Cota CASS"
                obligatoriu
                erori={stare.erori["cota_cass"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    step="0.0001"
                    min={0}
                    max={1}
                    defaultValue={stare.valoriTrimise["cota_cass"] ?? setariCurente?.cota_cass}
                  />
                )}
              </Camp>

              <Camp
                nume="cota_impozit"
                eticheta="Cota de impozit"
                obligatoriu
                erori={stare.erori["cota_impozit"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    step="0.0001"
                    min={0}
                    max={1}
                    defaultValue={
                      stare.valoriTrimise["cota_impozit"] ?? setariCurente?.cota_impozit
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="cota_cam_angajator"
                eticheta="Cota CAM (angajator)"
                obligatoriu
                erori={stare.erori["cota_cam_angajator"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    step="0.0001"
                    min={0}
                    max={1}
                    defaultValue={
                      stare.valoriTrimise["cota_cam_angajator"] ?? setariCurente?.cota_cam_angajator
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="norma_zilnica_ore"
                eticheta="Normă zilnică (ore)"
                obligatoriu
                erori={stare.erori["norma_zilnica_ore"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    step="0.5"
                    min={1}
                    defaultValue={
                      stare.valoriTrimise["norma_zilnica_ore"] ??
                      setariCurente?.norma_zilnica_ore ??
                      8
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="procent_spor_noapte"
                eticheta="Spor de noapte (fracție)"
                erori={stare.erori["procent_spor_noapte"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={
                      stare.valoriTrimise["procent_spor_noapte"] ??
                      setariCurente?.procent_spor_noapte ??
                      0.25
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="procent_spor_weekend"
                eticheta="Spor repaus săptămânal (fracție)"
                ajutor="Codul Muncii art. 137 alin. (2): minimum 100% (adică 1), dacă munca nu e compensată cu timp liber. Formularul trimitea până acum 0 în locul acestui câmp, iar sâmbăta se plătea la tarif simplu."
                erori={stare.erori["procent_spor_weekend"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={
                      stare.valoriTrimise["procent_spor_weekend"] ??
                      setariCurente?.procent_spor_weekend ??
                      1
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="procent_spor_sarbatoare"
                eticheta="Spor sărbătoare legală (fracție)"
                ajutor="Codul Muncii art. 142 alin. (2): minimum 100%. Fără el, calculul cădea pe sporul de repaus."
                erori={stare.erori["procent_spor_sarbatoare"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={
                      stare.valoriTrimise["procent_spor_sarbatoare"] ??
                      setariCurente?.procent_spor_sarbatoare ??
                      1
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="casa_sanatate_angajator"
                eticheta="Casa de asigurări de sănătate (D112)"
                ajutor="Codul din nomenclatorul CNAS, care trebuie să COINCIDĂ cu județul sediului social — TM pentru Timiș, CJ pentru Cluj. ANAF respinge Declarația 112 fără el."
                erori={stare.erori["casa_sanatate_angajator"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    maxLength={10}
                    placeholder="TM"
                    className={cn(a.className, "uppercase")}
                    defaultValue={
                      stare.valoriTrimise["casa_sanatate_angajator"] ??
                      setariCurente?.casa_sanatate_angajator ??
                      ""
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="functie_declarant"
                eticheta="Funcția declarantului (D112)"
                ajutor="Calitatea celui care semnează declarația: administrator, contabil șef, împuternicit."
                erori={stare.erori["functie_declarant"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    maxLength={50}
                    defaultValue={
                      stare.valoriTrimise["functie_declarant"] ??
                      setariCurente?.functie_declarant ??
                      "Administrator"
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="procent_ore_suplimentare"
                eticheta="Spor ore suplimentare (fracție)"
                erori={stare.erori["procent_ore_suplimentare"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={
                      stare.valoriTrimise["procent_ore_suplimentare"] ??
                      setariCurente?.procent_ore_suplimentare ??
                      0.75
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="valoare_tichet_masa"
                eticheta="Valoare tichet de masă (lei)"
                erori={stare.erori["valoare_tichet_masa"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={
                      stare.valoriTrimise["valoare_tichet_masa"] ??
                      setariCurente?.valoare_tichet_masa ??
                      0
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="salariu_minim_brut"
                eticheta="Salariu minim brut (lei)"
                ajutor="Pragul minim al bazei de contribuții. Se confirmă cu contabilul — valoarea se schimbă prin hotărâre de guvern, iar minimele sectoriale diferă."
                erori={stare.erori["salariu_minim_brut"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={
                      stare.valoriTrimise["salariu_minim_brut"] ??
                      setariCurente?.salariu_minim_brut ??
                      0
                    }
                  />
                )}
              </Camp>
            </div>

            {/*
              Bifele rămân scrise de mână: `Camp` pune eticheta ÎNAINTEA
              controlului, iar la o casetă de bifat eticheta stă DUPĂ ea.
              Clasele vin din `clasaBifa`, ca să nu reapară încă o variantă de
              chenar scrisă local. Un boolean nu poate primi decât eroare de
              tip, deci nu pierd nimic afișând-o la nivel de formular.
            */}
            <fieldset className="text-corp">
              <legend className="text-corp mb-2 font-medium">Tichete și baze de calcul</legend>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="tichete_impozabile"
                    defaultChecked={bifa(
                      "tichete_impozabile",
                      setariCurente?.tichete_impozabile ?? false,
                    )}
                    className={clasaBifa}
                  />
                  Tichetele intră în baza de impozit
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="tichete_supuse_cass"
                    defaultChecked={bifa(
                      "tichete_supuse_cass",
                      setariCurente?.tichete_supuse_cass ?? false,
                    )}
                    className={clasaBifa}
                  />
                  Tichetele intră în baza CASS (nu și în cea CAS)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="aplica_minim_contributii"
                    defaultChecked={bifa(
                      "aplica_minim_contributii",
                      setariCurente?.aplica_minim_contributii ?? false,
                    )}
                    className={clasaBifa}
                  />
                  Ridică baza de contribuții la salariul minim
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="rotunjire_lei"
                    defaultChecked={bifa("rotunjire_lei", setariCurente?.rotunjire_lei ?? false)}
                    className={clasaBifa}
                  />
                  Rotunjire la leu întreg
                </label>
              </div>
            </fieldset>

            <div className="space-y-2">
              <p className="text-corp font-medium">Praguri de deducere personală</p>
              {eroriPraguri.length === 0 ? null : (
                <p role="alert" className="text-danger text-nota">
                  {eroriPraguri.join(" ")}
                </p>
              )}
              {/*
                EXCEPȚIE de la migrarea pe `<Tabel>`, deliberată.
                Nu e o listă de citit, ci o grilă de EDITAT: fiecare celulă e un
                `<input>` controlat. `<Tabel>` randează fiecare rând de două ori
                — tabel peste `md`, carduri sub — și ascunde unul prin CSS.
                Dublate, câmpurile ascunse blochează trimiterea formularului cu
                un mesaj de validare pe un element pe care browserul nu-l poate
                focaliza: formularul refuză să plece, fără nicio eroare vizibilă.
                Grila rămâne scrisă de mână până când editarea rândurilor
                primește o componentă proprie.

                Din același motiv celulele nu trec nici prin `Camp`: `nume` ar fi
                același pe toate rândurile, deci identificatorii derivați s-ar
                repeta. Mesajele lor apar o singură dată, mai sus.
              */}
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
                            aria-label="Număr minim de persoane în întreținere"
                            value={prag.nr_persoane_intretinere_min}
                            onChange={(e) => {
                              actualizeazaPrag(
                                prag.cheie,
                                "nr_persoane_intretinere_min",
                                e.target.value,
                              );
                            }}
                            className="border-foreground/60 rounded-control w-24 border px-2 py-1"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            min={0}
                            aria-label="Număr maxim de persoane în întreținere"
                            value={prag.nr_persoane_intretinere_max}
                            onChange={(e) => {
                              actualizeazaPrag(
                                prag.cheie,
                                "nr_persoane_intretinere_max",
                                e.target.value,
                              );
                            }}
                            className="border-foreground/60 rounded-control w-24 border px-2 py-1"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            aria-label="Venit brut maxim"
                            value={prag.venit_brut_max}
                            onChange={(e) => {
                              actualizeazaPrag(prag.cheie, "venit_brut_max", e.target.value);
                            }}
                            className="border-foreground/60 rounded-control w-32 border px-2 py-1"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            aria-label="Deducere"
                            value={prag.valoare}
                            onChange={(e) => {
                              actualizeazaPrag(prag.cheie, "valoare", e.target.value);
                            }}
                            className="border-foreground/60 rounded-control w-32 border px-2 py-1"
                          />
                        </td>
                        <td className="py-1">
                          <Buton
                            varianta="distructiv"
                            onClick={() => {
                              setPraguri((anterior) =>
                                anterior.filter((p) => p.cheie !== prag.cheie),
                              );
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

            <Buton
              type="submit"
              varianta="primar"
              inCurs={stare.inCurs}
              textInCurs="Se salvează…"
              className="self-start"
            >
              Salvează o versiune nouă
            </Buton>
          </>
        );
      }}
    </Formular>
  );
}
