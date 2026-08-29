"use client";

import { Plus } from "lucide-react";
import { useCallback } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { REZULTATE_INTERVENTIE, TIPURI_MENTENANTA } from "@/schemas/maintenance";
import { ETICHETE_REZULTAT_INTERVENTIE, ETICHETE_TIP_MENTENANTA } from "../../etichete";
import { inregistreazaInterventie } from "../../actions";

interface Optiune {
  readonly id: string;
  readonly nume: string;
}

/**
 * Intervenția de mentenanță, pe `<Formular>` + `<Camp>`.
 *
 * ── CE S-A REPARAT ────────────────────────────────────────────────────────
 * Cincisprezece câmpuri, `<form action={trimite}>` și controale necontrolate:
 * React 19 resetează un asemenea formular după ce acțiunea se încheie, deci o
 * singură eroare de validare — o oră scrisă „9:30” în loc de „09:30” — golea
 * toate cele cincisprezece. `<Formular>` ține valorile în `useActionState` și le
 * dă înapoi prin `valoriTrimise`.
 *
 * `interventieNouaSchema` are mesaje pe câmp — „Ora trebuie scrisă HH:MM.” pe
 * `ora_start`, lungimea minimă pe `descriere` — pe care serverul le trimitea în
 * `fieldErrors`, iar fișierul le arunca, afișând doar `error.message` lângă
 * buton. Pe un formular atât de lat, mesajul general nu spune care câmp e
 * vinovat; acum fiecare stă lângă al lui, legat prin `aria-describedby`.
 *
 * ── DE CE `id` EXPLICIT ───────────────────────────────────────────────────
 * `Camp` derivă identificatorul din `nume`, iar fișa echipamentului randează
 * cinci formulare simultan: `tip` apare în patru dintre ele, `observatii` în
 * două. Prefixul din `useId()` ține identificatorii distincți.
 */
export function FormularInterventie({
  equipmentId,
  planuri,
  angajati,
}: {
  readonly equipmentId: string;
  readonly planuri: readonly Optiune[];
  readonly angajati: readonly Optiune[];
}) {
  const trimite = useCallback(
    async (formular: FormData) => {
      const gol = (cheie: string): string | null => {
        const v = String(formular.get(cheie) ?? "").trim();
        return v.length === 0 ? null : v;
      };

      return await inregistreazaInterventie({
        plan_id: gol("plan_id"),
        equipment_id: equipmentId,
        tip: String(formular.get("tip") ?? "corectiva"),
        data: String(formular.get("data") ?? ""),
        ora_start: gol("ora_start"),
        durata_ore: gol("durata_ore") === null ? null : Number(gol("durata_ore")),
        executant_employee_id: gol("executant_employee_id"),
        executant_extern: gol("executant_extern"),
        descriere: String(formular.get("descriere") ?? ""),
        piese: gol("piese"),
        cost_piese: Number(gol("cost_piese") ?? "0"),
        cost_manopera: Number(gol("cost_manopera") ?? "0"),
        rezultat: String(formular.get("rezultat") ?? "reusita"),
        oprire_minute: gol("oprire_minute") === null ? null : Number(gol("oprire_minute")),
        citire_contor: gol("citire_contor") === null ? null : Number(gol("citire_contor")),
        observatii: gol("observatii"),
      });
    },
    [equipmentId],
  );

  return (
    <FormularDialog
      declansator={{
        eticheta: "Intervenție nouă",
        varianta: "secundar",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Intervenție de mentenanță"
      descriere="Legată de un plan, intervenția îi mută scadența următoare. Fără plan, rămâne o intervenție de sine stătătoare — o reparație neplanificată, de pildă."
      marime="mare"
      actiune={trimite}
      mesajReusita="Intervenția a fost înregistrată."
      etichetaTrimite="Salvează intervenția"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => {
        // Formularul rămâne pe ecran după salvare, deci trebuie să
        // repornească gol: React 19 resetează un `<form action>` necontrolat
        // după acțiune, iar resetul pune înapoi `defaultValue` — adică exact
        // ce tocmai s-a salvat. `valoriTrimise` se păstrează DOAR cât timp
        // ultimul răspuns a fost un refuz.
        const trimise: Readonly<Record<string, string>> =
          stare.data === null ? stare.valoriTrimise : {};

        return (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Camp
                nume="plan_id"
                id={idc("plan")}
                eticheta="Din planul"
                fel="select"
                erori={stare.erori["plan_id"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["plan_id"] ?? ""}>
                    <option value="">Fără plan (intervenție corectivă)</option>
                    {planuri.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nume}
                      </option>
                    ))}
                  </select>
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
                  <select {...a} defaultValue={trimise["tip"] ?? "corectiva"}>
                    {TIPURI_MENTENANTA.map((t) => (
                      <option key={t} value={t}>
                        {ETICHETE_TIP_MENTENANTA[t]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="data"
                id={idc("data")}
                eticheta="Data"
                obligatoriu
                erori={stare.erori["data"] ?? []}
              >
                {(a) => <input {...a} type="date" defaultValue={trimise["data"] ?? ""} />}
              </Camp>

              <Camp
                nume="ora_start"
                id={idc("ora-start")}
                eticheta="Ora de început"
                erori={stare.erori["ora_start"] ?? []}
              >
                {(a) => <input {...a} type="time" defaultValue={trimise["ora_start"] ?? ""} />}
              </Camp>

              <Camp
                nume="durata_ore"
                id={idc("durata")}
                eticheta="Durata (ore)"
                erori={stare.erori["durata_ore"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.5"
                    defaultValue={trimise["durata_ore"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="executant_employee_id"
                id={idc("executant-angajat")}
                eticheta="Executant (angajat)"
                fel="select"
                erori={stare.erori["executant_employee_id"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["executant_employee_id"] ?? ""}>
                    <option value="">—</option>
                    {angajati.map((ang) => (
                      <option key={ang.id} value={ang.id}>
                        {ang.nume}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="executant_extern"
                id={idc("executant-extern")}
                eticheta="Executant (firmă externă)"
                erori={stare.erori["executant_extern"] ?? []}
              >
                {(a) => (
                  <input {...a} maxLength={200} defaultValue={trimise["executant_extern"] ?? ""} />
                )}
              </Camp>

              <Camp
                nume="descriere"
                id={idc("descriere")}
                eticheta="Descriere"
                fel="textarea"
                obligatoriu
                className="sm:col-span-2 lg:col-span-3"
                erori={stare.erori["descriere"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={2}
                    maxLength={2000}
                    defaultValue={trimise["descriere"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="piese"
                id={idc("piese")}
                eticheta="Piese folosite"
                fel="textarea"
                className="sm:col-span-2 lg:col-span-3"
                erori={stare.erori["piese"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={2}
                    maxLength={2000}
                    defaultValue={trimise["piese"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="cost_piese"
                id={idc("cost-piese")}
                eticheta="Cost piese (lei)"
                erori={stare.erori["cost_piese"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={trimise["cost_piese"] ?? "0"}
                  />
                )}
              </Camp>

              <Camp
                nume="cost_manopera"
                id={idc("cost-manopera")}
                eticheta="Cost manoperă (lei)"
                erori={stare.erori["cost_manopera"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={trimise["cost_manopera"] ?? "0"}
                  />
                )}
              </Camp>

              <Camp
                nume="rezultat"
                id={idc("rezultat")}
                eticheta="Rezultat"
                fel="select"
                erori={stare.erori["rezultat"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["rezultat"] ?? "reusita"}>
                    {REZULTATE_INTERVENTIE.map((r) => (
                      <option key={r} value={r}>
                        {ETICHETE_REZULTAT_INTERVENTIE[r]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="oprire_minute"
                id={idc("oprire-minute")}
                eticheta="Oprire (minute)"
                erori={stare.erori["oprire_minute"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    defaultValue={trimise["oprire_minute"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="citire_contor"
                id={idc("citire-contor")}
                eticheta="Citire contor la momentul intervenției"
                erori={stare.erori["citire_contor"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={trimise["citire_contor"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="observatii"
                id={idc("observatii")}
                eticheta="Observații"
                fel="textarea"
                className="sm:col-span-2 lg:col-span-3"
                erori={stare.erori["observatii"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={2}
                    maxLength={2000}
                    defaultValue={trimise["observatii"] ?? ""}
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
