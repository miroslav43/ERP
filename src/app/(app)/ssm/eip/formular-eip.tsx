"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";

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
  const router = useRouter();

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

  // Stabil între randări: `laReusita` intră în lista de dependențe a efectului
  // din `<Formular>`, iar o funcție nouă la fiecare randare ar relua efectul —
  // adică încă o notificare de reușită la fiecare re-randare.
  const laReusita = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita="Echipamentul a fost predat."
      className="border-border rounded-panou border p-4"
    >
      {(stare) => {
        // Formularul se folosește la rând, deci după o predare reușită trebuie
        // să repornească gol: `valoriTrimise` se păstrează DOAR cât timp
        // ultimul răspuns a fost un refuz.
        const trimise: Readonly<Record<string, string>> =
          stare.data === null ? stare.valoriTrimise : {};

        return (
          <>
            <p className="text-corp font-medium">Predă echipament</p>

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

            <div className="flex flex-wrap items-center gap-3">
              <Buton
                type="submit"
                varianta="primar"
                inCurs={stare.inCurs}
                textInCurs="Se salvează…"
              >
                Predă echipamentul
              </Buton>
            </div>
          </>
        );
      }}
    </Formular>
  );
}
