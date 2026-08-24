// src/app/(app)/onboarding/sabloane/nou/formular-sablon.tsx
"use client";

import { useCallback, useId } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { CHECKLIST_TIP } from "@/schemas/checklist";

import { actualizeazaSablon, creeazaSablon } from "../../actions";
import { ETICHETE_TIP } from "../../etichete";

/**
 * Antetul unui șablon de parcurs — creare la `/onboarding/sabloane/nou`,
 * editare la `/onboarding/sabloane/[id]`.
 *
 * Trecut pe `<Formular>` + `<Camp>` pentru cele două defecte măsurate:
 * `fieldErrors` construite de `create-action.ts` se aruncau (inclusiv mesajul
 * „Data de sfârșit a valabilității trebuie să fie după data de început.”, care
 * are `path: ["valabil_pana_la"]` și acum ajunge exact acolo), iar `<form
 * action={fn}>` cu câmpuri necontrolate se GOLEA după acțiune — o dată de
 * valabilitate greșită ștergea și denumirea, și descrierea.
 *
 * Identificatorii se prefixează cu `useId()`: pe pagina de editare, alături de
 * formularul ăsta stau formularele de pas, care au și ele `descriere`.
 */

interface OptiuneDenumita {
  readonly id: string;
  readonly denumire: string;
}

interface SablonInitial {
  readonly id: string;
  readonly denumire: string;
  readonly tip: "onboarding" | "offboarding" | "transfer" | "altul";
  readonly descriere: string | null;
  readonly department_id: string | null;
  readonly job_position_id: string | null;
  readonly activ: boolean;
  readonly valabil_de_la: string;
  readonly valabil_pana_la: string | null;
}

interface Proprietati {
  readonly departamente: readonly OptiuneDenumita[];
  readonly posturi: readonly OptiuneDenumita[];
  readonly astazi: string;
  /** Prezent ⇒ formularul editează un șablon existent, în loc să creeze unul. */
  readonly initial?: SablonInitial;
}

export function FormularSablon({ departamente, posturi, astazi, initial }: Proprietati) {
  const router = useRouter();
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  // `useCallback`: `laReusita` intră în dependențele efectului din `Formular`;
  // o funcție nouă la fiecare randare l-ar reporni după succes.
  const laReusita = useCallback(
    (date: Readonly<{ id: string }>): void => {
      router.push(`/onboarding/sabloane/${date.id}`);
      router.refresh();
    },
    [router],
  );

  /** Cheile obiectului sunt EXACT cele din `sablonCampuriSchema`. */
  async function trimite(date: FormData) {
    // Șirul GOL, nu `null`: `optional()` din `schemas/checklist.ts` e o uniune
    // `schema | "" | undefined`, deci un `null` trimis de client cade pe câmp
    // cu „Invalid input” — exact la „Toate departamentele”, cazul obișnuit.
    const text = (cheie: string): string => String(date.get(cheie) ?? "").trim();

    const campuri = {
      denumire: text("denumire"),
      tip: text("tip"),
      descriere: text("descriere"),
      department_id: text("department_id"),
      job_position_id: text("job_position_id"),
      activ: date.get("activ") === "on",
      valabil_de_la: text("valabil_de_la"),
      valabil_pana_la: text("valabil_pana_la"),
    };

    return initial === undefined
      ? creeazaSablon(campuri)
      : actualizeazaSablon({ ...campuri, id: initial.id });
  }

  return (
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita={initial === undefined ? "Șablonul a fost creat." : "Șablonul a fost salvat."}
    >
      {(stare) => {
        // Într-un `FormData` o bifă NEBIFATĂ lipsește cu totul, deci „încă nu
        // s-a trimis nimic” și „s-a trimis nebifat” arată identic pe cheia ei.
        // Se disting uitându-ne dacă formularul a plecat măcar o dată — altfel
        // bifa scoasă de om s-ar pune la loc la prima eroare de validare.
        const sTrimis = Object.keys(stare.valoriTrimise).length > 0;
        const activ = sTrimis ? stare.valoriTrimise["activ"] === "on" : (initial?.activ ?? true);

        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Camp
                nume="denumire"
                id={idc("denumire")}
                eticheta="Denumire"
                obligatoriu
                className="sm:col-span-2"
                erori={stare.erori["denumire"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    minLength={2}
                    maxLength={160}
                    defaultValue={stare.valoriTrimise["denumire"] ?? initial?.denumire ?? ""}
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
                    defaultValue={stare.valoriTrimise["tip"] ?? initial?.tip ?? "onboarding"}
                  >
                    {CHECKLIST_TIP.map((t) => (
                      <option key={t} value={t}>
                        {ETICHETE_TIP[t]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA
                  controlului, iar la o casetă de bifat eticheta stă după —
                  altfel ținta de atingere se rupe în două și rândul se citește
                  invers. */}
              <div className="flex items-end gap-2 pb-2">
                <input
                  id={idc("activ")}
                  name="activ"
                  type="checkbox"
                  defaultChecked={activ}
                  className={clasaBifa}
                />
                <label htmlFor={idc("activ")} className="text-foreground text-corp font-medium">
                  Activ
                </label>
              </div>

              {departamente.length === 0 ? null : (
                <Camp
                  nume="department_id"
                  id={idc("department_id")}
                  eticheta="Restrâns la departament"
                  fel="select"
                  erori={stare.erori["department_id"] ?? []}
                >
                  {(a) => (
                    <select
                      {...a}
                      defaultValue={
                        stare.valoriTrimise["department_id"] ?? initial?.department_id ?? ""
                      }
                    >
                      <option value="">Toate departamentele</option>
                      {departamente.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.denumire}
                        </option>
                      ))}
                    </select>
                  )}
                </Camp>
              )}

              {posturi.length === 0 ? null : (
                <Camp
                  nume="job_position_id"
                  id={idc("job_position_id")}
                  eticheta="Restrâns la post"
                  fel="select"
                  erori={stare.erori["job_position_id"] ?? []}
                >
                  {(a) => (
                    <select
                      {...a}
                      defaultValue={
                        stare.valoriTrimise["job_position_id"] ?? initial?.job_position_id ?? ""
                      }
                    >
                      <option value="">Toate posturile</option>
                      {posturi.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.denumire}
                        </option>
                      ))}
                    </select>
                  )}
                </Camp>
              )}

              <Camp
                nume="valabil_de_la"
                id={idc("valabil_de_la")}
                eticheta="Valabil de la"
                obligatoriu
                erori={stare.erori["valabil_de_la"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    defaultValue={
                      stare.valoriTrimise["valabil_de_la"] ?? initial?.valabil_de_la ?? astazi
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="valabil_pana_la"
                id={idc("valabil_pana_la")}
                eticheta="Valabil până la"
                erori={stare.erori["valabil_pana_la"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    defaultValue={
                      stare.valoriTrimise["valabil_pana_la"] ?? initial?.valabil_pana_la ?? ""
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="descriere"
                id={idc("descriere")}
                eticheta="Descriere"
                fel="textarea"
                className="sm:col-span-2"
                erori={stare.erori["descriere"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={3}
                    maxLength={2000}
                    defaultValue={stare.valoriTrimise["descriere"] ?? initial?.descriere ?? ""}
                  />
                )}
              </Camp>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Buton
                type="submit"
                varianta="primar"
                inCurs={stare.inCurs}
                textInCurs="Se salvează…"
              >
                {initial === undefined ? "Creează șablonul" : "Salvează modificările"}
              </Buton>
            </div>
          </>
        );
      }}
    </Formular>
  );
}
