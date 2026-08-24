"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { REZULTATE_EXAMEN, TIPURI_EXAMEN } from "@/schemas/ssm";

import { adaugaFisaAptitudine } from "../../actions";
import { ETICHETE_REZULTAT_EXAMEN, ETICHETE_TIP_EXAMEN } from "../../etichete";

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/**
 * NU are câmp de diagnostic — art. 9 GDPR. Restricțiile de muncă (inapt,
 * inapt temporar, apt condiționat) se generează SINGURE, prin trigger, când
 * se salvează rezultatul; formularul nu le atinge.
 *
 * ── CE S-A REPARAT ────────────────────────────────────────────────────────
 * Fișa de aptitudine are valabilitate: „valabil până la” intră în calculul
 * scadențelor și în raportul de expirări. Când `valabil_pana` sau
 * `data_examinarii` erau greșite, `fisaAptitudineSchema` spunea exact care
 * dintre ele — dar formularul afișa un singur `<p>` roșu sub buton, cu textul
 * generic al acțiunii, iar după refuz React 19 golea toate cele nouă câmpuri.
 * `<Formular>` întoarce `valoriTrimise`; `<Camp>` duce mesajul lângă câmp.
 *
 * ── CONTRACTUL DE NUME ────────────────────────────────────────────────────
 * `nume` din fiecare `<Camp>` e cheia din `fisaAptitudineSchema`, literă cu
 * literă. Schema nu are `observatii` și nu are diagnostic — nici formularul.
 */
export function FormularFisa({ angajati }: { readonly angajati: readonly AngajatOptiune[] }) {
  const router = useRouter();

  async function trimite(formular: FormData) {
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };
    const cost = text("cost");

    return await adaugaFisaAptitudine({
      employee_id: String(formular.get("employee_id") ?? ""),
      tip: String(formular.get("tip") ?? ""),
      data_examinarii: String(formular.get("data_examinarii") ?? ""),
      medic: text("medic"),
      unitate_medicala: text("unitate_medicala"),
      rezultat: String(formular.get("rezultat") ?? ""),
      valabil_pana: text("valabil_pana"),
      numar_fisa: text("numar_fisa"),
      cost: cost === null ? null : Number(cost),
    });
  }

  // Stabil între randări: `laReusita` intră în lista de dependențe a efectului
  // din `<Formular>`, iar o funcție nouă la fiecare randare ar relua efectul.
  const laReusita = useCallback(() => {
    router.push("/ssm/medicina-muncii");
    router.refresh();
  }, [router]);

  return (
    <Formular actiune={trimite} laReusita={laReusita} mesajReusita="Fișa a fost salvată.">
      {(stare) => {
        // După o salvare reușită formularul repornește gol: `valoriTrimise` se
        // păstrează DOAR cât timp ultimul răspuns a fost un refuz.
        const trimise: Readonly<Record<string, string>> =
          stare.data === null ? stare.valoriTrimise : {};

        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Camp
                nume="employee_id"
                eticheta="Angajat"
                fel="select"
                obligatoriu
                className="sm:col-span-2"
                erori={stare.erori["employee_id"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["employee_id"] ?? ""}>
                    {/* Opțiune goală, PRIMA: fără ea browserul selecta singur
                        primul om din listă, iar `required` nu bloca nimic —
                        există o valoare aleasă. O apăsare distrată scria o fișă de aptitudine — date de sănătate, art. 9 GDPR — pe
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

              <Camp nume="tip" eticheta="Tip examen" fel="select" erori={stare.erori["tip"] ?? []}>
                {(a) => (
                  <select {...a} defaultValue={trimise["tip"] ?? "periodic"}>
                    {TIPURI_EXAMEN.map((t) => (
                      <option key={t} value={t}>
                        {ETICHETE_TIP_EXAMEN[t]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="data_examinarii"
                eticheta="Data examinării"
                obligatoriu
                erori={stare.erori["data_examinarii"] ?? []}
              >
                {(a) => (
                  <input {...a} type="date" defaultValue={trimise["data_examinarii"] ?? ""} />
                )}
              </Camp>

              <Camp
                nume="rezultat"
                eticheta="Rezultat"
                fel="select"
                erori={stare.erori["rezultat"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["rezultat"] ?? "apt"}>
                    {REZULTATE_EXAMEN.map((r) => (
                      <option key={r} value={r}>
                        {ETICHETE_REZULTAT_EXAMEN[r]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="valabil_pana"
                eticheta="Valabilă până la"
                erori={stare.erori["valabil_pana"] ?? []}
              >
                {(a) => <input {...a} type="date" defaultValue={trimise["valabil_pana"] ?? ""} />}
              </Camp>

              <Camp nume="medic" eticheta="Medic" erori={stare.erori["medic"] ?? []}>
                {(a) => <input {...a} maxLength={120} defaultValue={trimise["medic"] ?? ""} />}
              </Camp>

              <Camp
                nume="unitate_medicala"
                eticheta="Unitate medicală"
                erori={stare.erori["unitate_medicala"] ?? []}
              >
                {(a) => (
                  <input {...a} maxLength={160} defaultValue={trimise["unitate_medicala"] ?? ""} />
                )}
              </Camp>

              <Camp nume="numar_fisa" eticheta="Număr fișă" erori={stare.erori["numar_fisa"] ?? []}>
                {(a) => <input {...a} maxLength={64} defaultValue={trimise["numar_fisa"] ?? ""} />}
              </Camp>

              <Camp nume="cost" eticheta="Cost (lei)" erori={stare.erori["cost"] ?? []}>
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={trimise["cost"] ?? ""}
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
                Salvează fișa
              </Buton>
            </div>
          </>
        );
      }}
    </Formular>
  );
}
