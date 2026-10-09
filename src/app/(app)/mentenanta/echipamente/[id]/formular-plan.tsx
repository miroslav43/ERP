"use client";

import { Pencil, Plus } from "lucide-react";
import { useCallback, useState } from "react";

import { Camp, clasaBifa } from "@/components/ui/camp";
import { Combobox, type OptiuneCombobox } from "@/components/ui/combobox";
import { FormularDialog } from "@/components/ui/formular-dialog";
import {
  MODURI_CALCUL,
  TIPURI_CONTOR,
  TIPURI_MENTENANTA,
  type TipMentenanta,
} from "@/schemas/maintenance";

import {
  ETICHETE_MOD_CALCUL,
  ETICHETE_TIP_CONTOR,
  ETICHETE_TIP_MENTENANTA,
  EXPLICATII_MOD_CALCUL,
} from "../../etichete";
import { actualizeazaPlan, creeazaPlan } from "../../actions";
import { useRouter } from "next/navigation";

interface Optiune {
  readonly id: string;
  readonly nume: string;
}

export interface PlanExistent {
  readonly id: string;
  readonly equipment_id: string;
  readonly denumire: string;
  readonly tip: TipMentenanta;
  readonly periodicitate_zile: number | null;
  readonly periodicitate_contor: number | null;
  readonly tip_contor: string | null;
  readonly ultima_executie: string | null;
  readonly urmatoarea_scadenta: string | null;
  readonly responsabil_employee_id: string | null;
  readonly instructiuni: string | null;
  readonly activ: boolean;
  readonly mod_calcul: string;
  readonly data_ancora: string | null;
  readonly numar_amanari: number;
  readonly durata_estimata_ore: number | null;
  readonly cost_estimat: number | null;
  readonly oprire_necesara: boolean;
  readonly temei_legal: string | null;
}

/** `?? ""` singur ar transforma un `0` legitim în câmp gol. */
function cifra(valoare: number | null | undefined): string {
  return valoare === null || valoare === undefined ? "" : String(valoare);
}

/**
 * Planul de mentenanță, pe `<Formular>` + `<Camp>` — creare (de pe fișa
 * echipamentului sau de pe lista de planuri, cu selector de echipament) și
 * editare.
 *
 * ── DE CE CONTEAZĂ AICI MAI MULT DECÂT ORIUNDE ────────────────────────────
 * `planNouSchema` are un `superRefine` care pune mesaje pe câmpuri anume:
 * „Planul are nevoie de o periodicitate…” pe `periodicitate_zile` și
 * „O periodicitate pe contor cere și tipul contorului…” pe `tip_contor`.
 * Amândouă existau pe server și se aruncau — omul citea sub buton „Datele
 * introduse nu sunt valide.”, fără să afle care dintre cele trei câmpuri de
 * periodicitate e vinovat. Acum mesajul stă exact pe câmpul lui.
 *
 * ── MODUL DE CALCUL (0183) ────────────────────────────────────────────────
 * „Flotant” = de la ultima execuție; „Fix” = pe o grilă pornită din ancoră,
 * care sare peste restanțe. Ancora apare doar pentru „fix” — singura stare
 * proprie a formularului, pe lângă nimic altceva: restul rămân `defaultValue`,
 * ca `valoriTrimise` să le poată repune după un refuz.
 *
 * ── DE CE `id` EXPLICIT ───────────────────────────────────────────────────
 * `Camp` derivă identificatorul din `nume`, iar fișa echipamentului randează
 * cinci formulare simultan (`tip` apare în patru, `denumire` în două). În plus,
 * lista de planuri poate deschide câte un formular pentru fiecare plan.
 * Prefixul din `useId()` ține identificatorii distincți.
 */
export function FormularPlan({
  equipmentId,
  echipamente,
  angajati,
  planExistent,
  etichetaDeclansator,
}: {
  /** Fișa echipamentului: planul e al lui. Lipsă ⇒ se alege din `echipamente`. */
  readonly equipmentId?: string | undefined;
  readonly echipamente?: readonly OptiuneCombobox[] | undefined;
  readonly angajati: readonly Optiune[];
  readonly planExistent?: PlanExistent;
  readonly etichetaDeclansator?: string;
}) {
  const editare = planExistent !== undefined;
  const [modCalcul, setModCalcul] = useState<string>(planExistent?.mod_calcul ?? "flotant");

  const router = useRouter();
  const trimite = useCallback(
    async (formular: FormData) => {
      const gol = (cheie: string): string | null => {
        const v = String(formular.get(cheie) ?? "").trim();
        return v.length === 0 ? null : v;
      };
      const perZile = gol("periodicitate_zile");
      const perContor = gol("periodicitate_contor");
      const ultimaCitire = gol("ultima_citire_contor");
      const durata = gol("durata_estimata_ore");
      const cost = gol("cost_estimat");
      const mod = gol("mod_calcul") ?? "flotant";

      const valori = {
        equipment_id: equipmentId ?? planExistent?.equipment_id ?? gol("equipment_id") ?? "",
        denumire: String(formular.get("denumire") ?? ""),
        tip: String(formular.get("tip") ?? "preventiva"),
        periodicitate_zile: perZile === null ? null : Number(perZile),
        periodicitate_contor: perContor === null ? null : Number(perContor),
        tip_contor: gol("tip_contor"),
        ultima_executie: gol("ultima_executie"),
        responsabil_employee_id: gol("responsabil_employee_id"),
        instructiuni: gol("instructiuni"),
        activ: formular.get("activ") === "on",
        mod_calcul: mod,
        // Ancora are sens doar pe grilă; pe „flotant" se trimite null, orice
        // ar fi rămas în câmpul ascuns de CSS.
        data_ancora: mod === "fix" ? gol("data_ancora") : null,
        durata_estimata_ore: durata === null ? null : Number(durata),
        cost_estimat: cost === null ? null : Number(cost),
        oprire_necesara: formular.get("oprire_necesara") === "on",
        temei_legal: gol("temei_legal"),
      };

      // Citirea de pornire se dă DOAR la creare. La editare nu se trimite
      // deloc: o mută numai o intervenție reușită, iar un `null` trimis de
      // formular o ștergea și aducea scadența pe contor înapoi la zero.
      return planExistent === undefined
        ? await creeazaPlan({
            ...valori,
            ultima_citire_contor: ultimaCitire === null ? null : Number(ultimaCitire),
          })
        : await actualizeazaPlan({ ...valori, id: planExistent.id });
    },
    [equipmentId, planExistent],
  );

  return (
    <FormularDialog
      declansator={
        editare
          ? {
              eticheta: etichetaDeclansator ?? "Editează",
              varianta: "secundar",
              pictograma: <Pencil aria-hidden="true" className="size-4" />,
            }
          : {
              eticheta: etichetaDeclansator ?? "Plan de mentenanță nou",
              varianta: equipmentId === undefined ? "primar" : "secundar",
              pictograma: <Plus aria-hidden="true" className="size-4" />,
            }
      }
      titlu={editare ? `Editează „${planExistent.denumire}”` : "Plan de mentenanță nou"}
      descriere="Planul are nevoie de cel puțin o periodicitate — în zile, pe contor, sau amândouă. O periodicitate pe contor cere și tipul contorului urmărit."
      marime="mare"
      actiune={trimite}
      mesajReusita={editare ? "Planul a fost actualizat." : "Planul a fost salvat."}
      // Planul nou se deschide (ca echipamentul nou), nu rămâne nevidențiat
      // într-o listă: scadența și responsabilul se verifică pe fișa lui.
      laReusita={(rezultat) => {
        if (!editare && "id" in rezultat) router.push(`/mentenanta/planuri/${rezultat.id}`);
      }}
      etichetaTrimite={editare ? "Salvează modificările" : "Salvează planul"}
      textInCurs="Se salvează…"
      laResetare={() => {
        setModCalcul(planExistent?.mod_calcul ?? "flotant");
      }}
    >
      {(stare, idc) => {
        // Formularul rămâne pe ecran după salvare, deci trebuie să
        // repornească de la valorile din bază: React 19 resetează un `<form
        // action>` necontrolat după acțiune, iar resetul pune înapoi
        // `defaultValue` — adică exact ce tocmai s-a salvat, deci un al
        // doilea clic ar crea încă un plan identic. `valoriTrimise` se
        // păstrează DOAR cât timp ultimul răspuns a fost un refuz.
        const trimise: Readonly<Record<string, string>> =
          stare.data === null ? stare.valoriTrimise : {};

        // Bifa nu apare deloc în `FormData` când e nebifată, deci
        // `trimise["activ"]` nu distinge „nebifat” de „încă netrimis”.
        const sATrimis = Object.keys(trimise).length > 0;
        const activBifat = sATrimis ? trimise["activ"] === "on" : (planExistent?.activ ?? true);
        const oprireBifata = sATrimis
          ? trimise["oprire_necesara"] === "on"
          : (planExistent?.oprire_necesara ?? false);

        return (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {equipmentId === undefined && !editare ? (
                <Camp
                  nume="equipment_id"
                  id={idc("echipament")}
                  eticheta="Echipament"
                  obligatoriu
                  className="sm:col-span-2 lg:col-span-3"
                  erori={stare.erori["equipment_id"] ?? []}
                >
                  {(a) => (
                    <Combobox
                      {...a}
                      optiuni={echipamente ?? []}
                      placeholder="Căutați după cod sau denumire"
                      textFaraRezultate="Niciun echipament cu acest nume."
                      valoareInitiala={trimise["equipment_id"] ?? ""}
                    />
                  )}
                </Camp>
              ) : null}

              <Camp
                nume="denumire"
                id={idc("denumire")}
                eticheta="Denumire"
                obligatoriu
                className="sm:col-span-2 lg:col-span-1"
                erori={stare.erori["denumire"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    maxLength={200}
                    defaultValue={trimise["denumire"] ?? planExistent?.denumire ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="tip"
                id={idc("tip")}
                eticheta="Tip"
                fel="select"
                erori={stare.erori["tip"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["tip"] ?? planExistent?.tip ?? "preventiva"}>
                    {TIPURI_MENTENANTA.map((t) => (
                      <option key={t} value={t}>
                        {ETICHETE_TIP_MENTENANTA[t]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA
                    controlului, iar la o casetă de bifat eticheta stă după —
                    altfel ținta de atingere se rupe în două și rândul se
                    citește invers. */}
              <div className="flex items-center gap-2 self-end">
                <input
                  id={idc("activ")}
                  name="activ"
                  type="checkbox"
                  defaultChecked={activBifat}
                  className={clasaBifa}
                />
                <label htmlFor={idc("activ")} className="text-corp">
                  Plan activ
                </label>
              </div>

              <Camp
                nume="periodicitate_zile"
                id={idc("periodicitate-zile")}
                eticheta="Periodicitate (zile)"
                erori={stare.erori["periodicitate_zile"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="1"
                    defaultValue={
                      trimise["periodicitate_zile"] ?? cifra(planExistent?.periodicitate_zile)
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="mod_calcul"
                id={idc("mod-calcul")}
                eticheta="Calculul scadenței pe zile"
                fel="select"
                ajutor={EXPLICATII_MOD_CALCUL[modCalcul === "fix" ? "fix" : "flotant"]}
                erori={stare.erori["mod_calcul"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    value={modCalcul}
                    onChange={(e) => {
                      setModCalcul(e.target.value);
                    }}
                  >
                    {MODURI_CALCUL.map((m) => (
                      <option key={m} value={m}>
                        {ETICHETE_MOD_CALCUL[m]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              {modCalcul === "fix" ? (
                <Camp
                  nume="data_ancora"
                  id={idc("ancora")}
                  eticheta="Ancora grilei"
                  ajutor="Prima dată a grilei; scadențele cad la ancoră + n × periodicitate. Gol = ultima execuție sau azi."
                  erori={stare.erori["data_ancora"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="date"
                      defaultValue={trimise["data_ancora"] ?? planExistent?.data_ancora ?? ""}
                    />
                  )}
                </Camp>
              ) : (
                <Camp
                  nume="ultima_executie"
                  id={idc("ultima-executie")}
                  eticheta="Ultima execuție"
                  erori={stare.erori["ultima_executie"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="date"
                      defaultValue={
                        trimise["ultima_executie"] ?? planExistent?.ultima_executie ?? ""
                      }
                    />
                  )}
                </Camp>
              )}

              <Camp
                nume="periodicitate_contor"
                id={idc("periodicitate-contor")}
                eticheta="Periodicitate (unități de contor)"
                erori={stare.erori["periodicitate_contor"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={
                      trimise["periodicitate_contor"] ?? cifra(planExistent?.periodicitate_contor)
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="tip_contor"
                id={idc("tip-contor")}
                eticheta="Tipul contorului"
                fel="select"
                erori={stare.erori["tip_contor"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    defaultValue={trimise["tip_contor"] ?? planExistent?.tip_contor ?? ""}
                  >
                    <option value="">— (doar dacă e periodicitate pe contor)</option>
                    {TIPURI_CONTOR.map((t) => (
                      <option key={t} value={t}>
                        {ETICHETE_TIP_CONTOR[t]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              {editare ? null : (
                <Camp
                  nume="ultima_citire_contor"
                  id={idc("ultima-citire-contor")}
                  eticheta="Contorul la ultima execuție"
                  ajutor="Doar pentru planurile pe contor. Gol = se ia ultima citire înregistrată a echipamentului."
                  erori={stare.erori["ultima_citire_contor"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={trimise["ultima_citire_contor"] ?? ""}
                    />
                  )}
                </Camp>
              )}

              <Camp
                nume="responsabil_employee_id"
                id={idc("responsabil")}
                eticheta="Responsabil"
                fel="select"
                erori={stare.erori["responsabil_employee_id"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    defaultValue={
                      trimise["responsabil_employee_id"] ??
                      planExistent?.responsabil_employee_id ??
                      ""
                    }
                  >
                    <option value="">Nespecificat</option>
                    {angajati.map((ang) => (
                      <option key={ang.id} value={ang.id}>
                        {ang.nume}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="durata_estimata_ore"
                id={idc("durata")}
                eticheta="Durată estimată (ore)"
                erori={stare.erori["durata_estimata_ore"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.25"
                    defaultValue={
                      trimise["durata_estimata_ore"] ?? cifra(planExistent?.durata_estimata_ore)
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="cost_estimat"
                id={idc("cost")}
                eticheta="Cost estimat (lei)"
                erori={stare.erori["cost_estimat"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={trimise["cost_estimat"] ?? cifra(planExistent?.cost_estimat)}
                  />
                )}
              </Camp>

              <div className="flex items-center gap-2 self-end">
                <input
                  id={idc("oprire")}
                  name="oprire_necesara"
                  type="checkbox"
                  defaultChecked={oprireBifata}
                  className={clasaBifa}
                />
                <label htmlFor={idc("oprire")} className="text-corp">
                  Cere oprirea utilajului
                </label>
              </div>

              <Camp
                nume="temei_legal"
                id={idc("temei")}
                eticheta="Temei legal (dacă e o verificare cerută de lege)"
                className="sm:col-span-2 lg:col-span-3"
                erori={stare.erori["temei_legal"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    maxLength={300}
                    placeholder="Ex. PT R1-2010, verificare tehnică periodică"
                    defaultValue={trimise["temei_legal"] ?? planExistent?.temei_legal ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="instructiuni"
                id={idc("instructiuni")}
                eticheta="Instrucțiuni"
                fel="textarea"
                ajutor="Câte un pas pe rând, început cu „- ”: la execuție apar ca listă de bifat."
                className="sm:col-span-2 lg:col-span-3"
                erori={stare.erori["instructiuni"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={3}
                    maxLength={2000}
                    defaultValue={trimise["instructiuni"] ?? planExistent?.instructiuni ?? ""}
                  />
                )}
              </Camp>
            </div>
          </>
        );
      }}
    </FormularDialog>
  );
}
