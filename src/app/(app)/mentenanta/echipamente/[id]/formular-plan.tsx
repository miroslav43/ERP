"use client";

import { useCallback, useId } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { TIPURI_CONTOR, TIPURI_MENTENANTA } from "@/schemas/maintenance";
import { ETICHETE_TIP_CONTOR, ETICHETE_TIP_MENTENANTA } from "../../etichete";
import { actualizeazaPlan, creeazaPlan } from "../../actions";

interface Optiune {
  readonly id: string;
  readonly nume: string;
}

export interface PlanExistent {
  readonly id: string;
  readonly denumire: string;
  readonly tip: string;
  readonly periodicitate_zile: number | null;
  readonly periodicitate_contor: number | null;
  readonly tip_contor: string | null;
  readonly ultima_executie: string | null;
  readonly responsabil_employee_id: string | null;
  readonly instructiuni: string | null;
  readonly activ: boolean;
}

/**
 * Planul de mentenanță, pe `<Formular>` + `<Camp>`.
 *
 * ── DE CE CONTEAZĂ AICI MAI MULT DECÂT ORIUNDE ────────────────────────────
 * `planNouSchema` are un `superRefine` care pune mesaje pe câmpuri anume:
 * „Planul are nevoie de o periodicitate…” pe `periodicitate_zile` și
 * „O periodicitate pe contor cere și tipul contorului…” pe `tip_contor`.
 * Amândouă existau pe server și se aruncau — omul citea sub buton „Datele
 * introduse nu sunt valide.”, fără să afle care dintre cele trei câmpuri de
 * periodicitate e vinovat. Acum mesajul stă exact pe câmpul lui.
 *
 * Al doilea câștig: cu `<form action={fn}>` și câmpuri necontrolate React 19
 * RESETEAZĂ formularul după acțiune, deci o eroare de periodicitate ștergea și
 * denumirea, și instrucțiunile. În modul de editare golirea era și mai
 * costisitoare, fiindcă ștergea valorile venite din bază. `valoriTrimise` le
 * pune înapoi, iar `defaultValue` se compune întotdeauna ca
 * „ce s-a trimis ?? ce era înainte”.
 *
 * ── DE CE `id` EXPLICIT ───────────────────────────────────────────────────
 * `Camp` derivă identificatorul din `nume`, iar fișa echipamentului randează
 * cinci formulare simultan (`tip` apare în patru, `denumire` în două). În plus,
 * `ButonEditeazaPlan` poate deschide câte un formular pentru fiecare plan din
 * listă. Prefixul din `useId()` ține identificatorii distincți.
 */
export function FormularPlan({
  equipmentId,
  angajati,
  planExistent,
}: {
  readonly equipmentId: string;
  readonly angajati: readonly Optiune[];
  readonly planExistent?: PlanExistent;
}) {
  const router = useRouter();
  const editare = planExistent !== undefined;
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  const trimite = useCallback(
    async (formular: FormData) => {
      const gol = (cheie: string): string | null => {
        const v = String(formular.get(cheie) ?? "").trim();
        return v.length === 0 ? null : v;
      };
      const perZile = gol("periodicitate_zile");
      const perContor = gol("periodicitate_contor");

      const valori = {
        equipment_id: equipmentId,
        denumire: String(formular.get("denumire") ?? ""),
        tip: String(formular.get("tip") ?? "preventiva"),
        periodicitate_zile: perZile === null ? null : Number(perZile),
        periodicitate_contor: perContor === null ? null : Number(perContor),
        tip_contor: gol("tip_contor"),
        ultima_executie: gol("ultima_executie"),
        ultima_citire_contor: null,
        responsabil_employee_id: gol("responsabil_employee_id"),
        instructiuni: gol("instructiuni"),
        activ: formular.get("activ") === "on",
      };

      return planExistent === undefined
        ? await creeazaPlan(valori)
        : await actualizeazaPlan({ ...valori, id: planExistent.id });
    },
    [equipmentId, planExistent],
  );

  // `laReusita` intră în dependențele unui `useEffect` din `<Formular>`: o
  // funcție creată la fiecare randare ar reîmprospăta ruta la nesfârșit.
  const reimprospateaza = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <section
      aria-labelledby={idc("titlu")}
      className="border-border rounded-panou space-y-3 border p-4"
    >
      <h3 id={idc("titlu")} className="text-corp font-medium">
        {editare ? "Editează planul" : "Plan de mentenanță nou"}
      </h3>

      <Formular
        actiune={trimite}
        laReusita={reimprospateaza}
        mesajReusita={editare ? "Planul a fost actualizat." : "Planul a fost salvat."}
      >
        {(stare) => {
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

          return (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                    <select
                      {...a}
                      defaultValue={trimise["tip"] ?? planExistent?.tip ?? "preventiva"}
                    >
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
                        trimise["periodicitate_zile"] ?? planExistent?.periodicitate_zile ?? ""
                      }
                    />
                  )}
                </Camp>

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
                        trimise["periodicitate_contor"] ?? planExistent?.periodicitate_contor ?? ""
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
                  nume="instructiuni"
                  id={idc("instructiuni")}
                  eticheta="Instrucțiuni"
                  fel="textarea"
                  className="sm:col-span-2 lg:col-span-3"
                  erori={stare.erori["instructiuni"] ?? []}
                >
                  {(a) => (
                    <textarea
                      {...a}
                      rows={2}
                      maxLength={2000}
                      defaultValue={trimise["instructiuni"] ?? planExistent?.instructiuni ?? ""}
                    />
                  )}
                </Camp>
              </div>

              <div>
                <Buton
                  type="submit"
                  varianta="primar"
                  inCurs={stare.inCurs}
                  textInCurs="Se salvează…"
                >
                  {editare ? "Salvează modificările" : "Salvează planul"}
                </Buton>
              </div>
            </>
          );
        }}
      </Formular>
    </section>
  );
}
