// src/app/(app)/angajati/nou/_components/pachet-salarial.tsx
"use client";

import { useId } from "react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";

import { Buton } from "@/components/ui/buton";
import { TIPURI_SCUTIRE, type InroleazaAngajatInput } from "@/schemas/employee";
import type { TipComponentaSalariala } from "@/schemas/salary-component";
import { ETICHETE_SCUTIRE } from "../../etichete";

/**
 * Pachetul salarial și scutirile, declarate CHIAR LA ÎNROLARE.
 *
 * Amândouă se negociază la angajare — sporuri, prime de Paște și Crăciun,
 * tichete de masă, cadouri, regimul de construcții sau IT — dar se introduceau
 * abia după, dintr-un al doilea ecran, pe fișa angajatului. Cine uita al doilea
 * drum avea un om plătit greșit din prima lună, iar nimic nu semnala lipsa:
 * un pachet salarial gol e o stare validă.
 *
 * ┌ De ce se aleg ȘABLOANE, nu se scriu texte ───────────────────────────────
 * │ Fiecare componentă poartă un regim fiscal — impozabilă sau nu, în baza CAS,
 * │ în baza CASS — care decide bani. Regimul stă pe `salary_component_types`,
 * │ definit o dată per firmă. Un text liber aici ar fi însemnat că aceeași
 * │ „primă de Crăciun" are alt regim la fiecare angajat, după cum a tastat-o
 * │ cine l-a înrolat.
 * └──────────────────────────────────────────────────────────────────────────
 *
 * `valabil_de_la` nu se cere: e data de început a contractului. Un spor care ar
 * începe altă zi e o excepție, iar excepțiile se fac din fișă, unde există tot
 * vocabularul (inclusiv `valabil_pana`).
 */

export interface SablonSalarial {
  readonly id: string;
  readonly denumire: string;
  readonly kind: TipComponentaSalariala;
}

/** Felurile care se măsoară în procent; restul cer o sumă fixă. */
const PROCENTUALE = new Set<TipComponentaSalariala>(["spor_procent"]);

export function PachetSalarial({
  formular,
  sabloane,
}: {
  readonly formular: UseFormReturn<InroleazaAngajatInput>;
  readonly sabloane: readonly SablonSalarial[];
}) {
  const { control, register, watch, setValue } = formular;
  const componente = useFieldArray({ control, name: "componente_salariale" });
  const scutiri = useFieldArray({ control, name: "scutiri_fiscale" });
  const idSectiune = useId();

  return (
    <div className="space-y-6">
      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">
          Sporuri, prime și beneficii
        </legend>

        {sabloane.length === 0 ? (
          <p className="text-corp-mic text-secundar">
            Firma n-are încă niciun tip de componentă salarială definit. Se creează o singură dată,
            din Salarizare → Setări → Componente salariale, cu regimul fiscal al fiecăreia.
          </p>
        ) : (
          <>
            <p className="text-corp-mic text-secundar">
              Se aplică de la data de început a contractului. Regimul fiscal — impozabil, baza CAS,
              baza CASS — vine din tipul ales, nu se stabilește aici.
            </p>

            <ul className="flex flex-col gap-3">
              {componente.fields.map((camp, i) => {
                // `watch` pe un rând tocmai adăugat poate întoarce `undefined`
                // o randare, înainte ca `append` să-i așeze valorile implicite.
                const tipAles = watch(`componente_salariale.${i}.kind`);
                const esteProcent = tipAles !== undefined && PROCENTUALE.has(tipAles);
                return (
                  <li
                    key={camp.id}
                    className="border-hairline rounded-control grid items-end gap-3 border p-3 sm:grid-cols-[2fr_1fr_auto]"
                  >
                    <div className="flex flex-col gap-1">
                      <label
                        className="text-corp-mic"
                        htmlFor={`${idSectiune}-componenta-${String(i)}`}
                      >
                        Componentă
                      </label>
                      <select
                        id={`${idSectiune}-componenta-${String(i)}`}
                        {...register(`componente_salariale.${i}.component_type_id`)}
                        onChange={(e) => {
                          const ales = sabloane.find((s) => s.id === e.target.value);
                          setValue(`componente_salariale.${i}.component_type_id`, e.target.value, {
                            shouldDirty: true,
                          });
                          // Felul NU e o alegere separată: îl poartă șablonul.
                          // Lăsat pe seama omului, ar fi putut contrazice
                          // regimul fiscal al componentei alese.
                          if (ales !== undefined) {
                            setValue(`componente_salariale.${i}.kind`, ales.kind, {
                              shouldDirty: true,
                            });
                          }
                        }}
                        className="border-hairline rounded-control text-corp border px-2 py-1"
                      >
                        <option value="">— Alegeți —</option>
                        {sabloane.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.denumire}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-corp-mic" htmlFor={`${idSectiune}-val-${String(i)}`}>
                        {esteProcent ? "Procent (%)" : "Sumă (lei)"}
                      </label>
                      <input
                        id={`${idSectiune}-val-${String(i)}`}
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(
                          esteProcent
                            ? `componente_salariale.${i}.procent`
                            : `componente_salariale.${i}.suma`,
                        )}
                        className="border-hairline rounded-control text-corp border px-2 py-1"
                      />
                    </div>

                    <Buton
                      varianta="secundar"
                      onClick={() => {
                        componente.remove(i);
                      }}
                    >
                      Elimină
                    </Buton>
                  </li>
                );
              })}
            </ul>

            <Buton
              varianta="secundar"
              onClick={() => {
                componente.append({
                  component_type_id: "",
                  kind: "spor_suma",
                  procent: null,
                  suma: null,
                });
              }}
            >
              + Adaugă spor sau primă
            </Buton>
          </>
        )}
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Scutiri fiscale</legend>
        <p className="text-corp-mic text-secundar">
          Construcții, IT, agricultură — regimuri în care salariatul intră din prima zi. Declarate
          mai târziu, primul stat de plată reține impozit care trebuie apoi restituit, iar D112
          depusă se rectifică.
        </p>

        <ul className="flex flex-col gap-3">
          {scutiri.fields.map((camp, i) => (
            <li
              key={camp.id}
              className="border-hairline rounded-control grid items-end gap-3 border p-3 sm:grid-cols-[2fr_1fr_auto]"
            >
              <div className="flex flex-col gap-1">
                <label className="text-corp-mic" htmlFor={`${idSectiune}-scutire-${String(i)}`}>
                  Tip scutire
                </label>
                <select
                  id={`${idSectiune}-scutire-${String(i)}`}
                  {...register(`scutiri_fiscale.${i}.exemption_type`)}
                  className="border-hairline rounded-control text-corp border px-2 py-1"
                >
                  <option value="">— Alegeți —</option>
                  {TIPURI_SCUTIRE.map((t) => (
                    <option key={t} value={t}>
                      {ETICHETE_SCUTIRE[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-corp-mic" htmlFor={`${idSectiune}-plafon-${String(i)}`}>
                  Plafon lunar (lei)
                </label>
                <input
                  id={`${idSectiune}-plafon-${String(i)}`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="implicit legal"
                  {...register(`scutiri_fiscale.${i}.plafon_lunar`)}
                  className="border-hairline rounded-control text-corp border px-2 py-1"
                />
              </div>

              <Buton
                varianta="secundar"
                onClick={() => {
                  scutiri.remove(i);
                }}
              >
                Elimină
              </Buton>
            </li>
          ))}
        </ul>

        <Buton
          varianta="secundar"
          onClick={() => {
            scutiri.append({
              exemption_type: "constructii",
              procent_scutire: null,
              plafon_lunar: null,
              temei_legal: null,
            });
          }}
        >
          + Adaugă scutire
        </Buton>
      </fieldset>
    </div>
  );
}
