"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { TIPURI_ACCIDENT } from "@/schemas/ssm";

import { inregistreazaAccident } from "../../actions";
import { ETICHETE_TIP_ACCIDENT } from "../../etichete";

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/**
 * Înregistrarea unui accident de muncă.
 *
 * ── DE CE CONTEAZĂ AICI MAI MULT DECÂT ORIUNDE ────────────────────────────
 * Accidentul are termen de comunicare la ITM, iar `imprejurari` e o descriere
 * lungă, scrisă o dată, sub presiune. Vechea variantă afișa un singur `<p>`
 * roșu sub buton — „Datele introduse nu sunt valide.” — deși
 * `accidentNouSchema` spune exact care câmp e greșit: „Locul este obligatoriu.”,
 * „Împrejurările sunt obligatorii.”, sau formatul orei. Și, fiindcă React 19
 * golește un `<form action>` cu câmpuri necontrolate după ce acțiunea se
 * încheie, o oră scrisă greșit ștergea cele patru mii de caractere de
 * împrejurări. `<Formular>` întoarce `valoriTrimise` și le dă înapoi drept
 * `defaultValue`; `<Camp>` duce mesajul lângă câmpul vinovat.
 *
 * ── CONTRACTUL DE NUME ────────────────────────────────────────────────────
 * `nume` din fiecare `<Camp>` e cheia din `accidentNouSchema`, literă cu
 * literă. `termen_comunicare_ore` NU e câmp de formular: triggerul îl
 * completează din parametrii legali.
 */
export function FormularAccident({ angajati }: { readonly angajati: readonly AngajatOptiune[] }) {
  const router = useRouter();

  async function trimite(formular: FormData) {
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };

    return await inregistreazaAccident({
      numar_intern: text("numar_intern"),
      employee_id: text("employee_id"),
      data_producerii: String(formular.get("data_producerii") ?? ""),
      ora_producerii: text("ora_producerii"),
      locul: String(formular.get("locul") ?? ""),
      imprejurari: String(formular.get("imprejurari") ?? ""),
      tip: String(formular.get("tip") ?? ""),
      zile_incapacitate: Number(formular.get("zile_incapacitate") ?? 0),
    });
  }

  // Stabil între randări: `laReusita` intră în lista de dependențe a efectului
  // din `<Formular>`, iar o funcție nouă la fiecare randare ar relua efectul.
  const laReusita = useCallback(
    (date: Readonly<{ id: string }>) => {
      router.push(`/ssm/accidente/${date.id}`);
      router.refresh();
    },
    [router],
  );

  return (
    <Formular actiune={trimite} laReusita={laReusita} mesajReusita="Accidentul a fost înregistrat.">
      {(stare) => {
        // După o înregistrare reușită formularul repornește gol: `valoriTrimise`
        // se păstrează DOAR cât timp ultimul răspuns a fost un refuz.
        const trimise: Readonly<Record<string, string>> =
          stare.data === null ? stare.valoriTrimise : {};

        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Camp
                nume="numar_intern"
                eticheta="Număr intern (opțional)"
                erori={stare.erori["numar_intern"] ?? []}
              >
                {(a) => (
                  <input {...a} maxLength={64} defaultValue={trimise["numar_intern"] ?? ""} />
                )}
              </Camp>

              <Camp
                nume="employee_id"
                eticheta="Angajat"
                fel="select"
                erori={stare.erori["employee_id"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["employee_id"] ?? ""}>
                    <option value="">—</option>
                    {angajati.map((ang) => (
                      <option key={ang.id} value={ang.id}>
                        {ang.full_name ?? ang.marca} ({ang.marca})
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="data_producerii"
                eticheta="Data producerii"
                obligatoriu
                erori={stare.erori["data_producerii"] ?? []}
              >
                {(a) => (
                  <input {...a} type="date" defaultValue={trimise["data_producerii"] ?? ""} />
                )}
              </Camp>

              <Camp
                nume="ora_producerii"
                eticheta="Ora producerii (opțional)"
                erori={stare.erori["ora_producerii"] ?? []}
              >
                {(a) => <input {...a} type="time" defaultValue={trimise["ora_producerii"] ?? ""} />}
              </Camp>

              <Camp nume="tip" eticheta="Tip" fel="select" erori={stare.erori["tip"] ?? []}>
                {(a) => (
                  <select {...a} defaultValue={trimise["tip"] ?? "usor"}>
                    {TIPURI_ACCIDENT.map((t) => (
                      <option key={t} value={t}>
                        {ETICHETE_TIP_ACCIDENT[t]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="zile_incapacitate"
                eticheta="Zile de incapacitate"
                erori={stare.erori["zile_incapacitate"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min={0}
                    defaultValue={trimise["zile_incapacitate"] ?? 0}
                  />
                )}
              </Camp>

              <Camp
                nume="locul"
                eticheta="Locul"
                obligatoriu
                className="sm:col-span-2"
                erori={stare.erori["locul"] ?? []}
              >
                {(a) => <input {...a} maxLength={200} defaultValue={trimise["locul"] ?? ""} />}
              </Camp>

              <Camp
                nume="imprejurari"
                eticheta="Împrejurări"
                fel="textarea"
                obligatoriu
                className="sm:col-span-2"
                erori={stare.erori["imprejurari"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={4}
                    maxLength={4000}
                    defaultValue={trimise["imprejurari"] ?? ""}
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
                Înregistrează accidentul
              </Buton>
            </div>
          </>
        );
      }}
    </Formular>
  );
}
