"use client";

import { Plus } from "lucide-react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { predaEip } from "../actions";

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/**
 * NU trimite `data_inlocuirii`: triggerul BEFORE `internal.ssm_ppe_calc` o
 * calculează.
 *
 * ── CE S-A REPARAT ────────────────────────────────────────────────────────
 * Formular de introdus la rând, direct în listă: se predau zece articole unul
 * după altul. Vechea variantă afișa un singur `<p>` roșu sub buton, deci
 * „Articolul este obligatoriu.” arăta la fel ca o cantitate peste 1000 sau ca o
 * dată de predare nevalidă — iar după refuz React 19 golea toate cele opt
 * câmpuri, inclusiv angajatul deja ales din listă. `<Formular>` întoarce
 * `valoriTrimise`, `<Camp>` duce mesajul lângă câmpul lui.
 *
 * ── CONTRACTUL DE NUME ────────────────────────────────────────────────────
 * `nume` din fiecare `<Camp>` e cheia din `eipSchema`, literă cu literă.
 * `semnatura_confirmata` NU e câmp de formular: predarea se înregistrează
 * nesemnată, iar confirmarea vine separat.
 */
export function FormularEip({ angajati }: { readonly angajati: readonly AngajatOptiune[] }) {
  async function trimite(formular: FormData) {
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };
    const durata = text("durata_utilizare_luni");
    const valoare = text("valoare");

    return await predaEip({
      employee_id: String(formular.get("employee_id") ?? ""),
      articol: String(formular.get("articol") ?? ""),
      cod_articol: text("cod_articol"),
      cantitate: Number(formular.get("cantitate") ?? 1),
      unitate: String(formular.get("unitate") ?? "buc"),
      data_predarii: String(formular.get("data_predarii") ?? ""),
      durata_utilizare_luni: durata === null ? null : Number(durata),
      valoare: valoare === null ? null : Number(valoare),
      semnatura_confirmata: false,
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Predă un echipament",
        varianta: "secundar",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Predare de echipament individual de protecție"
      descriere="Data înlocuirii NU se completează aici: o calculează baza, din durata de utilizare. Predarea se înregistrează nesemnată — confirmarea angajatului vine separat."
      marime="mare"
      actiune={trimite}
      mesajReusita="Echipamentul a fost predat."
      etichetaTrimite="Predă echipamentul"
      textInCurs="Se salvează…"
    >
      {(stare) => {
        // Formularul se folosește la rând, deci după o predare reușită trebuie
        // să repornească gol: `valoriTrimise` se păstrează DOAR cât timp
        // ultimul răspuns a fost un refuz.
        const trimise: Readonly<Record<string, string>> =
          stare.data === null ? stare.valoriTrimise : {};

        return (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Camp
                nume="employee_id"
                eticheta="Angajat"
                fel="select"
                obligatoriu
                erori={stare.erori["employee_id"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["employee_id"] ?? ""}>
                    {/* Opțiune goală, PRIMA: fără ea browserul selecta singur
                        primul om din listă, iar `required` nu bloca nimic —
                        există o valoare aleasă. O apăsare distrată scria predarea de echipament pe
                        primul angajat în ordine alfabetică. Alegerea persoanei
                        trebuie să fie un act explicit. */}
                    <option value="">— alegeți angajatul —</option>
                    {angajati.map((ang) => (
                      <option key={ang.id} value={ang.id}>
                        {ang.full_name ?? ang.marca} ({ang.marca})
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="articol"
                eticheta="Articol"
                obligatoriu
                erori={stare.erori["articol"] ?? []}
              >
                {(a) => <input {...a} maxLength={160} defaultValue={trimise["articol"] ?? ""} />}
              </Camp>

              <Camp
                nume="cod_articol"
                eticheta="Cod articol"
                erori={stare.erori["cod_articol"] ?? []}
              >
                {(a) => <input {...a} maxLength={64} defaultValue={trimise["cod_articol"] ?? ""} />}
              </Camp>

              <Camp nume="cantitate" eticheta="Cantitate" erori={stare.erori["cantitate"] ?? []}>
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0.01"
                    step="1"
                    defaultValue={trimise["cantitate"] ?? 1}
                  />
                )}
              </Camp>

              <Camp nume="unitate" eticheta="Unitate" erori={stare.erori["unitate"] ?? []}>
                {(a) => <input {...a} maxLength={20} defaultValue={trimise["unitate"] ?? "buc"} />}
              </Camp>

              <Camp
                nume="data_predarii"
                eticheta="Data predării"
                obligatoriu
                erori={stare.erori["data_predarii"] ?? []}
              >
                {(a) => <input {...a} type="date" defaultValue={trimise["data_predarii"] ?? ""} />}
              </Camp>

              <Camp
                nume="durata_utilizare_luni"
                eticheta="Durată utilizare (luni, opțional)"
                erori={stare.erori["durata_utilizare_luni"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="1"
                    defaultValue={trimise["durata_utilizare_luni"] ?? ""}
                  />
                )}
              </Camp>

              <Camp nume="valoare" eticheta="Valoare (lei)" erori={stare.erori["valoare"] ?? []}>
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={trimise["valoare"] ?? ""}
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
