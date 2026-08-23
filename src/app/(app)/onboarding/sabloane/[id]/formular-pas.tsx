// src/app/(app)/onboarding/sabloane/[id]/formular-pas.tsx
"use client";

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import {
  CHECKLIST_RESPONSABIL_TIP,
  CHECKLIST_TIP_DOVADA,
  CHECKLIST_VERIFICARE,
  ROLURI_RESPONSABIL,
} from "@/schemas/checklist";

import { actualizeazaPas, adaugaPas } from "../../actions";
import { ETICHETE_RESPONSABIL_TIP, ETICHETE_ROL, ETICHETE_TIP_DOVADA } from "../../etichete";

/**
 * Un pas de șablon — adăugare sau editare.
 *
 * Formularul are cele mai multe reguli încrucișate din modul, iar toate cad pe
 * un câmp anume: `..._responsabil_ck` pune mesajul pe `responsabil_tip`, iar
 * `..._automat_ck` pe `verificare_automata`. Varianta veche arunca
 * `fieldErrors` și afișa lângă buton „Datele introduse nu sunt valide.” — omul
 * afla că ceva e greșit, nu și CE. Cu `<Formular>` + `<Camp>` mesajul ajunge
 * sub câmpul vinovat, iar `valoriTrimise` opresc golirea formularului la
 * resetul de după acțiune al lui React 19.
 *
 * Identificatorii se prefixează cu `useId()`: `lista-pasi.tsx` poate randa în
 * același timp formularul de adăugare și pe cel de editare al unui pas, iar
 * `Camp` derivă `id` din `nume`.
 */

interface PasInitial {
  readonly id: string;
  readonly titlu: string;
  readonly descriere: string | null;
  readonly responsabil_tip: "rol" | "angajat" | "manager_direct";
  readonly responsabil_rol: "super_admin" | "org_admin" | "manager" | "hr" | "employee" | null;
  readonly responsabil_employee_id: string | null;
  readonly termen_zile_relativ: number;
  readonly obligatoriu: boolean;
  readonly tip_dovada: "niciuna" | "bifa" | "document" | "semnatura";
  readonly verificare_automata: "inventar_returnat" | "acces_revocat" | "documente_semnate" | null;
}

interface Proprietati {
  readonly templateId: string;
  /** Prezent ⇒ formularul editează un pas existent, în loc să adauge unul. */
  readonly initial?: PasInitial;
  readonly onGata?: () => void;
}

export function FormularPas({ templateId, initial, onGata }: Proprietati) {
  const router = useRouter();
  const [responsabilTip, setResponsabilTip] = useState(initial?.responsabil_tip ?? "rol");
  // Formularul de ADĂUGARE rămâne montat după reușită, iar `valoriTrimise` i-ar
  // ține pe ecran pasul tocmai adăugat. Generația îl remontează, deci pleacă de
  // la zero pentru pasul următor. Cel de editare dispare oricum, prin `onGata`.
  const [generatie, setGeneratie] = useState(0);
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  // `useCallback`: `laReusita` intră în dependențele efectului din `Formular`;
  // o funcție nouă la fiecare randare l-ar reporni după succes.
  const laReusita = useCallback((): void => {
    setGeneratie((g) => g + 1);
    router.refresh();
    onGata?.();
  }, [router, onGata]);

  /** Cheile obiectului sunt EXACT cele din `pasCampuriSchema`. */
  async function trimite(date: FormData) {
    // Șirul GOL, nu `null`: `optional()` din `schemas/checklist.ts` e o uniune
    // `schema | "" | undefined`, deci un `null` trimis de client ar cădea pe
    // câmp cu „Invalid input” — la fiecare pas fără verificare automată.
    const text = (cheie: string): string => String(date.get(cheie) ?? "").trim();

    const campuri = {
      titlu: text("titlu"),
      descriere: text("descriere"),
      responsabil_tip: text("responsabil_tip"),
      // Câmpul celuilalt tip de responsabil nici nu e randat; ce a rămas scris
      // în el înainte de schimbarea selectorului nu trebuie să plece la server,
      // fiindcă `..._responsabil_ck` cere exact una dintre cele două valori.
      responsabil_rol: responsabilTip === "rol" ? text("responsabil_rol") : "",
      responsabil_employee_id: responsabilTip === "angajat" ? text("responsabil_employee_id") : "",
      termen_zile_relativ: text("termen_zile_relativ"),
      obligatoriu: date.get("obligatoriu") === "on",
      tip_dovada: text("tip_dovada"),
      verificare_automata: text("verificare_automata"),
    };

    return initial === undefined
      ? adaugaPas({ ...campuri, template_id: templateId })
      : actualizeazaPas({ ...campuri, id: initial.id });
  }

  return (
    <Formular
      key={generatie}
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita={initial === undefined ? "Pasul a fost adăugat." : "Pasul a fost salvat."}
      className="border-border rounded-panou border p-4"
    >
      {(stare) => {
        // Într-un `FormData` o bifă NEBIFATĂ lipsește cu totul, deci „încă nu
        // s-a trimis nimic” și „s-a trimis nebifat” arată identic pe cheia ei.
        // Se disting uitându-ne dacă formularul a plecat măcar o dată — altfel
        // bifa scoasă de om s-ar pune la loc la prima eroare de validare.
        const sTrimis = Object.keys(stare.valoriTrimise).length > 0;
        const obligatoriu = sTrimis
          ? stare.valoriTrimise["obligatoriu"] === "on"
          : (initial?.obligatoriu ?? true);

        return (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Camp
                nume="titlu"
                id={idc("titlu")}
                eticheta="Titlu"
                obligatoriu
                className="sm:col-span-2"
                erori={stare.erori["titlu"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    minLength={2}
                    maxLength={200}
                    defaultValue={stare.valoriTrimise["titlu"] ?? initial?.titlu ?? ""}
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
                    rows={2}
                    maxLength={2000}
                    defaultValue={stare.valoriTrimise["descriere"] ?? initial?.descriere ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="responsabil_tip"
                id={idc("responsabil_tip")}
                eticheta="Responsabil"
                fel="select"
                erori={stare.erori["responsabil_tip"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    value={responsabilTip}
                    onChange={(e) => {
                      setResponsabilTip(e.target.value as typeof responsabilTip);
                    }}
                  >
                    {CHECKLIST_RESPONSABIL_TIP.map((r) => (
                      <option key={r} value={r}>
                        {ETICHETE_RESPONSABIL_TIP[r]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              {responsabilTip === "rol" ? (
                <Camp
                  nume="responsabil_rol"
                  id={idc("responsabil_rol")}
                  eticheta="Rol"
                  fel="select"
                  erori={stare.erori["responsabil_rol"] ?? []}
                >
                  {(a) => (
                    <select
                      {...a}
                      defaultValue={
                        stare.valoriTrimise["responsabil_rol"] ?? initial?.responsabil_rol ?? ""
                      }
                    >
                      <option value="">Alegeți rolul</option>
                      {ROLURI_RESPONSABIL.map((r) => (
                        <option key={r} value={r}>
                          {ETICHETE_ROL[r]}
                        </option>
                      ))}
                    </select>
                  )}
                </Camp>
              ) : null}

              {responsabilTip === "angajat" ? (
                <Camp
                  nume="responsabil_employee_id"
                  id={idc("responsabil_employee_id")}
                  eticheta="Id-ul angajatului"
                  erori={stare.erori["responsabil_employee_id"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      placeholder="id-ul angajatului"
                      defaultValue={
                        stare.valoriTrimise["responsabil_employee_id"] ??
                        initial?.responsabil_employee_id ??
                        ""
                      }
                    />
                  )}
                </Camp>
              ) : null}

              <Camp
                nume="termen_zile_relativ"
                id={idc("termen_zile_relativ")}
                eticheta="Termen (zile față de data de referință)"
                erori={stare.erori["termen_zile_relativ"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min={-365}
                    max={365}
                    defaultValue={
                      stare.valoriTrimise["termen_zile_relativ"] ??
                      String(initial?.termen_zile_relativ ?? 0)
                    }
                  />
                )}
              </Camp>

              {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA
                  controlului, iar la o casetă de bifat eticheta stă după —
                  altfel ținta de atingere se rupe în două și rândul se citește
                  invers. */}
              <div className="flex items-end gap-2 pb-2">
                <input
                  id={idc("obligatoriu")}
                  name="obligatoriu"
                  type="checkbox"
                  defaultChecked={obligatoriu}
                  className={clasaBifa}
                />
                <label
                  htmlFor={idc("obligatoriu")}
                  className="text-foreground text-corp font-medium"
                >
                  Obligatoriu
                </label>
              </div>

              <Camp
                nume="tip_dovada"
                id={idc("tip_dovada")}
                eticheta="Dovadă cerută"
                fel="select"
                erori={stare.erori["tip_dovada"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    defaultValue={
                      stare.valoriTrimise["tip_dovada"] ?? initial?.tip_dovada ?? "bifa"
                    }
                  >
                    {CHECKLIST_TIP_DOVADA.map((t) => (
                      <option key={t} value={t}>
                        {ETICHETE_TIP_DOVADA[t]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="verificare_automata"
                id={idc("verificare_automata")}
                eticheta="Verificare automată"
                fel="select"
                ajutor="Cere pasul obligatoriu și cu dovadă de tip „bifă”; se bifează singur, de sistem."
                erori={stare.erori["verificare_automata"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    defaultValue={
                      stare.valoriTrimise["verificare_automata"] ??
                      initial?.verificare_automata ??
                      ""
                    }
                  >
                    <option value="">Fără</option>
                    {CHECKLIST_VERIFICARE.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
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
                {initial === undefined ? "Adaugă pasul" : "Salvează pasul"}
              </Buton>
              {onGata === undefined ? null : (
                <Buton varianta="secundar" disabled={stare.inCurs} onClick={onGata}>
                  Renunță
                </Buton>
              )}
            </div>
          </>
        );
      }}
    </Formular>
  );
}
